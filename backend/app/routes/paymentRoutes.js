import express from "express";
import {
  createPaymentOrder,
  createWalletPaymentOrder,
  verifyPaymentStatus,
  handlePhonePeWebhook,
} from "../controller/paymentController.js";
import { verifyToken, optionalVerifyToken } from "../middleware/authMiddleware.js";
import { paymentRouteRateLimiter } from "../middleware/securityMiddlewares.js";

const paymentRoute = express.Router();

/**
 * Initiate a PhonePe payment order for a specific CheckoutGroupId or OrderId.
 * Auth: Required (Customer paying for their own order)
 */
paymentRoute.post(
  "/create-order",
  verifyToken,
  paymentRouteRateLimiter,
  createPaymentOrder,
);

/**
 * Initiate a PhonePe payment order for Wallet Top-up.
 * Auth: Required
 */
paymentRoute.post(
  "/create-wallet-order",
  verifyToken,
  paymentRouteRateLimiter,
  createWalletPaymentOrder,
);

/**
 * Verify payment status from client side (PhonePe redirect or status check).
 * Auth: Optional (allows seamless verification upon return from gateway redirects)
 */
paymentRoute.get(
  "/status/:id",
  optionalVerifyToken,
  paymentRouteRateLimiter,
  verifyPaymentStatus,
);

/**
 * PhonePe Server-to-Server Webhook.
 * Auth: None (Internal verification via x-verify / authorization header)
 */
paymentRoute.get("/webhook/phonepe", (req, res) => {
  return res.status(200).json({
    status: "ok",
    message: "PhonePe webhook endpoint is active and listening for POST notifications",
  });
});

paymentRoute.post(
  "/webhook/phonepe",
  express.raw({ type: "application/json" }), // SDK needs raw body for verification
  handlePhonePeWebhook,
);

export default paymentRoute;
