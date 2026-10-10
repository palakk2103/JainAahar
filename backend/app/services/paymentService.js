import crypto from "crypto";
import mongoose from "mongoose";

import Order from "../models/order.js";
import CheckoutGroup from "../models/checkoutGroup.js";
import Payment from "../models/payment.js";
import PaymentWebhookEvent from "../models/paymentWebhookEvent.js";
import Transaction from "../models/transaction.js";
import { ORDER_PAYMENT_STATUS, OWNER_TYPE, LEDGER_TRANSACTION_TYPE } from "../constants/finance.js";
import { creditWallet } from "./finance/walletService.js";
import {
  PAYMENT_EVENT_SOURCE,
  PAYMENT_STATUS,
  canTransitionPaymentStatus,
} from "../constants/payment.js";
import { handleOnlineOrderFinance } from "./finance/orderFinanceService.js";
import { DEFAULT_SELLER_TIMEOUT_MS, WORKFLOW_STATUS } from "../constants/orderWorkflow.js";
import { afterPlaceOrderV2 } from "./orderWorkflowService.js";
import { releaseReservedStockForOrder } from "./stockService.js";
import { emitNotificationEvent } from "../modules/notifications/notification.emitter.js";
import { NOTIFICATION_EVENTS } from "../modules/notifications/notification.constants.js";
import logger from "./logger.js";
import { reverseReferralRewardForOrder } from "./referralService.js";
import { getActivePaymentProvider } from "./payment/providerRegistry.js";

const MAX_MERCHANT_ORDER_ID_LENGTH = 63;

function sanitizeGatewayPayload(payload = {}) {
  return {
    merchantOrderId: payload.merchantOrderId,
    transactionId: payload.transactionId,
    amount: payload.amount,
    state: payload.state,
    responseCode: payload.responseCode,
    paymentMode: payload.paymentMode,
    meta: payload.meta || {},
  };
}

function sanitizeMerchantOrderIdPart(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildGatewayMerchantOrderId(publicOrderRef, attemptCount = 1) {
  const normalizedBase = sanitizeMerchantOrderIdPart(publicOrderRef) || "ORDER";
  const suffix = `-A${Math.max(1, Number(attemptCount) || 1)}`;
  const maxBaseLength = MAX_MERCHANT_ORDER_ID_LENGTH - suffix.length;
  const truncatedBase = normalizedBase.slice(0, Math.max(1, maxBaseLength));
  return `${truncatedBase}${suffix}`;
}

function toOrderLookup(orderRef) {
  if (!orderRef) return null;
  const trimmed = String(orderRef).trim();
  if (!trimmed) return null;
  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    return {
      $or: [{ _id: new mongoose.Types.ObjectId(trimmed) }, { orderId: trimmed }],
    };
  }
  return { orderId: trimmed };
}

function extractCheckoutGroupId(orderRef) {
  const trimmed = String(orderRef || "").trim().toUpperCase();
  if (!trimmed) return null;
  if (trimmed.startsWith("CHK-") || trimmed.startsWith("CG-")) {
    return trimmed;
  }
  return null;
}

async function resolvePaymentTarget(orderRef) {
  const checkoutGroupId = extractCheckoutGroupId(orderRef);
  if (checkoutGroupId) {
    const checkoutGroup = await CheckoutGroup.findOne({ checkoutGroupId }).lean();
    if (checkoutGroup) {
      let orders = await Order.find({ checkoutGroupId })
        .sort({ checkoutGroupIndex: 1, createdAt: 1 });

      if (orders.length === 0) {
        const fallbackClauses = [];
        if (Array.isArray(checkoutGroup.orderIds) && checkoutGroup.orderIds.length > 0) {
          fallbackClauses.push({ _id: { $in: checkoutGroup.orderIds } });
        }
        if (Array.isArray(checkoutGroup.publicOrderIds) && checkoutGroup.publicOrderIds.length > 0) {
          fallbackClauses.push({ orderId: { $in: checkoutGroup.publicOrderIds } });
        }

        if (fallbackClauses.length > 0) {
          orders = await Order.find({ $or: fallbackClauses })
            .sort({ checkoutGroupIndex: 1, createdAt: 1 });
        }
      }

      if (orders.length > 0) {
        return {
          checkoutGroupId,
          checkoutGroup,
          orders,
          primaryOrder: orders[0],
          publicOrderRef: checkoutGroupId,
        };
      }
    }
  }

  const query = toOrderLookup(orderRef);
  if (!query) {
    const err = new Error("orderRef is required");
    err.statusCode = 400;
    throw err;
  }

  const order = await Order.findOne(query);
  if (!order) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  if (order.checkoutGroupId) {
    const orders = await Order.find({ checkoutGroupId: order.checkoutGroupId })
      .sort({ checkoutGroupIndex: 1, createdAt: 1 });
    const checkoutGroup = await CheckoutGroup.findOne({
      checkoutGroupId: order.checkoutGroupId,
    }).lean();
    return {
      checkoutGroupId: order.checkoutGroupId,
      checkoutGroup,
      orders: orders.length > 0 ? orders : [order],
      primaryOrder: order,
      publicOrderRef: order.checkoutGroupId,
    };
  }

  return {
    checkoutGroupId: null,
    checkoutGroup: null,
    orders: [order],
    primaryOrder: order,
    publicOrderRef: order.orderId,
  };
}

function validatePaymentEligibility(target, userId) {
  if (!target?.orders?.length) {
    const err = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  for (const order of target.orders) {
    const customerId = order.customer?._id || order.customer;
    if (userId && customerId && String(customerId) !== String(userId)) {
      const err = new Error("You are not allowed to pay for this order");
      err.statusCode = 403;
      throw err;
    }
    if (order.paymentMode !== "ONLINE") {
      const err = new Error("Payment is allowed only for ONLINE orders");
      err.statusCode = 400;
      throw err;
    }
    if (
      order.status === "delivered" ||
      order.workflowStatus === WORKFLOW_STATUS.DELIVERED
    ) {
      const err = new Error("Payment is not allowed for delivered orders");
      err.statusCode = 409;
      throw err;
    }
    if (order.paymentStatus === ORDER_PAYMENT_STATUS.PAID) {
      const err = new Error("Order is already paid");
      err.statusCode = 409;
      throw err;
    }
    if (order.paymentStatus === ORDER_PAYMENT_STATUS.REFUNDED) {
      const err = new Error("Order payment has already been refunded");
      err.statusCode = 409;
      throw err;
    }
  }
}

function getPayableAmountPaise(target) {
  const amountRupees = target.orders.reduce(
    (sum, order) =>
      sum + Number(order?.paymentBreakdown?.grandTotal ?? order?.pricing?.total ?? 0),
    0,
  );
  if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
    const err = new Error("Unable to determine payable amount for this checkout");
    err.statusCode = 400;
    throw err;
  }
  return Math.round(amountRupees * 100);
}


function paymentStatusToOrderPaymentStatus(status) {
  if (status === PAYMENT_STATUS.CAPTURED) return ORDER_PAYMENT_STATUS.PAID;
  if (status === PAYMENT_STATUS.FAILED) return ORDER_PAYMENT_STATUS.FAILED;
  if (status === PAYMENT_STATUS.REFUNDED) return ORDER_PAYMENT_STATUS.REFUNDED;
  return ORDER_PAYMENT_STATUS.CREATED;
}

async function transitionPaymentState(payment, {
  nextStatus,
  source,
  reason = "",
  gatewayPaymentId = null,
  rawGatewayResponse = null,
}) {
  const currentStatus = payment.status || PAYMENT_STATUS.CREATED;
  if (currentStatus === nextStatus) {
    if (gatewayPaymentId && !payment.gatewayPaymentId) {
      payment.gatewayPaymentId = gatewayPaymentId;
    }
    if (rawGatewayResponse) {
      payment.rawGatewayResponse = {
        ...(payment.rawGatewayResponse || {}),
        ...sanitizeGatewayPayload(rawGatewayResponse),
      };
    }
    await payment.save();
    return payment;
  }

  if (!canTransitionPaymentStatus(currentStatus, nextStatus)) {
    const err = new Error(`Invalid payment transition ${currentStatus} -> ${nextStatus}`);
    err.statusCode = 409;
    throw err;
  }

  payment.status = nextStatus;
  if (gatewayPaymentId) payment.gatewayPaymentId = gatewayPaymentId;
  if (rawGatewayResponse) {
    payment.rawGatewayResponse = {
      ...(payment.rawGatewayResponse || {}),
      ...sanitizeGatewayPayload(rawGatewayResponse),
    };
  }
  payment.statusHistory.push({
    fromStatus: currentStatus,
    toStatus: nextStatus,
    source,
    reason,
    changedAt: new Date(),
  });
  if (nextStatus === PAYMENT_STATUS.CAPTURED) {
    payment.capturedAt = new Date();
  } else if (nextStatus === PAYMENT_STATUS.FAILED) {
    payment.failedAt = new Date();
    payment.failureReason = reason || payment.failureReason;
  } else if (nextStatus === PAYMENT_STATUS.REFUNDED) {
    payment.refundedAt = new Date();
  }
  await payment.save();
  return payment;
}

async function moveOrderToSellerPendingAfterPayment(orderId) {
  const now = new Date();
  const sellerPendingUntil = new Date(now.getTime() + DEFAULT_SELLER_TIMEOUT_MS());
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      workflowVersion: { $gte: 2 },
      workflowStatus: WORKFLOW_STATUS.CREATED,
      paymentMode: "ONLINE",
    },
    {
      $set: {
        workflowStatus: WORKFLOW_STATUS.SELLER_PENDING,
        sellerPendingExpiresAt: sellerPendingUntil,
        expiresAt: sellerPendingUntil,
      },
    },
    { new: true },
  );
  if (updatedOrder) {
    void afterPlaceOrderV2(updatedOrder).catch((error) => {
      logger.warn("afterPlaceOrderV2 failed", {
        scope: "moveOrderToSellerPendingAfterPayment",
        orderId: updatedOrder.orderId,
        orderObjectId: updatedOrder._id?.toString?.(),
        error: error.message,
      });
    });
  }
}

async function getRelatedOrdersForPayment(payment) {
  if (Array.isArray(payment.orderIds) && payment.orderIds.length > 0) {
    return Order.find({ _id: { $in: payment.orderIds } })
      .sort({ checkoutGroupIndex: 1, createdAt: 1 });
  }
  if (payment.checkoutGroupId) {
    return Order.find({ checkoutGroupId: payment.checkoutGroupId })
      .sort({ checkoutGroupIndex: 1, createdAt: 1 });
  }
  if (payment.order) {
    const order = await Order.findById(payment.order);
    return order ? [order] : [];
  }
  return [];
}

async function updateCheckoutGroupPaymentStatus(checkoutGroupId, nextStatus) {
  if (!checkoutGroupId) return;
  if (nextStatus === PAYMENT_STATUS.CAPTURED) {
    await CheckoutGroup.updateOne(
      { checkoutGroupId },
      {
        $set: {
          status: "PAID",
          paymentStatus: ORDER_PAYMENT_STATUS.PAID,
          "stockReservation.status": "COMMITTED",
        },
      },
    );
    return;
  }
  if (nextStatus === PAYMENT_STATUS.FAILED || nextStatus === PAYMENT_STATUS.CANCELLED) {
    await CheckoutGroup.updateOne(
      { checkoutGroupId },
      {
        $set: {
          status: "CANCELLED",
          paymentStatus: ORDER_PAYMENT_STATUS.FAILED,
          "stockReservation.status": "RELEASED",
          "stockReservation.releasedAt": new Date(),
        },
      },
    );
    return;
  }
  if (nextStatus === PAYMENT_STATUS.REFUNDED) {
    await CheckoutGroup.updateOne(
      { checkoutGroupId },
      {
        $set: {
          paymentStatus: ORDER_PAYMENT_STATUS.REFUNDED,
          status: "CANCELLED",
        },
      },
    );
  }
}

async function handleOrderSideEffectsFromPaymentStatus(payment, nextStatus, reason) {
  const orders = await getRelatedOrdersForPayment(payment);
  if (!orders.length) return;

  if (nextStatus === PAYMENT_STATUS.CAPTURED) {
    for (const order of orders) {
      await handleOnlineOrderFinance(order._id, {
        actorId: null,
        transactionId: payment.gatewayPaymentId || "",
        metadata: {
          paymentId: payment._id.toString(),
          checkoutGroupId: payment.checkoutGroupId || null,
        },
      });
      await moveOrderToSellerPendingAfterPayment(order._id);
      emitNotificationEvent(NOTIFICATION_EVENTS.PAYMENT_SUCCESS, {
        orderId: order.orderId,
        checkoutGroupId: payment.checkoutGroupId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
      });

      emitNotificationEvent(NOTIFICATION_EVENTS.NEW_ORDER, {
        orderId: order.orderId,
        sellerId: order.seller,
      });
    }
    await updateCheckoutGroupPaymentStatus(payment.checkoutGroupId, nextStatus);
    return;
  }

  if (nextStatus === PAYMENT_STATUS.FAILED || nextStatus === PAYMENT_STATUS.CANCELLED) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      for (const order of orders) {
        const orderForUpdate = await Order.findById(order._id, null, { session });
        if (
          orderForUpdate &&
          orderForUpdate.workflowStatus === WORKFLOW_STATUS.CREATED &&
          orderForUpdate.status !== "cancelled"
        ) {
          await releaseReservedStockForOrder(orderForUpdate, {
            session,
            reason: reason || "Payment failed",
          });
          orderForUpdate.status = "cancelled";
          orderForUpdate.orderStatus = "cancelled";
          orderForUpdate.workflowStatus = WORKFLOW_STATUS.CANCELLED;
          orderForUpdate.cancelledBy = "system";
          orderForUpdate.cancelReason = reason || "Payment failed";
          orderForUpdate.paymentStatus = ORDER_PAYMENT_STATUS.FAILED;
          await orderForUpdate.save({ session });
        }
      }
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    await updateCheckoutGroupPaymentStatus(payment.checkoutGroupId, nextStatus);
    for (const order of orders) {
      emitNotificationEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
        orderId: order.orderId,
        checkoutGroupId: payment.checkoutGroupId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
        customerMessage: "Order was cancelled because payment failed.",
        sellerMessage: `Order #${order.orderId} was cancelled because payment failed.`,
      });
    }
    return;
  }

  if (nextStatus === PAYMENT_STATUS.REFUNDED) {
    await Order.updateMany(
      { _id: { $in: orders.map((order) => order._id) } },
      {
        $set: {
          paymentStatus: ORDER_PAYMENT_STATUS.REFUNDED,
          "payment.status": "refunded",
        },
      },
    );
    await updateCheckoutGroupPaymentStatus(payment.checkoutGroupId, nextStatus);
    for (const order of orders) {
      await reverseReferralRewardForOrder(order._id, { trigger: "PAYMENT_REFUNDED" });
      emitNotificationEvent(NOTIFICATION_EVENTS.REFUND_COMPLETED, {
        orderId: order.orderId,
        checkoutGroupId: payment.checkoutGroupId,
        customerId: order.customer,
        userId: order.customer,
        sellerId: order.seller,
      });
    }
    return;
  }

  await Order.updateMany(
    { _id: { $in: orders.map((order) => order._id) } },
    {
      $set: {
        paymentStatus: paymentStatusToOrderPaymentStatus(nextStatus),
      },
    },
  );
}

export async function createPaymentOrderForOrderRef({
  orderRef,
  userId,
  idempotencyKey = null,
  correlationId = null,
}) {
  const target = await resolvePaymentTarget(orderRef);
  validatePaymentEligibility(target, userId);
  const primaryOrder = target.primaryOrder;
  const paymentScopeQuery = target.checkoutGroupId
    ? { checkoutGroupId: target.checkoutGroupId }
    : { order: primaryOrder._id };

  if (idempotencyKey) {
    const existingForKey = await Payment.findOne({
      ...paymentScopeQuery,
      idempotencyKey,
    });
    if (existingForKey) {
      return {
        payment: existingForKey,
        provider: existingForKey.gatewayName,
        redirectUrl: existingForKey.rawGatewayResponse?.redirectUrl || null,
        merchantOrderId: existingForKey.gatewayOrderId,
        amount: existingForKey.amount,
        currency: existingForKey.currency,
        duplicate: true,
      };
    }
  }

  const provider = getActivePaymentProvider();

  const existingOpenPayment = await Payment.findOne({
    ...paymentScopeQuery,
    gatewayName: provider.providerName,
    status: {
      $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING],
    },
  }).sort({ createdAt: -1 });

  const isRecentPayment =
    existingOpenPayment &&
    existingOpenPayment.createdAt &&
    Date.now() - new Date(existingOpenPayment.createdAt).getTime() < 10 * 60 * 1000;

  if (
    isRecentPayment &&
    existingOpenPayment.rawGatewayResponse?.redirectUrl
  ) {
    return {
      payment: existingOpenPayment,
      provider: existingOpenPayment.gatewayName,
      redirectUrl: existingOpenPayment.rawGatewayResponse?.redirectUrl || null,
      merchantOrderId: existingOpenPayment.gatewayOrderId,
      amount: existingOpenPayment.amount,
      currency: existingOpenPayment.currency,
      duplicate: true,
    };
  }

  const amountPaise = getPayableAmountPaise(target);
  const currency = String(primaryOrder?.paymentBreakdown?.currency || "INR").toUpperCase();
  const attemptCount = (await Payment.countDocuments(paymentScopeQuery)) + 1;
  const merchantOrderId = buildGatewayMerchantOrderId(
    target.checkoutGroupId || target.publicOrderRef || crypto.randomUUID(),
    attemptCount,
  );

  const frontendBase = String(process.env.FRONTEND_URL || "http://localhost:5173").trim().replace(/\/+$/, "");
  const redirectUrl = `${frontendBase}/payment-status?merchantOrderId=${merchantOrderId}`;

  const initResult = await provider.initiatePayment({
    merchantOrderId,
    amountPaise,
    redirectUrl,
  });

  const paymentData = {
    order: primaryOrder._id,
    orderIds: target.orders.map((order) => order._id),
    checkoutGroupId: target.checkoutGroupId || null,
    publicOrderId: target.publicOrderRef,
    customer: primaryOrder.customer,
    gatewayName: provider.providerName,
    gatewayOrderId: merchantOrderId,
    amount: amountPaise,
    currency,
    status: PAYMENT_STATUS.PENDING,
    attemptCount,
    idempotencyKey: idempotencyKey || undefined,
    correlationId,
    rawGatewayResponse: {
      redirectUrl: initResult.redirectUrl || null,
      merchantOrderId: merchantOrderId,
      amount: amountPaise,
    },
    statusHistory: [
      {
        fromStatus: PAYMENT_STATUS.CREATED,
        toStatus: PAYMENT_STATUS.PENDING,
        source: PAYMENT_EVENT_SOURCE.SYSTEM,
        reason: `${provider.providerName} checkout initiated`,
      },
    ],
  };

  const payment = await Payment.create(paymentData);

  logger.info("payment_order_created", {
    correlationId,
    publicOrderId: payment.publicOrderId,
    paymentId: payment._id.toString(),
    gatewayOrderId: payment.gatewayOrderId,
    amount: payment.amount,
    redirectUrl: initResult.redirectUrl,
    provider: provider.providerName,
  });

  return {
    payment,
    provider: provider.providerName,
    redirectUrl: initResult.redirectUrl || null,
    merchantOrderId: merchantOrderId,
    amount: amountPaise,
    currency,
    duplicate: false,
  };
}

export async function createPaymentOrderForWalletTopup({
  userId,
  amount,
  correlationId = null,
}) {
  const parsedAmount = Number(amount);
  if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
    const err = new Error("Please enter a valid amount greater than ₹0");
    err.statusCode = 400;
    throw err;
  }
  if (parsedAmount > 50000) {
    const err = new Error("Maximum limit per wallet topup is ₹50,000");
    err.statusCode = 400;
    throw err;
  }

  const provider = getActivePaymentProvider();
  const amountPaise = Math.round(parsedAmount * 100);
  const merchantOrderId = buildGatewayMerchantOrderId(
    `WTOPUP-${String(userId || "").slice(-6)}-${Date.now()}`,
    1,
  );

  const frontendBase = String(process.env.FRONTEND_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");
  const redirectUrl = `${frontendBase}/payment-status?merchantOrderId=${merchantOrderId}`;

  const initResult = await provider.initiatePayment({
    merchantOrderId,
    amountPaise,
    redirectUrl,
  });

  const payment = await Payment.create({
    publicOrderId: merchantOrderId,
    customer: userId,
    gatewayName: provider.providerName,
    gatewayOrderId: merchantOrderId,
    amount: amountPaise,
    currency: "INR",
    paymentType: "WALLET_TOPUP",
    status: PAYMENT_STATUS.PENDING,
    rawGatewayResponse: initResult.gatewayResponse || { redirectUrl: initResult.redirectUrl },
    statusHistory: [
      {
        fromStatus: PAYMENT_STATUS.CREATED,
        toStatus: PAYMENT_STATUS.PENDING,
        source: PAYMENT_EVENT_SOURCE.SYSTEM,
        reason: `${provider.providerName} checkout initiated for wallet topup`,
        changedAt: new Date(),
      },
    ],
  });

  logger.info("wallet_topup_payment_created", {
    correlationId,
    userId,
    merchantOrderId,
    amountPaise,
    redirectUrl: initResult.redirectUrl,
  });

  return {
    payment,
    provider: provider.providerName,
    redirectUrl: initResult.redirectUrl,
    merchantOrderId,
    amount: amountPaise,
    currency: "INR",
  };
}

export async function verifyPhonePePaymentStatus({
  merchantOrderId,
  userId,
  userRole = null,
  correlationId = null,
}) {
  const payment = await Payment.findOne({ gatewayOrderId: merchantOrderId });
  if (!payment) {
    const err = new Error("Payment attempt not found");
    err.statusCode = 404;
    throw err;
  }

  // Security check: only reject if an authenticated non-admin user attempts to access someone else's payment
  if (userId && userRole !== "admin" && payment.customer && String(payment.customer) !== String(userId)) {
      const err = new Error("Not authorized to verify this payment");
      err.statusCode = 403;
      throw err;
  }

  const provider = getActivePaymentProvider();
  const statusResp = await provider.getPaymentStatus({ merchantOrderId });
  const nextStatus = provider.mapStatusToInternal(statusResp.state);

  await transitionPaymentState(payment, {
    nextStatus,
    source: PAYMENT_EVENT_SOURCE.CLIENT_VERIFY,
    reason: `${provider.providerName} status check: ${statusResp.state}`,
    gatewayPaymentId: statusResp.transactionId,
    rawGatewayResponse: statusResp.gatewayResponse,
  });

  payment.correlationId = correlationId || payment.correlationId;
  await payment.save();

  // Handle Wallet Top-up specific fulfillment
  if (payment.paymentType === "WALLET_TOPUP" || merchantOrderId.startsWith("WTOPUP-")) {
    if (nextStatus === PAYMENT_STATUS.CAPTURED) {
      const topupAmount = (payment.amount || 0) / 100;
      const existingTx = await Transaction.findOne({
        reference: merchantOrderId,
        status: "Settled",
      });

      if (!existingTx && topupAmount > 0) {
        await creditWallet({
          ownerType: OWNER_TYPE.CUSTOMER,
          ownerId: payment.customer,
          bucket: "available",
          amount: topupAmount,
          ledgerType: LEDGER_TRANSACTION_TYPE.WALLET_TOPUP,
          ledgerReference: merchantOrderId,
          ledgerDescription: `Added ₹${topupAmount} via PhonePe UPI`,
          metadata: {
            source: "phonepe_topup",
            gateway: provider.providerName,
            transactionId: statusResp.transactionId,
            paymentId: payment._id,
            timestamp: new Date(),
          },
        });

        await Transaction.create({
          user: payment.customer,
          userModel: "User",
          type: "Wallet Topup",
          amount: topupAmount,
          status: "Settled",
          reference: merchantOrderId,
          date: new Date(),
          meta: {
            source: "phonepe_gateway",
            paymentMethod: "PhonePe UPI",
            gatewayPaymentId: statusResp.transactionId,
          },
        });
      }
    }

    const orderSummary = {
      merchantOrderId,
      publicOrderId: merchantOrderId,
      isWalletTopup: true,
      amount: payment.amount,
      currency: payment.currency || "INR",
      status: nextStatus,
      paymentMode: "PhonePe UPI",
      paidAt: payment.capturedAt || payment.updatedAt || new Date(),
    };

    return {
      payment,
      status: nextStatus,
      orderSummary,
    };
  }

  await handleOrderSideEffectsFromPaymentStatus(
    payment,
    nextStatus,
    statusResp.responseCode || statusResp.state,
  );

  logger.info("payment_status_verified", {
    correlationId,
    merchantOrderId,
    status: nextStatus,
    provider: provider.providerName,
  });

  // Prepare safe public order summary for receipt display even if session is unauthenticated
  const orders = await getRelatedOrdersForPayment(payment);
  const itemsSummary = [];
  for (const ord of orders) {
    if (Array.isArray(ord.items)) {
      for (const item of ord.items) {
        itemsSummary.push({
          name: item.name || item.product?.name || "Product",
          quantity: item.quantity || 1,
          price: item.price || 0,
          image: item.image || item.product?.mainImage || null,
        });
      }
    }
  }

  const primaryOrder = orders[0] || null;
  const orderSummary = {
    merchantOrderId,
    publicOrderId: payment.publicOrderId || primaryOrder?.orderId || merchantOrderId,
    checkoutGroupId: payment.checkoutGroupId || primaryOrder?.checkoutGroupId || null,
    orderId: primaryOrder?.orderId || null,
    amount: payment.amount,
    currency: payment.currency || "INR",
    status: nextStatus,
    paymentMode: "ONLINE",
    paidAt: payment.capturedAt || payment.updatedAt,
    totalItems: itemsSummary.reduce((acc, curr) => acc + (curr.quantity || 1), 0),
    items: itemsSummary.slice(0, 10),
    address: primaryOrder?.address
      ? {
          name: primaryOrder.address.name,
          address: primaryOrder.address.address,
          city: primaryOrder.address.city,
          pincode: primaryOrder.address.pincode,
        }
      : null,
  };

  return {
    payment,
    status: nextStatus,
    orderSummary,
  };
}

export async function processPhonePeWebhook({
  rawBody,
  authorization,
  correlationId = null,
}) {
  const provider = getActivePaymentProvider();

  const isValid = await provider.validateWebhook({ rawBody, authorization });
  if (!isValid) {
    const err = new Error("Invalid webhook signature");
    err.statusCode = 401;
    throw err;
  }

  const decoded = await provider.decodeWebhookPayload({ rawBody });

  const eventId = decoded.eventId;
  const payloadHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(decoded.raw))
    .digest("hex");
  const eventType = decoded.state || "unknown";

  try {
    await PaymentWebhookEvent.create({
      eventId,
      gatewayName: provider.providerName,
      eventType,
      payloadHash,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return { duplicate: true, accepted: true };
    }
    throw error;
  }

  const merchantOrderId = decoded.merchantOrderId;
  const payment = await Payment.findOne({ gatewayOrderId: merchantOrderId });
  if (!payment) {
    return { accepted: true, ignored: true, reason: "Payment attempt not found" };
  }

  const nextStatus = provider.mapStatusToInternal(decoded.state);
  await transitionPaymentState(payment, {
    nextStatus,
    source: PAYMENT_EVENT_SOURCE.WEBHOOK,
    reason: `${provider.providerName} webhook: ${decoded.state}`,
    gatewayPaymentId: decoded.transactionId,
    rawGatewayResponse: decoded.raw,
  });

  payment.correlationId = correlationId || payment.correlationId;
  await payment.save();

  await PaymentWebhookEvent.updateOne(
    { eventId },
    {
      $set: {
        payment: payment._id,
        publicOrderId: payment.publicOrderId,
      },
    },
  );

  // Handle Wallet Topup webhook
  if (payment.paymentType === "WALLET_TOPUP" || merchantOrderId.startsWith("WTOPUP-")) {
    if (nextStatus === PAYMENT_STATUS.CAPTURED) {
      const topupAmount = (payment.amount || 0) / 100;
      const existingTx = await Transaction.findOne({
        reference: merchantOrderId,
        status: "Settled",
      });

      if (!existingTx && topupAmount > 0) {
        await creditWallet({
          ownerType: OWNER_TYPE.CUSTOMER,
          ownerId: payment.customer,
          bucket: "available",
          amount: topupAmount,
          ledgerType: LEDGER_TRANSACTION_TYPE.WALLET_TOPUP,
          ledgerReference: merchantOrderId,
          ledgerDescription: `Added ₹${topupAmount} via PhonePe Webhook`,
          metadata: {
            source: "phonepe_webhook",
            gateway: provider.providerName,
            transactionId: decoded.transactionId,
            paymentId: payment._id,
            timestamp: new Date(),
          },
        });

        await Transaction.create({
          user: payment.customer,
          userModel: "User",
          type: "Wallet Topup",
          amount: topupAmount,
          status: "Settled",
          reference: merchantOrderId,
          date: new Date(),
          meta: {
            source: "phonepe_webhook",
            paymentMethod: "PhonePe UPI",
            gatewayPaymentId: decoded.transactionId,
          },
        });
      }
    }

    return {
      accepted: true,
      duplicate: false,
      paymentStatus: nextStatus,
      publicOrderId: payment.publicOrderId,
      isWalletTopup: true,
    };
  }

  await handleOrderSideEffectsFromPaymentStatus(
    payment,
    nextStatus,
    decoded.responseCode || decoded.state,
  );

  return {
    accepted: true,
    duplicate: false,
    paymentStatus: nextStatus,
    publicOrderId: payment.publicOrderId,
  };
}

export async function verifyClientPaymentCallback(data) {
  return verifyPhonePePaymentStatus({
    merchantOrderId: data.gatewayOrderId || data.merchantOrderId,
    userId: data.userId,
    correlationId: data.correlationId,
  });
}

