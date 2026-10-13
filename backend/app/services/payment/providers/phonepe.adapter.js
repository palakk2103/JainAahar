/**
 * PhonePeAdapter
 *
 * Single home for the PhonePe SDK in the codebase. paymentService.js calls
 * only this adapter (through the providerRegistry) and never imports
 * `@phonepe-pg/pg-sdk-node` directly.
 *
 * Swap-out is a one-line change in providerRegistry.js + a new adapter file
 * implementing the same `PaymentProviderPort` contract.
 */

import crypto from "crypto";
import * as PhonePeSDK from "@phonepe-pg/pg-sdk-node";
const {
  StandardCheckoutClient,
  Env,
  StandardCheckoutPayRequest,
  RefundRequest,
} = PhonePeSDK;

import logger from "../../logger.js";
import { PAYMENT_STATUS, PAYMENT_GATEWAY } from "../../../constants/payment.js";
import { PaymentProviderPort } from "../ports/paymentProviderPort.js";

let _phonePeClient = null;

function buildPhonePeClient() {
  const clientId = String(process.env.PHONEPE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.PHONEPE_CLIENT_SECRET || "").trim();
  const clientVersion = parseInt(process.env.PHONEPE_CLIENT_VERSION || "1", 10);
  const isProd =
    String(process.env.PHONEPE_ENV || "").toUpperCase() === "PRODUCTION";

  if (!clientId || !clientSecret) {
    throw new Error("PhonePe credentials not configured");
  }

  return StandardCheckoutClient.getInstance(
    clientId,
    clientSecret,
    clientVersion,
    isProd ? Env.PRODUCTION : Env.SANDBOX,
  );
}

function getPhonePeClient() {
  if (_phonePeClient) return _phonePeClient;
  _phonePeClient = buildPhonePeClient();
  return _phonePeClient;
}

export class PhonePeAdapter extends PaymentProviderPort {
  get providerName() {
    return PAYMENT_GATEWAY.PHONEPE;
  }

  async initiatePayment({ merchantOrderId, amountPaise, redirectUrl }) {
    try {
      const client = getPhonePeClient();
      const request = StandardCheckoutPayRequest.builder()
        .merchantOrderId(merchantOrderId)
        .amount(amountPaise)
        .redirectUrl(redirectUrl)
        .build();
      const response = await client.pay(request);
      if (!response?.redirectUrl) {
        throw new Error(response?.message || "PhonePe did not return a valid redirect URL");
      }
      return {
        redirectUrl: response.redirectUrl,
        gatewayResponse: response,
      };
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to initiate payment with PhonePe";
      const err = new Error(message);
      err.statusCode = error?.response?.status || 502;
      throw err;
    }
  }

  async getPaymentStatus({ merchantOrderId }) {
    const client = getPhonePeClient();
    try {
      const response = await client.getOrderStatus(merchantOrderId);
      const lastPayment =
        Array.isArray(response.paymentDetails) && response.paymentDetails.length > 0
          ? response.paymentDetails[response.paymentDetails.length - 1]
          : null;

      const transactionId =
        lastPayment?.transactionId || response.transactionId || response.orderId || null;
      const responseCode =
        response.errorCode || response.detailedErrorCode || response.responseCode || response.state;

      return {
        state: response.state,
        transactionId,
        responseCode,
        gatewayResponse: response,
      };
    } catch (error) {
      logger.warn("PhonePe getOrderStatus error", {
        merchantOrderId,
        error: error?.message,
        data: error?.response?.data,
      });
      const gatewayState =
        error?.response?.data?.state ||
        error?.response?.data?.code ||
        error?.response?.data?.data?.state ||
        "FAILED";
      return {
        state: gatewayState,
        transactionId: null,
        responseCode: error?.message || "GATEWAY_ERROR",
        gatewayResponse: error?.response?.data || null,
      };
    }
  }

  async refundPayment({ originalMerchantOrderId, amountPaise, merchantRefundId }) {
    const client = getPhonePeClient();
    const refundId =
      merchantRefundId ||
      `REF_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    try {
      const request = RefundRequest.builder()
        .merchantRefundId(refundId)
        .originalMerchantOrderId(originalMerchantOrderId)
        .amount(amountPaise)
        .build();

      const response = await client.refund(request);
      return {
        success: true,
        merchantRefundId: refundId,
        refundId: response?.refundId || refundId,
        state: response?.state || "COMPLETED",
        amount: response?.amount || amountPaise,
        gatewayResponse: response,
      };
    } catch (error) {
      logger.error("PhonePe refund failed", {
        scope: "PhonePeAdapter.refundPayment",
        originalMerchantOrderId,
        refundId,
        amountPaise,
        message: error?.message,
      });
      throw error;
    }
  }

  async validateWebhook({ rawBody, authorization }) {
    const client = getPhonePeClient();
    const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "");

    const username = String(process.env.PHONEPE_WEBHOOK_USERNAME || "").trim();
    const password = String(process.env.PHONEPE_WEBHOOK_PASSWORD || "").trim();

    if (username && password) {
      try {
        client.validateCallback(username, password, authorization, rawString);
        return true;
      } catch {
        return false;
      }
    }

    // Fallback: If webhook username/password not configured in env, ensure authorization header is present
    return Boolean(authorization);
  }

  async decodeWebhookPayload({ rawBody }) {
    const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "");
    let jsonPayload;
    try {
      jsonPayload = JSON.parse(rawString);
    } catch {
      const err = new Error("Invalid format: Webhook body must be JSON");
      err.statusCode = 400;
      throw err;
    }

    let payload = jsonPayload;

    // Support PhonePe v1 legacy base64 format if received
    if (jsonPayload.response && typeof jsonPayload.response === "string") {
      try {
        payload = JSON.parse(Buffer.from(jsonPayload.response, "base64").toString("utf8"));
      } catch {
        const err = new Error("Invalid webhook payload: Base64 decode failed");
        err.statusCode = 400;
        throw err;
      }
    } else if (jsonPayload.payload && typeof jsonPayload.payload === "object") {
      // PhonePe v2 standard format
      payload = jsonPayload.payload;
    }

    const lastPayment =
      Array.isArray(payload.paymentDetails) && payload.paymentDetails.length > 0
        ? payload.paymentDetails[payload.paymentDetails.length - 1]
        : null;

    const transactionId =
      payload.transactionId || lastPayment?.transactionId || payload.orderId || null;
    const merchantOrderId =
      payload.merchantOrderId || payload.originalMerchantOrderId || jsonPayload.merchantOrderId || null;
    const state = payload.state || jsonPayload.type || "PENDING";
    const responseCode =
      payload.errorCode || payload.detailedErrorCode || payload.responseCode || state;

    // Stable eventId derivation for idempotency deduplication (H-4)
    const stableEventId =
      transactionId ||
      crypto
        .createHash("sha256")
        .update(`${merchantOrderId || ""}|${state || ""}|${JSON.stringify(payload)}`)
        .digest("hex");

    return {
      eventId: stableEventId,
      merchantOrderId,
      state,
      transactionId,
      responseCode,
      raw: jsonPayload,
    };
  }

  mapStatusToInternal(gatewayState) {
    const normalized = String(gatewayState || "").toUpperCase();
    if (
      normalized === "COMPLETED" ||
      normalized === "SUCCESS" ||
      normalized === "PG_ORDER_COMPLETED"
    ) {
      return PAYMENT_STATUS.CAPTURED;
    }
    if (
      normalized === "FAILED" ||
      normalized === "FAILURE" ||
      normalized === "PG_ORDER_FAILED" ||
      normalized === "CANCELLED" ||
      normalized === "USER_CANCELLED" ||
      normalized === "DECLINED" ||
      normalized === "TIMED_OUT" ||
      normalized === "EXPIRED" ||
      normalized === "PAYMENT_ERROR" ||
      normalized === "TRANSACTION_NOT_FOUND" ||
      normalized === "BAD_REQUEST" ||
      normalized === "AUTHORIZATION_FAILED" ||
      normalized === "PAYMENT_DECLINED" ||
      normalized === "PAYMENT_CANCELLED" ||
      normalized === "ORDER_FAILED"
    ) {
      return PAYMENT_STATUS.FAILED;
    }
    if (
      normalized === "PENDING" ||
      normalized === "CREATED" ||
      normalized === "ATTEMPTED" ||
      normalized === "WAITING_FOR_PAYMENT" ||
      normalized === "PAYMENT_PENDING"
    ) {
      return PAYMENT_STATUS.PENDING;
    }
    return PAYMENT_STATUS.PENDING;
  }
}

export default PhonePeAdapter;
