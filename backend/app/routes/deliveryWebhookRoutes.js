import express from "express";
import { getRegisteredProvider } from "../modules/delivery/deliveryProviderRegistry.js";
import { deliveryWebhookQueue } from "../queues/deliveryQueues.js";
import { isRedisEnabled } from "../config/redis.js";
import { processDeliveryWebhook } from "../modules/delivery/webhooks/webhookProcessor.js";
import logger from "../services/logger.js";

const router = express.Router();

/**
 * POST /api/delivery/webhook/:provider
 * Fast webhook ingestion route — verifies signature and enqueues payload for processing
 */
router.post("/webhook/:provider", async (req, res) => {
  const providerName = req.params.provider?.toLowerCase();
  const provider = getRegisteredProvider(providerName);

  if (!provider) {
    logger.warn({ domain: "delivery", provider: providerName }, "Webhook hit for unmapped provider");
    return res.status(404).json({ success: false, message: "Provider not found" });
  }

  const rawBody = req.rawBody || req.body;
  const headers = req.headers;

  const isValid = provider.verifyWebhookSignature(rawBody, headers);
  if (!isValid) {
    logger.warn({ domain: "delivery", provider: providerName }, "Webhook signature validation failed");
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }

  try {
    // Queue only when a real (Redis-backed) queue exists; the no-op queue used
    // without Redis also has `add`, which would silently drop the webhook.
    if (isRedisEnabled() && deliveryWebhookQueue && typeof deliveryWebhookQueue.add === "function") {
      await deliveryWebhookQueue.add({
        providerName,
        rawBody: typeof rawBody === "string" ? rawBody : (Buffer.isBuffer(rawBody) ? rawBody.toString("utf-8") : JSON.stringify(rawBody)),
        headers,
      });
    } else {
      await processDeliveryWebhook({ providerName, rawBody, headers });
    }

    // Always respond 200 OK within 3s
    return res.status(200).json({ success: true, message: "Webhook accepted" });
  } catch (err) {
    logger.error({ domain: "delivery", provider: providerName, error: err.message }, "Webhook ingestion error");
    return res.status(200).json({ success: true, message: "Webhook received" });
  }
});

export default router;
