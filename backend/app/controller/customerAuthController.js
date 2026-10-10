import Customer from "../models/customer.js";
import Cart from "../models/cart.js";
import Wishlist from "../models/wishlist.js";
import Transaction from "../models/transaction.js";
import LedgerEntry from "../models/ledgerEntry.js";
import Payment from "../models/payment.js";
import jwt from "jsonwebtoken";
import handleResponse from "../utils/helper.js";
import { creditWallet } from "../services/finance/walletService.js";
import { createPaymentOrderForWalletTopup } from "../services/paymentService.js";
import { OWNER_TYPE, LEDGER_TRANSACTION_TYPE } from "../constants/finance.js";
import { applyPendingReferral } from "../services/referralService.js";
import {
    issueCustomerOtp,
    sanitizeCustomer,
    verifyCustomerOtpCode,
} from "../services/otpAuthService.js";
import {
    sendLoginOtpSchema,
    sendSignupOtpSchema,
    validateSchema,
    verifyOtpSchema,
} from "../validation/customerAuthValidation.js";

const generateToken = (customer) =>
    jwt.sign(
        { id: customer._id, role: "customer" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

/* ===============================
   SIGNUP – Send OTP
================================ */
export const signupCustomer = async (req, res) => {
    try {
        const payload = validateSchema(sendSignupOtpSchema, req.body || {});

        await issueCustomerOtp({
            name: payload.name,
            rawPhone: payload.phone,
            email: payload.email,
            flow: "signup",
            referralCode: payload.referralCode,
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "OTP has been sent successfully");
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   LOGIN – Send OTP
================================ */
export const loginCustomer = async (req, res) => {
    try {
        const payload = validateSchema(sendLoginOtpSchema, req.body || {});

        await issueCustomerOtp({
            rawPhone: payload.phone,
            email: payload.email,
            flow: "login",
            ipAddress: req.ip,
        });

        return handleResponse(res, 200, "OTP has been sent successfully");
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   VERIFY OTP – Login / Signup
================================ */
export const verifyCustomerOTP = async (req, res) => {
    try {
        const payload = validateSchema(verifyOtpSchema, req.body || {});
        const customer = await verifyCustomerOtpCode({
            rawPhone: payload.phone,
            email: payload.email,
            otp: payload.otp,
            ipAddress: req.ip,
        });
        const token = generateToken(customer);
        // Refer & Earn: apply a code entered at signup now that ownership of
        // the phone/email is proven. Never blocks login.
        const referral = await applyPendingReferral(customer._id);

        return handleResponse(
            res,
            200,
            "Login successful",
            {
                token,
                customer: sanitizeCustomer(customer),
                ...(referral ? { referral } : {}),
            }
        );
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   GET PROFILE
================================ */
export const getCustomerProfile = async (req, res) => {
    try {
        const customer = await Customer.findById(req.user.id).lean();
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }
        return handleResponse(res, 200, "Profile fetched successfully", customer);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   UPDATE PROFILE
================================ */
export const updateCustomerProfile = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            bio,
            addresses,
            avatar,
            avatarUrl,
            whatsappPhone,
            whatsappNotificationsEnabled,
            whatsappPreferences,
        } = req.body;

        const customer = await Customer.findById(req.user.id);
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }

        if (name !== undefined) customer.name = name;
        if (email !== undefined) customer.email = email;
        if (phone !== undefined) customer.phone = phone;
        if (bio !== undefined) customer.bio = bio;
        if (addresses !== undefined) customer.addresses = addresses;
        if (avatar !== undefined) customer.avatar = avatar;
        else if (avatarUrl !== undefined) customer.avatar = avatarUrl;
        if (whatsappPhone !== undefined) customer.whatsappPhone = whatsappPhone;
        if (whatsappNotificationsEnabled !== undefined) {
            customer.whatsappNotificationsEnabled = Boolean(whatsappNotificationsEnabled);
        }
        if (whatsappPreferences !== undefined) {
            customer.whatsappPreferences = {
                ...customer.whatsappPreferences,
                ...whatsappPreferences,
            };
        }

        await customer.save();

        return handleResponse(res, 200, "Profile updated successfully", sanitizeCustomer(customer));
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   DELETE ACCOUNT
================================ */
export const deleteCustomerAccount = async (req, res) => {
    try {
        const customer = await Customer.findById(req.user.id);
        if (!customer) {
            return handleResponse(res, 404, "Customer not found");
        }

        // Clean up Cart and Wishlist
        await Promise.allSettled([
            Cart.deleteMany({ customerId: req.user.id }),
            Wishlist.deleteMany({ customerId: req.user.id }),
            Customer.findByIdAndDelete(req.user.id)
        ]);

        return handleResponse(res, 200, "Account deleted successfully");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   GET WALLET TRANSACTIONS
================================ */
export const getCustomerTransactions = async (req, res) => {
    try {
        const customerId = req.user?.id || req.user?._id || req.user?.userId;
        const { page = 1, limit = 50 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10));
        const perPage = Math.min(100, Math.max(1, parseInt(limit, 10)));
        const skip = (pageNum - 1) * perPage;

        // 1. Fetch from Transaction collection
        const legacyTxs = await Transaction.find({
            $or: [
                { user: customerId },
                { "meta.customerId": customerId },
                { "meta.userId": customerId },
            ],
        })
            .sort({ createdAt: -1, date: -1 })
            .populate("order", "orderId")
            .lean()
            .catch(() => []);

        // 2. Fetch from LedgerEntry collection
        const ledgerEntries = await LedgerEntry.find({
            actorId: customerId,
            actorType: OWNER_TYPE.CUSTOMER,
        })
            .sort({ createdAt: -1 })
            .populate("orderId", "orderId")
            .lean()
            .catch(() => []);

        // 3. Fetch from Payment collection (for any wallet topups)
        const walletPayments = await Payment.find({
            customer: customerId,
            paymentType: "WALLET_TOPUP",
            status: { $in: ["CAPTURED", "SUCCESS", "COMPLETED"] },
        })
            .sort({ createdAt: -1 })
            .lean()
            .catch(() => []);

        const allItemsMap = new Map();

        // Process legacy transactions
        for (const t of (legacyTxs || [])) {
            const refKey = t.reference || String(t._id);
            const rawType = String(t.type || "").trim();
            const isCredit =
                rawType === "Refund" ||
                rawType === "Wallet Topup" ||
                rawType === "Wallet Refund" ||
                rawType === "Incentive" ||
                rawType === "Bonus" ||
                (t.amount || 0) > 0;

            let displayTitle = rawType;
            if (rawType === "Wallet Topup") displayTitle = "Money Added";
            else if (rawType === "Refund" || rawType === "Wallet Refund") displayTitle = "Refund Credited";
            else if (rawType === "Wallet Payment" || rawType === "Order Payment") displayTitle = "Order Payment";
            else if (rawType === "Incentive" || rawType === "Bonus") displayTitle = "Bonus Credited";

            allItemsMap.set(refKey, {
                _id: t._id,
                type: isCredit ? "credit" : "debit",
                title: displayTitle,
                amount: Math.abs(t.amount || 0),
                date: t.date || t.createdAt || new Date(),
                reference: t.reference,
                orderId: t.order?.orderId || t.orderId || null,
                paymentMethod: t.meta?.paymentMethod || (rawType === "Wallet Topup" ? "PhonePe UPI" : null),
                createdAt: t.createdAt || t.date || new Date(),
            });
        }

        // Process ledger entries
        for (const l of (ledgerEntries || [])) {
            const refKey = l.reference || l.transactionId || String(l._id);
            if (!allItemsMap.has(refKey)) {
                const isCredit = l.direction === "CREDIT";
                let displayTitle = "Wallet Transaction";
                if (l.type === "WALLET_TOPUP") displayTitle = "Money Added";
                else if (l.type === "REFUND") displayTitle = "Refund Credited";
                else if (l.type === "WALLET_REDEMPTION_AT_CHECKOUT" || l.type === "ORDER_PAYMENT") displayTitle = "Order Payment";
                else if (l.type === "REFERRAL_REWARD") displayTitle = l.metadata?.side === "REFERRER" ? "Referral Reward (Friend joined)" : "Referral Welcome Reward";
                else if (l.type === "REFERRAL_REWARD_REVERSAL") displayTitle = "Referral Coins Reversed (Order returned)";

                allItemsMap.set(refKey, {
                    _id: l._id,
                    type: isCredit ? "credit" : "debit",
                    title: displayTitle,
                    amount: Math.abs(l.amount || 0),
                    date: l.createdAt || new Date(),
                    reference: refKey,
                    orderId: l.orderId?.orderId || l.orderId || null,
                    paymentMethod: l.type === "REFERRAL_REWARD" || l.type === "REFERRAL_REWARD_REVERSAL"
                        ? "Refer & Earn coins"
                        : l.paymentMode || l.metadata?.paymentMethod || "PhonePe UPI",
                    ...(l.type === "REFERRAL_REWARD" || l.type === "REFERRAL_REWARD_REVERSAL"
                        ? { category: "referral", coins: Math.abs(l.amount || 0) }
                        : {}),
                    createdAt: l.createdAt || new Date(),
                });
            }
        }

        // Process any wallet topup payments that might not be in Transaction yet
        for (const p of (walletPayments || [])) {
            const refKey = p.gatewayOrderId || p.publicOrderId || String(p._id);
            if (!allItemsMap.has(refKey)) {
                allItemsMap.set(refKey, {
                    _id: p._id,
                    type: "credit",
                    title: "Money Added",
                    amount: (p.amount || 0) / 100,
                    date: p.capturedAt || p.updatedAt || p.createdAt || new Date(),
                    reference: refKey,
                    orderId: null,
                    paymentMethod: p.gatewayName === "PHONEPE" ? "PhonePe UPI" : p.gatewayName,
                    createdAt: p.createdAt || new Date(),
                });
            }
        }

        // Sort by date / createdAt descending (newest first)
        const sortedItems = Array.from(allItemsMap.values()).sort((a, b) => {
            return new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime();
        });

        const total = sortedItems.length;
        const paginatedItems = sortedItems.slice(skip, skip + perPage);

        return handleResponse(res, 200, "Transactions fetched", {
            items: paginatedItems,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / perPage) || 1,
        });
    } catch (error) {
        console.error("Error fetching customer transactions:", error);
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   ADD WALLET MONEY (TOPUP)
================================ */
export const addCustomerWalletMoney = async (req, res) => {
    try {
        const customerId = req.user?.id || req.user?._id || req.user?.userId;
        const { amount } = req.body || {};
        const result = await createPaymentOrderForWalletTopup({
            userId: customerId,
            amount,
            correlationId: req.correlationId || null,
        });

        return handleResponse(
            res,
            201,
            "Wallet payment initiated",
            {
                payment: result.payment,
                provider: result.provider,
                redirectUrl: result.redirectUrl,
                merchantOrderId: result.merchantOrderId,
                amount: result.amount,
                currency: result.currency,
            },
        );
    } catch (error) {
        console.error("Error adding wallet money:", error);
        return handleResponse(res, error.statusCode || error.status || 500, error.message || "Failed to initiate payment");
    }
};
