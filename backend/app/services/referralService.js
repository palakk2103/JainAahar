import crypto from "crypto";
import mongoose from "mongoose";
import Customer from "../models/customer.js";
import Employee from "../models/employee.js";
import Order from "../models/order.js";
import Setting from "../models/setting.js";
import Referral, { REFERRAL_STATUS } from "../models/referral.js";
import ReferralAuditLog, { REFERRAL_AUDIT_ACTION } from "../models/referralAuditLog.js";
import { creditWallet, debitWallet, getOrCreateWallet } from "./finance/walletService.js";
import {
  LEDGER_TRANSACTION_TYPE,
  ORDER_PAYMENT_STATUS,
  OWNER_TYPE,
  WALLET_STATUS,
} from "../constants/finance.js";
import { WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { roundCurrency } from "../utils/money.js";
import { escapeRegex } from "../utils/regex.js";
import logger from "./logger.js";

/**
 * Refer & Earn.
 *
 * - Every customer gets a unique code (generated lazily).
 * - A new customer (no orders yet) can enter a code at signup; it is
 *   applied after OTP verification and creates one `Referral` document.
 * - When that customer's first eligible order is delivered, both users
 *   receive coins in their existing customer wallet (1 coin = 1 INR) via
 *   `walletService.creditWallet` + a REFERRAL_REWARD ledger row. The claim,
 *   both credits and the status change commit in one Mongo transaction.
 *
 * Percentage rewards are calculated on the products' selling price
 * (sale price x quantity, never MRP). Delivery, handling, tip and tax are
 * excluded. Coins are always whole numbers, rounded down.
 */

export const REWARD_TYPE = { FIXED: "fixed", PERCENTAGE: "percentage" };

const CODE_PREFIX = "JA";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const CODE_RANDOM_LENGTH = 6;

const DEFAULT_RULE = { type: REWARD_TYPE.FIXED, value: 0, maxCoins: 0 };

function referralError(message, statusCode = 400, code = "REFERRAL_INVALID") {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function toNonNegativeNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function normalizeRule(raw = {}) {
  const type = raw?.type === REWARD_TYPE.PERCENTAGE ? REWARD_TYPE.PERCENTAGE : REWARD_TYPE.FIXED;
  return {
    type,
    value: toNonNegativeNumber(raw?.value, 0),
    maxCoins: toNonNegativeNumber(raw?.maxCoins, 0),
  };
}

/* ------------------------------------------------------------------ */
/* Pure helpers (unit tested)                                          */
/* ------------------------------------------------------------------ */

export function normalizeReferralConfig(raw = {}) {
  const cfg = raw || {};
  return {
    enabled: cfg.enabled === true,
    referrerReward: normalizeRule(cfg.referrerReward || DEFAULT_RULE),
    referredReward: normalizeRule(cfg.referredReward || DEFAULT_RULE),
    minOrderValue: toNonNegativeNumber(cfg.minOrderValue, 0),
    validityDays: Math.floor(toNonNegativeNumber(cfg.validityDays, 0)),
  };
}

/**
 * Validate an admin settings payload. Returns the normalized config or
 * throws a 400 with every problem listed.
 */
export function validateReferralConfigInput(input = {}) {
  const errors = [];
  const checkRule = (label, rule) => {
    if (!rule || typeof rule !== "object") {
      errors.push(`${label} is required`);
      return;
    }
    if (![REWARD_TYPE.FIXED, REWARD_TYPE.PERCENTAGE].includes(rule.type)) {
      errors.push(`${label}.type must be "fixed" or "percentage"`);
    }
    const value = Number(rule.value);
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`${label}.value must be a number >= 0`);
    } else if (rule.type === REWARD_TYPE.PERCENTAGE && value > 100) {
      errors.push(`${label}.value cannot exceed 100%`);
    } else if (rule.type === REWARD_TYPE.FIXED && !Number.isInteger(value)) {
      errors.push(`${label}.value must be a whole number of coins`);
    }
    if (rule.maxCoins != null && rule.maxCoins !== "") {
      const max = Number(rule.maxCoins);
      if (!Number.isFinite(max) || max < 0 || !Number.isInteger(max)) {
        errors.push(`${label}.maxCoins must be a whole number >= 0`);
      }
    }
  };

  checkRule("referrerReward", input.referrerReward);
  checkRule("referredReward", input.referredReward);

  const minOrderValue = Number(input.minOrderValue ?? 0);
  if (!Number.isFinite(minOrderValue) || minOrderValue < 0) {
    errors.push("minOrderValue must be a number >= 0");
  }
  const validityDays = Number(input.validityDays ?? 0);
  if (!Number.isFinite(validityDays) || validityDays < 0 || !Number.isInteger(validityDays)) {
    errors.push("validityDays must be a whole number >= 0");
  }
  if (input.enabled != null && typeof input.enabled !== "boolean") {
    errors.push("enabled must be true or false");
  }

  if (errors.length) throw referralError(errors.join("; "), 400, "REFERRAL_CONFIG_INVALID");
  return normalizeReferralConfig({ ...input, enabled: input.enabled === true });
}

/**
 * Amount the percentage is calculated on: the selling price the customer
 * was charged for the products (order line `price` is the sale price, not
 * MRP) x quantity. E.g. MRP 700 sold at 400 -> base 400.
 */
export function computeEligiblePurchaseAmount(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length) {
    const total = items.reduce(
      (sum, item) => sum + toNonNegativeNumber(item?.price, 0) * toNonNegativeNumber(item?.quantity, 0),
      0,
    );
    return roundCurrency(total);
  }
  const pb = order.paymentBreakdown || {};
  return roundCurrency(toNonNegativeNumber(pb.productSubtotal, 0) || toNonNegativeNumber(order.pricing?.subtotal, 0));
}

/**
 * Whole coins for one side of the referral, always rounded down. The
 * percentage is computed in integer paise x basis points so floating-point
 * error can never push a value like 29.0 down to 28.
 */
export function calculateRewardCoins(rule, purchaseAmount) {
  const r = normalizeRule(rule);
  let coins;
  if (r.type === REWARD_TYPE.PERCENTAGE) {
    const paise = Math.round(toNonNegativeNumber(purchaseAmount, 0) * 100);
    const basisPoints = Math.round(r.value * 100);
    coins = Math.floor((paise * basisPoints) / 1000000);
    if (r.maxCoins > 0) coins = Math.min(coins, Math.floor(r.maxCoins));
  } else {
    coins = Math.floor(r.value);
  }
  return Math.max(coins, 0);
}

function isOrderDelivered(order) {
  return (
    order.status === "delivered" ||
    order.orderStatus === "delivered" ||
    order.workflowStatus === WORKFLOW_STATUS.DELIVERED
  );
}

/**
 * Business-rule check for a candidate qualifying order. Returns every
 * reason it fails so the audit trail is explicit.
 */
export function checkOrderEligibility(order, referral, config, now = new Date()) {
  const reasons = [];
  if (!order) return { eligible: false, reasons: ["Order not found"], purchaseAmount: 0 };

  if (String(order.customer?._id || order.customer) !== String(referral.referred?._id || referral.referred)) {
    reasons.push("Order does not belong to the referred customer");
  }
  if (order.status === "cancelled" || order.orderStatus === "cancelled" || order.workflowStatus === WORKFLOW_STATUS.CANCELLED) {
    reasons.push("Order was cancelled");
  }
  if (!isOrderDelivered(order)) {
    reasons.push("Order is not delivered yet");
  }
  if ([ORDER_PAYMENT_STATUS.FAILED, ORDER_PAYMENT_STATUS.REFUNDED].includes(order.paymentStatus)) {
    reasons.push(`Payment status is ${order.paymentStatus}`);
  }
  if (
    order.paymentMode === "ONLINE" &&
    order.paymentStatus !== ORDER_PAYMENT_STATUS.PAID &&
    !order.financeFlags?.onlinePaymentCaptured
  ) {
    reasons.push("Online payment not captured");
  }
  // A rejected return (or failed QC) leaves the customer with the goods.
  if (order.returnStatus && !NON_RETURN_STATUSES.includes(order.returnStatus)) {
    reasons.push(`Order has a return (${order.returnStatus})`);
  }
  const referralCreatedAt = referral.createdAt ? new Date(referral.createdAt) : null;
  const orderCreatedAt = order.createdAt ? new Date(order.createdAt) : null;
  if (referralCreatedAt && orderCreatedAt && orderCreatedAt < referralCreatedAt) {
    reasons.push("Order was placed before the referral was applied");
  }
  if (config.validityDays > 0 && referralCreatedAt && orderCreatedAt) {
    const expiresAt = new Date(referralCreatedAt.getTime() + config.validityDays * 86400000);
    if (orderCreatedAt > expiresAt) reasons.push(`Order placed after the ${config.validityDays}-day referral window`);
  }

  const purchaseAmount = computeEligiblePurchaseAmount(order);
  if (config.minOrderValue > 0 && purchaseAmount < config.minOrderValue) {
    reasons.push(`Purchase amount ₹${purchaseAmount} is below the minimum ₹${config.minOrderValue}`);
  }

  return { eligible: reasons.length === 0, reasons, purchaseAmount };
}

const NON_RETURN_STATUSES = ["none", "return_rejected", "qc_failed"];

/**
 * Selling-price value the customer still keeps from the qualifying order
 * after returns / refunds / cancellation.
 *  - cancelled or fully refunded payment -> 0
 *  - completed return refund            -> purchase amount - returned items
 *  - otherwise                          -> purchase amount (nothing to reverse)
 */
export function computeKeptPurchaseAmount(order = {}, referral = {}) {
  const base = Number(referral.purchaseAmount) > 0
    ? Number(referral.purchaseAmount)
    : computeEligiblePurchaseAmount(order);
  const cancelled =
    order.status === "cancelled" ||
    order.orderStatus === "cancelled" ||
    order.workflowStatus === WORKFLOW_STATUS.CANCELLED;
  if (cancelled || order.paymentStatus === ORDER_PAYMENT_STATUS.REFUNDED) return 0;
  if (order.returnStatus !== "refund_completed") return roundCurrency(base);

  const items = Array.isArray(order.returnItems) ? order.returnItems : [];
  let returned = items
    .filter((item) => item?.status !== "rejected")
    .reduce((sum, item) => sum + toNonNegativeNumber(item?.price, 0) * toNonNegativeNumber(item?.quantity, 0), 0);
  if (returned <= 0) returned = toNonNegativeNumber(order.returnRefundAmount, 0);
  if (returned <= 0) return 0; // refund completed without item detail: treat as full return
  return roundCurrency(Math.max(base - returned, 0));
}

/**
 * Coins one side may keep after a return. Uses the rule frozen at credit
 * time. Fixed rewards are kept in full while the kept amount still meets
 * the minimum; percentage rewards are recalculated (floored) on the kept
 * amount and never exceed what was credited.
 */
export function computeRetainedCoins(snapshot = {}, keptAmount, minOrderValue = 0) {
  const credited = Math.floor(toNonNegativeNumber(snapshot?.coins, 0));
  if (credited <= 0 || !(keptAmount > 0)) return 0;
  if (minOrderValue > 0 && keptAmount < minOrderValue) return 0;
  if (snapshot.type === REWARD_TYPE.PERCENTAGE) {
    return Math.min(credited, calculateRewardCoins(snapshot, keptAmount));
  }
  return credited;
}

export function generateReferralCodeCandidate() {
  const bytes = crypto.randomBytes(CODE_RANDOM_LENGTH);
  let out = CODE_PREFIX;
  for (let i = 0; i < CODE_RANDOM_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Config + audit                                                      */
/* ------------------------------------------------------------------ */

export async function getReferralConfig() {
  const settings = await Setting.findOne({}, { referralProgram: 1 }).lean();
  return normalizeReferralConfig(settings?.referralProgram);
}

export async function updateReferralConfig(input, { actorId = null } = {}) {
  const before = await getReferralConfig();
  const next = validateReferralConfigInput(input);
  await Setting.findOneAndUpdate(
    {},
    { $set: { referralProgram: next } },
    { new: true, upsert: true },
  );
  await writeAudit({
    action: REFERRAL_AUDIT_ACTION.SETTINGS_UPDATED,
    actorType: "ADMIN",
    actorId,
    message: next.enabled === before.enabled
      ? "Referral settings updated"
      : `Referral program ${next.enabled ? "enabled" : "disabled"}`,
    details: { before, after: next },
  });
  return next;
}

export async function writeAudit(entry, { session } = {}) {
  try {
    const [doc] = await ReferralAuditLog.create([entry], session ? { session } : {});
    return doc;
  } catch (error) {
    // Inside a transaction the caller must see the failure so it aborts.
    if (session) throw error;
    logger.warn("Referral audit write failed", { action: entry?.action, error: error.message });
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Codes                                                               */
/* ------------------------------------------------------------------ */

export async function ensureReferralCode(customerId) {
  const existing = await Customer.findById(customerId, { referralCode: 1 }).lean();
  if (!existing) throw referralError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
  if (existing.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateReferralCodeCandidate();
    try {
      // Only set when still empty so concurrent requests can't overwrite
      // a code that was handed out moments ago.
      const updated = await Customer.findOneAndUpdate(
        { _id: customerId, referralCode: { $in: [null, ""] } },
        { $set: { referralCode: candidate } },
        { new: true, projection: { referralCode: 1 } },
      ).lean();
      if (updated?.referralCode) {
        await writeAudit({
          action: REFERRAL_AUDIT_ACTION.CODE_GENERATED,
          referrer: customerId,
          referralCode: updated.referralCode,
          message: "Referral code generated",
        });
        return updated.referralCode;
      }
      const reread = await Customer.findById(customerId, { referralCode: 1 }).lean();
      if (reread?.referralCode) return reread.referralCode;
    } catch (error) {
      if (error?.code !== 11000) throw error; // collision -> retry
    }
  }
  throw referralError("Could not generate a referral code, please retry", 500, "REFERRAL_CODE_GENERATION_FAILED");
}

/**
 * Resolve a code entered at signup. Employee codes (EMP###) keep their
 * existing behaviour; anything else must be an active customer's code
 * and the program must be enabled.
 */
export async function resolveSignupReferralCode(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return null;

  const employee = await Employee.findOne({ referralCode: code, isActive: true }).lean();
  if (employee) return { kind: "employee", code, employee };

  const referrer = await Customer.findOne(
    { referralCode: code },
    { _id: 1, name: 1, isActive: 1, role: 1 },
  ).lean();
  if (!referrer || referrer.isActive === false || (referrer.role && referrer.role !== "user")) {
    await writeAudit({
      action: REFERRAL_AUDIT_ACTION.CODE_VALIDATION_FAILED,
      referralCode: code,
      message: "Invalid or inactive referral code",
    });
    throw referralError("Invalid referral code", 400, "REFERRAL_CODE_INVALID");
  }

  const config = await getReferralConfig();
  if (!config.enabled) {
    throw referralError("Refer & Earn is currently unavailable", 400, "REFERRAL_DISABLED");
  }
  return { kind: "customer", code, referrer };
}

/** Public validation endpoint used by the signup form. */
export async function validateCodeForSignup(rawCode) {
  try {
    const resolved = await resolveSignupReferralCode(rawCode);
    if (!resolved) return { valid: false, message: "Referral code required" };
    if (resolved.kind === "employee") {
      return { valid: true, kind: "employee", referrerName: resolved.employee.name || "" };
    }
    const config = await getReferralConfig();
    return {
      valid: true,
      kind: "customer",
      referrerName: firstName(resolved.referrer.name),
      reward: describeRule(config.referredReward),
    };
  } catch (error) {
    if (error.statusCode === 400) return { valid: false, message: error.message };
    throw error;
  }
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function describeRule(rule) {
  if (!rule || !rule.value) return null;
  return {
    type: rule.type,
    value: rule.value,
    maxCoins: rule.maxCoins || 0,
  };
}

/* ------------------------------------------------------------------ */
/* Referral creation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Create the referral link between a new customer and a referrer.
 * Every rejection is written to the audit trail.
 */
export async function createReferral({ referredId, code: rawCode }) {
  const code = normalizeCode(rawCode);
  const fail = async (message, errorCode, extra = {}) => {
    await writeAudit({
      action: REFERRAL_AUDIT_ACTION.CODE_VALIDATION_FAILED,
      referred: referredId,
      referralCode: code,
      message,
      details: extra,
    });
    throw referralError(message, 400, errorCode);
  };

  const config = await getReferralConfig();
  if (!config.enabled) await fail("Refer & Earn is currently unavailable", "REFERRAL_DISABLED");

  const referrer = await Customer.findOne(
    { referralCode: code },
    { _id: 1, isActive: 1, role: 1 },
  ).lean();
  if (!referrer || referrer.isActive === false || (referrer.role && referrer.role !== "user")) {
    await fail("Invalid referral code", "REFERRAL_CODE_INVALID");
  }
  if (String(referrer._id) === String(referredId)) {
    await fail("You cannot use your own referral code", "REFERRAL_SELF");
  }

  const existing = await Referral.findOne({ referred: referredId }, { _id: 1 }).lean();
  if (existing) {
    await fail("A referral code has already been applied to this account", "REFERRAL_ALREADY_CLAIMED", {
      existingReferral: String(existing._id),
    });
  }

  // Circular referral: A referred B, B now tries to refer A.
  const reverse = await Referral.findOne({ referrer: referredId, referred: referrer._id }, { _id: 1 }).lean();
  if (reverse) await fail("Circular referrals are not allowed", "REFERRAL_CIRCULAR");

  const priorOrders = await Order.countDocuments({ customer: referredId });
  if (priorOrders > 0) {
    await fail("Referral codes can only be used by new customers", "REFERRAL_NOT_NEW_CUSTOMER", { priorOrders });
  }

  let referral;
  try {
    referral = await Referral.create({
      referrer: referrer._id,
      referred: referredId,
      referralCode: code,
      status: REFERRAL_STATUS.PENDING,
    });
  } catch (error) {
    if (error?.code === 11000) {
      await fail("A referral code has already been applied to this account", "REFERRAL_ALREADY_CLAIMED");
    }
    throw error;
  }

  await writeAudit({
    action: REFERRAL_AUDIT_ACTION.REFERRAL_CREATED,
    referral: referral._id,
    referrer: referrer._id,
    referred: referredId,
    referralCode: code,
    message: "Referral created (pending first eligible purchase)",
  });
  return referral;
}

/** Called after OTP verification; never throws. */
export async function applyPendingReferral(customerId) {
  try {
    const customer = await Customer.findById(customerId).select("+pendingReferralCode").lean();
    const code = customer?.pendingReferralCode;
    if (!code) return null;

    // Clear first so a failed attempt is not retried on every login.
    await Customer.updateOne({ _id: customerId }, { $unset: { pendingReferralCode: 1 } });
    const referral = await createReferral({ referredId: customerId, code });
    return { applied: true, referralId: String(referral._id) };
  } catch (error) {
    if (error.statusCode === 400) return { applied: false, message: error.message };
    logger.error("applyPendingReferral failed", { customerId: String(customerId), error: error.message });
    return { applied: false, message: "Referral could not be applied" };
  }
}

/* ------------------------------------------------------------------ */
/* Reward processing                                                   */
/* ------------------------------------------------------------------ */

const OPEN_STATUSES = [REFERRAL_STATUS.PENDING, REFERRAL_STATUS.ELIGIBLE];

async function markIneligible(referral, reason, { actorType = "SYSTEM", actorId = null } = {}) {
  const updated = await Referral.findOneAndUpdate(
    { _id: referral._id, status: { $in: OPEN_STATUSES } },
    { $set: { status: REFERRAL_STATUS.INELIGIBLE, statusReason: reason } },
    { new: true },
  );
  if (updated) {
    await writeAudit({
      action: REFERRAL_AUDIT_ACTION.MARKED_INELIGIBLE,
      referral: referral._id,
      referrer: referral.referrer,
      referred: referral.referred,
      referralCode: referral.referralCode,
      actorType,
      actorId,
      message: reason,
    });
  }
  return updated;
}

async function logIneligibleOrderOnce(referral, order, reasons) {
  const already = await ReferralAuditLog.exists({
    referral: referral._id,
    order: order._id,
    action: REFERRAL_AUDIT_ACTION.ORDER_INELIGIBLE,
  });
  if (already) return;
  await writeAudit({
    action: REFERRAL_AUDIT_ACTION.ORDER_INELIGIBLE,
    referral: referral._id,
    referrer: referral.referrer,
    referred: referral.referred,
    referralCode: referral.referralCode,
    order: order._id,
    orderId: order.orderId,
    message: reasons.join("; "),
    details: { reasons },
  });
}

/**
 * Claim + credit in a single transaction. The status filter on the claim
 * plus deterministic ledger idempotency keys make concurrent calls safe:
 * only one transaction can move the referral out of an open status.
 */
async function creditReward(referral, order, purchaseAmount, config, { actorType, actorId }) {
  const referrerCoins = calculateRewardCoins(config.referrerReward, purchaseAmount);
  const referredCoins = calculateRewardCoins(config.referredReward, purchaseAmount);
  const now = new Date();

  const session = await mongoose.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      result = null;
      const claimed = await Referral.findOneAndUpdate(
        { _id: referral._id, status: { $in: OPEN_STATUSES } },
        {
          $set: {
            status: REFERRAL_STATUS.ELIGIBLE,
            qualifyingOrder: order._id,
            qualifyingOrderId: order.orderId,
            purchaseAmount,
            eligibleAt: now,
          },
        },
        { new: true, session },
      );
      if (!claimed) return; // already credited / closed by another worker

      await writeAudit(
        {
          action: REFERRAL_AUDIT_ACTION.REWARD_CALCULATED,
          referral: referral._id,
          referrer: referral.referrer,
          referred: referral.referred,
          referralCode: referral.referralCode,
          order: order._id,
          orderId: order.orderId,
          actorType,
          actorId,
          message: `Referrer ${referrerCoins} coins, referred ${referredCoins} coins on ₹${purchaseAmount}`,
          details: {
            purchaseAmount,
            percentageBase: "sum(item selling price x quantity)",
            referrerRule: config.referrerReward,
            referredRule: config.referredReward,
            referrerCoins,
            referredCoins,
          },
        },
        { session },
      );

      const credit = async (ownerId, coins, side) => {
        if (coins <= 0) return null;
        const res = await creditWallet({
          ownerType: OWNER_TYPE.CUSTOMER,
          ownerId,
          amount: coins,
          session,
          ledgerType: LEDGER_TRANSACTION_TYPE.REFERRAL_REWARD,
          ledgerReference: `REFERRAL-${referral._id}-${side}`,
          ledgerDescription:
            side === "REFERRER"
              ? `Referral reward for inviting a friend (order ${order.orderId})`
              : `Welcome referral reward on your first order ${order.orderId}`,
          orderId: order._id,
          metadata: {
            referralId: String(referral._id),
            side,
            coins,
            purchaseAmount,
            referralCode: referral.referralCode,
          },
          idempotencyKey: `REFERRAL_REWARD:${referral._id}:${side}`,
        });
        return res.ledgerEntry?._id || null;
      };

      const referrerLedgerId = await credit(referral.referrer, referrerCoins, "REFERRER");
      const referredLedgerId = await credit(referral.referred, referredCoins, "REFERRED");

      const snapshot = (rule, coins, ledgerEntryId) => ({
        type: rule.type,
        value: rule.value,
        maxCoins: rule.maxCoins,
        coins,
        ledgerEntryId,
      });

      result = await Referral.findOneAndUpdate(
        { _id: referral._id, status: REFERRAL_STATUS.ELIGIBLE },
        {
          $set: {
            status: REFERRAL_STATUS.REWARD_CREDITED,
            statusReason: "",
            creditedAt: now,
            minOrderValueSnapshot: config.minOrderValue,
            referrerReward: snapshot(config.referrerReward, referrerCoins, referrerLedgerId),
            referredReward: snapshot(config.referredReward, referredCoins, referredLedgerId),
          },
        },
        { new: true, session },
      );

      await writeAudit(
        {
          action: REFERRAL_AUDIT_ACTION.COINS_CREDITED,
          referral: referral._id,
          referrer: referral.referrer,
          referred: referral.referred,
          referralCode: referral.referralCode,
          order: order._id,
          orderId: order.orderId,
          actorType,
          actorId,
          message: `Credited ${referrerCoins} coins to referrer and ${referredCoins} coins to referred customer`,
          details: {
            referrerCoins,
            referredCoins,
            referrerLedgerEntryId: referrerLedgerId ? String(referrerLedgerId) : null,
            referredLedgerEntryId: referredLedgerId ? String(referredLedgerId) : null,
          },
        },
        { session },
      );
    });
  } catch (error) {
    // Transaction rolled back. Keep the referral open (ELIGIBLE) so an
    // admin can retry, and record why.
    await Referral.updateOne(
      { _id: referral._id, status: { $in: OPEN_STATUSES } },
      {
        $set: {
          status: REFERRAL_STATUS.ELIGIBLE,
          statusReason: `Credit failed: ${error.message}`,
          qualifyingOrder: order._id,
          qualifyingOrderId: order.orderId,
          purchaseAmount,
        },
      },
    ).catch(() => {});
    await writeAudit({
      action: REFERRAL_AUDIT_ACTION.CREDIT_FAILED,
      referral: referral._id,
      referrer: referral.referrer,
      referred: referral.referred,
      referralCode: referral.referralCode,
      order: order._id,
      orderId: order.orderId,
      actorType,
      actorId,
      message: error.message,
    });
    throw error;
  } finally {
    await session.endSession();
  }
  return result;
}

/**
 * Re-evaluate one referral: look at the referred customer's delivered
 * orders (oldest first) and credit on the first eligible one.
 */
export async function evaluateReferral(referralOrId, { actorType = "SYSTEM", actorId = null } = {}) {
  const referral = referralOrId?._id && referralOrId.referred
    ? referralOrId
    : await Referral.findById(referralOrId).lean();
  if (!referral) throw referralError("Referral not found", 404, "REFERRAL_NOT_FOUND");
  if (CREDITED_STATUSES.includes(referral.status)) {
    // Re-check of a credited referral reconciles returns / refunds.
    const out = referral.qualifyingOrder
      ? await reverseReferralRewardForOrder(referral.qualifyingOrder, {
          trigger: actorType === "ADMIN" ? "ADMIN_RECHECK" : "RECHECK",
          actorType,
          actorId,
          throwOnError: actorType === "ADMIN",
        })
      : null;
    const fresh = await Referral.findById(referral._id).lean();
    return { status: fresh?.status, credited: false, reversed: Boolean(out?.reversed), referral: fresh };
  }
  if (!OPEN_STATUSES.includes(referral.status)) {
    return { status: referral.status, credited: false, referral };
  }

  const config = await getReferralConfig();

  const orders = await Order.find({
    customer: referral.referred,
    createdAt: { $gte: referral.createdAt },
    $or: [
      { status: "delivered" },
      { orderStatus: "delivered" },
      { workflowStatus: WORKFLOW_STATUS.DELIVERED },
    ],
  })
    .sort({ deliveredAt: 1, createdAt: 1 })
    .limit(50)
    .lean();

  let candidate = null;
  for (const order of orders) {
    const check = checkOrderEligibility(order, referral, config);
    if (check.eligible) {
      candidate = { order, purchaseAmount: check.purchaseAmount };
      break;
    }
    await logIneligibleOrderOnce(referral, order, check.reasons);
  }

  if (candidate && !config.enabled) {
    const updated = await markIneligible(referral, "Refer & Earn was disabled when the qualifying order was delivered", { actorType, actorId });
    return { status: updated?.status || referral.status, credited: false, referral: updated || referral };
  }

  if (!candidate) {
    if (config.validityDays > 0) {
      const expiresAt = new Date(new Date(referral.createdAt).getTime() + config.validityDays * 86400000);
      if (new Date() > expiresAt) {
        const updated = await markIneligible(referral, `No eligible purchase within ${config.validityDays} days`, { actorType, actorId });
        return { status: updated?.status || referral.status, credited: false, referral: updated || referral };
      }
    }
    return { status: referral.status, credited: false, referral };
  }

  const updated = await creditReward(referral, candidate.order, candidate.purchaseAmount, config, { actorType, actorId });
  if (!updated) {
    const fresh = await Referral.findById(referral._id).lean();
    return { status: fresh?.status, credited: false, referral: fresh };
  }
  return { status: updated.status, credited: true, referral: updated };
}

/**
 * Delivery hook. Safe to call multiple times and from any delivery path;
 * never throws so it cannot break order completion.
 */
export async function processReferralForOrder(orderOrId) {
  try {
    const order = orderOrId?.customer
      ? orderOrId
      : await Order.findById(orderOrId, { customer: 1 }).lean();
    const customerId = order?.customer?._id || order?.customer;
    if (!customerId) return null;

    const referral = await Referral.findOne({
      referred: customerId,
      status: { $in: OPEN_STATUSES },
    }).lean();
    if (!referral) return null;

    return await evaluateReferral(referral);
  } catch (error) {
    logger.error("Referral processing failed", {
      orderId: String(orderOrId?._id || orderOrId),
      error: error.message,
    });
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Reversal on return / refund / cancellation                          */
/* ------------------------------------------------------------------ */

const CREDITED_STATUSES = [REFERRAL_STATUS.REWARD_CREDITED, REFERRAL_STATUS.REWARD_REVERSED];
const SIDES = [
  { side: "REFERRER", field: "referrerReward", owner: "referrer" },
  { side: "REFERRED", field: "referredReward", owner: "referred" },
];

async function recoverableCoins(ownerId, session) {
  const wallet = await getOrCreateWallet(OWNER_TYPE.CUSTOMER, ownerId, { session });
  if (wallet.status !== WALLET_STATUS.ACTIVE) return 0;
  return Math.max(Math.floor(wallet.availableBalance || 0), 0);
}

function buildReversalPlan(referral, order, minOrderValue) {
  const keptAmount = computeKeptPurchaseAmount(order, referral);
  const sides = SIDES.map(({ side, field, owner }) => {
    const snap = referral[field] || {};
    const credited = Math.floor(snap.coins || 0);
    const target = computeRetainedCoins(snap, keptAmount, minOrderValue);
    const outstanding = Math.max(credited - target - (snap.reversedCoins || 0), 0);
    return { side, field, ownerId: referral[owner], credited, target, outstanding, unrecovered: snap.unrecoveredCoins || 0 };
  });
  const fullyReversed = sides.every((p) => p.target === 0) && sides.some((p) => p.credited > 0);
  return { keptAmount, sides, fullyReversed };
}

/**
 * Take back referral coins when the qualifying order is returned, refunded
 * or cancelled after the reward was credited. Idempotent: the amount to
 * reverse is always derived from the order's current state minus what was
 * already reversed, and the write is guarded by an optimistic-lock version
 * plus deterministic ledger idempotency keys, so retries and concurrent
 * calls never reverse twice.
 *
 * Wallets are never pushed below zero: if the coins were already spent, the
 * shortfall is recorded as `unrecoveredCoins` and retried on later checks.
 * Never throws (unless `throwOnError`) so it cannot break a refund flow.
 */
export async function reverseReferralRewardForOrder(
  orderOrId,
  { trigger = "ORDER_REFUND", actorType = "SYSTEM", actorId = null, throwOnError = false } = {},
) {
  const orderObjectId = orderOrId?._id || orderOrId;
  let referral = null;
  try {
    if (!orderObjectId) return null;
    referral = await Referral.findOne({
      qualifyingOrder: orderObjectId,
      status: { $in: CREDITED_STATUSES },
    }).lean();
    if (!referral) return null;

    const order = await Order.findById(orderObjectId).lean();
    if (!order) return null;

    const minOrderValue = referral.minOrderValueSnapshot ?? (await getReferralConfig()).minOrderValue;
    const plan = buildReversalPlan(referral, order, minOrderValue);
    const pending = plan.sides.filter((p) => p.outstanding > 0);
    const statusChange = plan.fullyReversed && referral.status !== REFERRAL_STATUS.REWARD_REVERSED;
    if (!pending.length && !statusChange) return { reversed: false, referral };

    // Skip a no-op transaction when nothing can be recovered right now and
    // the recorded shortfall is already accurate.
    if (!statusChange) {
      let worthWriting = false;
      for (const p of pending) {
        if ((await recoverableCoins(p.ownerId)) > 0 || p.unrecovered !== p.outstanding) worthWriting = true;
      }
      if (!worthWriting) return { reversed: false, referral };
    }

    const session = await mongoose.startSession();
    let result = null;
    try {
      await session.withTransaction(async () => {
        result = null;
        const version = referral.reversalVersion || 0;
        const claimed = await Referral.findOneAndUpdate(
          {
            _id: referral._id,
            status: { $in: CREDITED_STATUSES },
            reversalVersion: version === 0 ? { $in: [0, null] } : version,
          },
          { $inc: { reversalVersion: 1 } },
          { new: true, session },
        );
        if (!claimed) return; // another worker reconciled concurrently

        const nextVersion = claimed.reversalVersion;
        const inc = {};
        const set = {};
        const entry = { trigger, keptAmount: plan.keptAmount, at: new Date() };
        const ledgerIds = {};

        for (const p of plan.sides) {
          const key = p.side === "REFERRER" ? "referrer" : "referred";
          let recovered = 0;
          if (p.outstanding > 0) {
            const available = await recoverableCoins(p.ownerId, session);
            recovered = Math.min(p.outstanding, available);
            if (recovered > 0) {
              const res = await debitWallet({
                ownerType: OWNER_TYPE.CUSTOMER,
                ownerId: p.ownerId,
                amount: recovered,
                session,
                ledgerType: LEDGER_TRANSACTION_TYPE.REFERRAL_REWARD_REVERSAL,
                ledgerReference: `REFERRAL-REV-${referral._id}-${p.side}-${nextVersion}`,
                ledgerDescription: `Referral coins reversed: order ${order.orderId} was returned/refunded`,
                orderId: order._id,
                metadata: {
                  referralId: String(referral._id),
                  side: p.side,
                  coins: recovered,
                  keptAmount: plan.keptAmount,
                  trigger,
                },
                idempotencyKey: `REFERRAL_REVERSAL:${referral._id}:${p.side}:${nextVersion}`,
              });
              ledgerIds[key] = res.ledgerEntry?._id ? String(res.ledgerEntry._id) : null;
              inc[`${p.field}.reversedCoins`] = recovered;
            }
          }
          const shortfall = Math.max(p.outstanding - recovered, 0);
          set[`${p.field}.unrecoveredCoins`] = shortfall;
          entry[`${key}Coins`] = recovered;
          entry[`${key}Unrecovered`] = shortfall;
        }

        if (plan.fullyReversed) {
          set.status = REFERRAL_STATUS.REWARD_REVERSED;
          set.reversedAt = new Date();
        }
        const shortfallTotal = (entry.referrerUnrecovered || 0) + (entry.referredUnrecovered || 0);
        set.statusReason = shortfallTotal > 0
          ? `${shortfallTotal} coins could not be recovered (insufficient wallet balance)`
          : plan.fullyReversed
            ? `Qualifying order ${order.orderId} was returned/refunded`
            : "";

        result = await Referral.findOneAndUpdate(
          { _id: referral._id, reversalVersion: nextVersion },
          {
            $set: set,
            ...(Object.keys(inc).length ? { $inc: inc } : {}),
            $push: { reversals: entry },
          },
          { new: true, session },
        );

        await writeAudit(
          {
            action: REFERRAL_AUDIT_ACTION.COINS_REVERSED,
            referral: referral._id,
            referrer: referral.referrer,
            referred: referral.referred,
            referralCode: referral.referralCode,
            order: order._id,
            orderId: order.orderId,
            actorType,
            actorId,
            message:
              `Reversed ${entry.referrerCoins} coins from referrer and ${entry.referredCoins} from referred customer` +
              ` (kept amount ₹${plan.keptAmount})` +
              (shortfallTotal > 0 ? `; ${shortfallTotal} coins unrecovered` : ""),
            details: { trigger, ...entry, ledgerIds, fullyReversed: plan.fullyReversed },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    return { reversed: Boolean(result), referral: result || referral };
  } catch (error) {
    logger.error("Referral reversal failed", {
      orderId: String(orderObjectId),
      error: error.message,
    });
    if (referral) {
      await writeAudit({
        action: REFERRAL_AUDIT_ACTION.REVERSAL_FAILED,
        referral: referral._id,
        referrer: referral.referrer,
        referred: referral.referred,
        referralCode: referral.referralCode,
        order: orderObjectId,
        actorType,
        actorId,
        message: error.message,
        details: { trigger },
      });
    }
    if (throwOnError) throw error;
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Read models                                                         */
/* ------------------------------------------------------------------ */

function maskName(name) {
  const first = firstName(name);
  if (!first) return "Friend";
  return first.length <= 2 ? first : `${first.slice(0, 2)}${"*".repeat(Math.min(first.length - 2, 4))}`;
}

export async function getCustomerReferralOverview(customerId) {
  const config = await getReferralConfig();
  if (!config.enabled) return { enabled: false };

  const code = await ensureReferralCode(customerId);
  const [sent, received] = await Promise.all([
    Referral.find({ referrer: customerId })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("referred", "name")
      .lean(),
    Referral.findOne({ referred: customerId }).lean(),
  ]);

  const history = sent.map((r) => ({
    id: String(r._id),
    friendName: maskName(r.referred?.name),
    status: r.status,
    statusReason: [REFERRAL_STATUS.INELIGIBLE, REFERRAL_STATUS.REWARD_REVERSED].includes(r.status) ? r.statusReason : "",
    coinsEarned: Math.max((r.referrerReward?.coins || 0) - (r.referrerReward?.reversedCoins || 0), 0),
    coinsReversed: r.referrerReward?.reversedCoins || 0,
    joinedAt: r.createdAt,
    creditedAt: r.creditedAt,
  }));

  const stats = {
    totalReferrals: history.length,
    pending: history.filter((h) => h.status === REFERRAL_STATUS.PENDING || h.status === REFERRAL_STATUS.ELIGIBLE).length,
    successful: history.filter((h) => h.status === REFERRAL_STATUS.REWARD_CREDITED).length,
    coinsEarned: history.reduce((sum, h) => sum + (h.coinsEarned || 0), 0)
      + (CREDITED_STATUSES.includes(received?.status)
        ? Math.max((received.referredReward?.coins || 0) - (received.referredReward?.reversedCoins || 0), 0)
        : 0),
  };

  return {
    enabled: true,
    code,
    rules: {
      referrerReward: describeRule(config.referrerReward),
      referredReward: describeRule(config.referredReward),
      minOrderValue: config.minOrderValue,
      validityDays: config.validityDays,
      coinValue: 1,
      percentageBase: "Selling price of the products in your friend's first order (not MRP; excludes delivery, handling, tip and taxes)",
    },
    stats,
    history,
    myReferral: received
      ? {
          status: received.status,
          statusReason: [REFERRAL_STATUS.INELIGIBLE, REFERRAL_STATUS.REWARD_REVERSED].includes(received.status) ? received.statusReason : "",
          code: received.referralCode,
          coinsEarned: Math.max((received.referredReward?.coins || 0) - (received.referredReward?.reversedCoins || 0), 0),
          coinsReversed: received.referredReward?.reversedCoins || 0,
          appliedAt: received.createdAt,
          creditedAt: received.creditedAt,
        }
      : null,
  };
}

export async function getPublicReferralProgram() {
  const config = await getReferralConfig();
  if (!config.enabled) return { enabled: false };
  return {
    enabled: true,
    referredReward: describeRule(config.referredReward),
    minOrderValue: config.minOrderValue,
  };
}

function parseDateRange(from, to) {
  const range = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      // Treat a bare date as inclusive end-of-day.
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(to))) d.setHours(23, 59, 59, 999);
      range.$lte = d;
    }
  }
  return Object.keys(range).length ? range : null;
}

async function findCustomerIdsBySearch(search) {
  const rx = new RegExp(escapeRegex(search), "i");
  const or = [{ name: rx }, { phone: rx }, { email: rx }, { referralCode: rx }];
  if (mongoose.Types.ObjectId.isValid(search)) or.push({ _id: new mongoose.Types.ObjectId(search) });
  const users = await Customer.find({ $or: or }, { _id: 1 }).limit(500).lean();
  return users.map((u) => u._id);
}

function clampPaging(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export async function listReferrals({ search, status, code, customerId, from, to, page, limit } = {}) {
  const filter = {};
  if (status && Object.values(REFERRAL_STATUS).includes(status)) filter.status = status;
  if (code) filter.referralCode = { $regex: `^${escapeRegex(normalizeCode(code))}` };
  if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
    filter.$or = [{ referrer: customerId }, { referred: customerId }];
  }
  const range = parseDateRange(from, to);
  if (range) filter.createdAt = range;

  if (search && String(search).trim()) {
    const term = String(search).trim();
    const ids = await findCustomerIdsBySearch(term);
    const rx = new RegExp(escapeRegex(term), "i");
    const searchOr = [
      { referralCode: rx },
      { qualifyingOrderId: rx },
      { referrer: { $in: ids } },
      { referred: { $in: ids } },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
      delete filter.$or;
    } else {
      filter.$or = searchOr;
    }
  }

  const paging = clampPaging(page, limit);
  const [items, total, statusCounts, coinTotals] = await Promise.all([
    Referral.find(filter)
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .populate("referrer", "name phone email referralCode")
      .populate("referred", "name phone email")
      .lean(),
    Referral.countDocuments(filter),
    Referral.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Referral.aggregate([
      { $match: { status: { $in: CREDITED_STATUSES } } },
      {
        $group: {
          _id: null,
          referrerCoins: { $sum: "$referrerReward.coins" },
          referredCoins: { $sum: "$referredReward.coins" },
          referrerReversed: { $sum: { $ifNull: ["$referrerReward.reversedCoins", 0] } },
          referredReversed: { $sum: { $ifNull: ["$referredReward.reversedCoins", 0] } },
          referrerUnrecovered: { $sum: { $ifNull: ["$referrerReward.unrecoveredCoins", 0] } },
          referredUnrecovered: { $sum: { $ifNull: ["$referredReward.unrecoveredCoins", 0] } },
        },
      },
    ]),
  ]);

  const summary = Object.fromEntries(Object.values(REFERRAL_STATUS).map((s) => [s, 0]));
  for (const row of statusCounts) summary[row._id] = row.count;
  const totals = coinTotals[0] || {};
  summary.totalCoinsCredited = (totals.referrerCoins || 0) + (totals.referredCoins || 0);
  summary.totalCoinsReversed = (totals.referrerReversed || 0) + (totals.referredReversed || 0);
  summary.totalCoinsUnrecovered = (totals.referrerUnrecovered || 0) + (totals.referredUnrecovered || 0);

  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    totalPages: Math.ceil(total / paging.limit) || 1,
    summary,
  };
}

export async function getReferralDetail(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw referralError("Invalid referral id", 400);
  const referral = await Referral.findById(id)
    .populate("referrer", "name phone email referralCode")
    .populate("referred", "name phone email")
    .lean();
  if (!referral) throw referralError("Referral not found", 404, "REFERRAL_NOT_FOUND");
  const auditTrail = await ReferralAuditLog.find({ referral: referral._id })
    .sort({ createdAt: 1 })
    .lean();
  return { referral, auditTrail };
}

export async function listAuditLogs({ action, search, from, to, page, limit } = {}) {
  const filter = {};
  if (action && Object.values(REFERRAL_AUDIT_ACTION).includes(action)) filter.action = action;
  const range = parseDateRange(from, to);
  if (range) filter.createdAt = range;
  if (search && String(search).trim()) {
    const term = String(search).trim();
    const ids = await findCustomerIdsBySearch(term);
    const rx = new RegExp(escapeRegex(term), "i");
    filter.$or = [
      { referralCode: rx },
      { orderId: rx },
      { message: rx },
      { referrer: { $in: ids } },
      { referred: { $in: ids } },
    ];
  }
  const paging = clampPaging(page, limit);
  const [items, total] = await Promise.all([
    ReferralAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit)
      .populate("referrer", "name phone")
      .populate("referred", "name phone")
      .lean(),
    ReferralAuditLog.countDocuments(filter),
  ]);
  return { items, total, page: paging.page, limit: paging.limit, totalPages: Math.ceil(total / paging.limit) || 1 };
}
