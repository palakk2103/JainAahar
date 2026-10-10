import mongoose from "mongoose";

export const REFERRAL_AUDIT_ACTION = {
  CODE_GENERATED: "CODE_GENERATED",
  CODE_VALIDATION_FAILED: "CODE_VALIDATION_FAILED",
  REFERRAL_CREATED: "REFERRAL_CREATED",
  ORDER_INELIGIBLE: "ORDER_INELIGIBLE",
  REWARD_CALCULATED: "REWARD_CALCULATED",
  COINS_CREDITED: "COINS_CREDITED",
  CREDIT_FAILED: "CREDIT_FAILED",
  MARKED_INELIGIBLE: "MARKED_INELIGIBLE",
  COINS_REVERSED: "COINS_REVERSED",
  REVERSAL_FAILED: "REVERSAL_FAILED",
  SETTINGS_UPDATED: "SETTINGS_UPDATED",
};

/**
 * Append-only trail for the referral program: validation failures,
 * reward calculations and coin credits. Never updated after insert.
 */
const referralAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: Object.values(REFERRAL_AUDIT_ACTION),
      required: true,
      index: true,
    },
    referral: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Referral",
      default: null,
      index: true,
    },
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    referred: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    referralCode: { type: String, default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    orderId: { type: String, default: null },
    actorType: { type: String, default: "SYSTEM" },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    message: { type: String, default: "" },
    details: { type: Object, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

referralAuditLogSchema.index({ createdAt: -1 });

export default mongoose.model("ReferralAuditLog", referralAuditLogSchema);
