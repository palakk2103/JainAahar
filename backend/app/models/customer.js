import mongoose from "mongoose";
import { normalizePhoneNumber } from "../utils/phone.js";

const addressSchema = new mongoose.Schema({
    label: {
        type: String,
        enum: ["home", "work", "other"],
        default: "home",
    },
    fullAddress: {
        type: String,
        required: true,
    },
    formattedAddress: String,
    placeId: String,
    landmark: String,
    city: String,
    state: String,
    pincode: String,
    location: {
        lat: Number,
        lng: Number,
    },
});

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
        },

        email: {
            type: String,
            lowercase: true,
            trim: true,
        },

        phone: {
            type: String,
            required: false,
            trim: true,
        },

        avatar: {
            type: String,
            default: "",
            trim: true,
        },

        bio: {
            type: String,
            default: "",
            trim: true,
        },

        password: {
            type: String,
            select: false, // response me password na aaye
        },

        role: {
            type: String,
            enum: ["user", "admin", "delivery", "seller"],
            default: "user",
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        otp: {
            type: String,
            select: false,
        },

        otpExpiry: {
            type: Date,
            select: false,
        },

        otpHash: {
            type: String,
            select: false,
        },

        otpExpiresAt: {
            type: Date,
            select: false,
        },

        otpFailedAttempts: {
            type: Number,
            default: 0,
            select: false,
        },

        otpLockedUntil: {
            type: Date,
            select: false,
        },

        otpLastSentAt: {
            type: Date,
            select: false,
        },

        otpSessionVersion: {
            type: Number,
            default: 0,
            select: false,
        },

        addresses: [addressSchema],

        /**
         * @deprecated Phase 4 (P4-7). Use the canonical
         * `Wallet({ownerType:"CUSTOMER", ownerId:<userId>}).availableBalance`
         * via `walletService.getCustomerBalance(userId)` instead.
         *
         * This field remains as a denormalised read-cache for
         * frontend backwards compatibility. Every Wallet credit / debit
         * for a customer now $inc's this field in the same Mongo session
         * (Phase 4 P4-3) so the two stay aligned. Will be removed in
         * Phase 7 after every read site has migrated.
         */
        walletBalance: {
            type: Number,
            default: 0,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            default: null,
        },

        // Customer-to-customer Refer & Earn code (generated lazily).
        referralCode: {
            type: String,
            uppercase: true,
            trim: true,
            default: undefined,
        },

        // Customer referral code entered at signup; applied once the OTP
        // is verified (proves ownership of the phone/email).
        pendingReferralCode: {
            type: String,
            uppercase: true,
            trim: true,
            default: undefined,
            select: false,
        },

        lastLogin: Date,

        // WhatsApp notification preferences
        whatsappPhone: {
            type: String,
            required: false,
            trim: true,
        },

        whatsappNotificationsEnabled: {
            type: Boolean,
            default: true,
        },

        whatsappPreferences: {
            orderUpdates: { type: Boolean, default: true },
            deliveryUpdates: { type: Boolean, default: true },
            promotions: { type: Boolean, default: false },
        },
    },
    {
        timestamps: true,
    }
);

userSchema.index({ role: 1, isActive: 1 });

// Partial unique indexes ensure only non-empty strings are indexed.
// Omitted or undefined phone (email users) or email (phone users) never conflict.
userSchema.index(
    { email: 1 },
    {
        unique: true,
        partialFilterExpression: { email: { $type: "string", $gt: "" } },
        name: "idx_user_email_unique",
    }
);

userSchema.index(
    { phone: 1 },
    {
        unique: true,
        partialFilterExpression: { phone: { $type: "string", $gt: "" } },
        name: "idx_user_phone_unique",
    }
);

userSchema.index(
    { referralCode: 1 },
    {
        unique: true,
        partialFilterExpression: { referralCode: { $type: "string" } },
        name: "idx_user_referral_code_unique",
    }
);

userSchema.pre("validate", function(next) {
    if (this.phone && typeof this.phone === "string" && this.phone.trim().length > 0) {
        this.phone = normalizePhoneNumber(this.phone);
    } else {
        this.phone = undefined;
    }

    if (this.email && typeof this.email === "string" && this.email.trim().length > 0) {
        this.email = this.email.trim().toLowerCase();
    } else {
        this.email = undefined;
    }
    next();
});

// Phase 4 P4-8 — reverse virtual to the canonical Wallet document.
//
// Usage:
//   const user = await User.findById(id).populate("wallet");
//   user.wallet.availableBalance  // canonical
//
// This is opt-in via .populate() — existing queries that don't reference
// `wallet` see zero behavioural change.
userSchema.virtual("wallet", {
    ref: "Wallet",
    localField: "_id",
    foreignField: "ownerId",
    justOne: true,
    match: { ownerType: "CUSTOMER" },
});

// Make sure virtuals surface in `.toJSON()` / `.toObject()` so the
// frontend can read them once it migrates.
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

export default mongoose.model("User", userSchema);
