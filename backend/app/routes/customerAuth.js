import express from "express";
import {
    signupCustomer,
    loginCustomer,
    verifyCustomerOTP,
    getCustomerProfile,
    updateCustomerProfile,
    deleteCustomerAccount,
    getCustomerTransactions,
    addCustomerWalletMoney,
} from "../controller/customerAuthController.js";
import { createWalletPaymentOrder } from "../controller/paymentController.js";
import {
    getMyReferral,
    getReferralProgram,
    validateReferralCode,
} from "../controller/referralController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
    authRouteRateLimiter,
    createContentLengthGuard,
    otpRouteRateLimiter,
} from "../middleware/securityMiddlewares.js";

const router = express.Router();
const smallAuthPayload = createContentLengthGuard(
    parseInt(process.env.AUTH_MAX_PAYLOAD_BYTES || "16384", 10),
    "Auth payload too large",
);
router.post("/send-signup-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, signupCustomer);
router.post("/send-login-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, loginCustomer);
router.post("/verify-otp", authRouteRateLimiter, otpRouteRateLimiter, smallAuthPayload, verifyCustomerOTP);

// Profile routes
router.get("/profile", verifyToken, getCustomerProfile);
router.put("/profile", verifyToken, updateCustomerProfile);
router.delete("/profile", verifyToken, deleteCustomerAccount);
router.delete("/account", verifyToken, deleteCustomerAccount);

// Wallet
router.get("/transactions", verifyToken, getCustomerTransactions);
router.post("/wallet/add-money", verifyToken, createWalletPaymentOrder);
router.post("/wallet/create-payment-order", verifyToken, createWalletPaymentOrder);
router.post("/create-wallet-order", verifyToken, createWalletPaymentOrder);

// Refer & Earn
router.get("/referral/program", getReferralProgram);
router.get("/referral/validate/:code", authRouteRateLimiter, validateReferralCode);
router.get("/referral", verifyToken, getMyReferral);

export default router;
