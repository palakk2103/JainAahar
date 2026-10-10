import mongoose from "mongoose";

export const REFERRAL_STATUS = {
  PENDING: "PENDING",
  ELIGIBLE: "ELIGIBLE",
  REWARD_CREDITED: "REWARD_CREDITED",
  INELIGIBLE: "INELIGIBLE",
  // Qualifying order fully returned / refunded / cancelled after credit.
  REWARD_REVERSED: "REWARD_REVERSED",
};

export const ALL_REFERRAL_STATUSES = Object.values(REFERRAL_STATUS);

const rewardSnapshotSchema = new mongoose.Schema(
  {
    // "fixed" | "percentage" — frozen from admin config at credit time.
    type: { type: String, enum: ["fixed", "percentage"], default: null },
    // Configured value (coins for fixed, % for percentage).
    value: { type: Number, default: 0 },
    // Max coins cap for percentage rewards (0 = no cap).
    maxCoins: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    // Coins taken back after a return/refund of the qualifying order.
    reversedCoins: { type: Number, default: 0 },
    // Coins that should have been reversed but the wallet balance was
    // insufficient (already spent). Never pushed below zero.
    unrecoveredCoins: { type: Number, default: 0 },
    ledgerEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerEntry",
      default: null,
    },
  },
  { _id: false },
);

/**
 * One document per referred customer. Created when a new customer signs up
 * with another customer's referral code; reward is credited at most once
 * when that customer's first eligible order is delivered.
 */
const referralSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referred: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ALL_REFERRAL_STATUSES,
      default: REFERRAL_STATUS.PENDING,
      index: true,
    },
    statusReason: { type: String, default: "" },
    qualifyingOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    qualifyingOrderId: { type: String, default: null },
    // Amount the percentage was calculated on (net item value).
    purchaseAmount: { type: Number, default: 0 },
    referrerReward: { type: rewardSnapshotSchema, default: () => ({}) },
    referredReward: { type: rewardSnapshotSchema, default: () => ({}) },
    eligibleAt: { type: Date, default: null },
    creditedAt: { type: Date, default: null },
    // Minimum order value in force when the reward was credited; used to
    // decide whether a partial return still qualifies.
    minOrderValueSnapshot: { type: Number, default: null },
    // Optimistic-lock counter for reversals (prevents double reversal).
    reversalVersion: { type: Number, default: 0 },
    reversedAt: { type: Date, default: null },
    reversals: [
      {
        _id: false,
        trigger: String,
        keptAmount: Number,
        referrerCoins: Number,
        referredCoins: Number,
        referrerUnrecovered: Number,
        referredUnrecovered: Number,
        at: Date,
      },
    ],
  },
  { timestamps: true },
);

// A customer can only ever be referred once.
referralSchema.index({ referred: 1 }, { unique: true, name: "idx_referral_referred_unique" });
referralSchema.index({ status: 1, createdAt: -1 });
referralSchema.index({ referrer: 1, createdAt: -1 });
referralSchema.index({ qualifyingOrder: 1 });

export default mongoose.model("Referral", referralSchema);
