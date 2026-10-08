import axios from "axios";
import WhatsAppLog from "../models/whatsappLog.js";
import WhatsAppSetting from "../models/whatsappSetting.js";
import User from "../models/customer.js";
import {
  WHATSAPP_EVENTS,
  WHATSAPP_TEMPLATES,
  WHATSAPP_MESSAGE_STATUS,
  DEFAULT_WHATSAPP_EVENT_TOGGLES,
  EVENT_TO_SETTING_KEY,
} from "../constants/whatsapp.js";
import { getRedisClient } from "../config/redis.js";
import logger from "./logger.js";

// Customer-facing fallback link, sent over WhatsApp when a shipment has no
// tracking id yet. Must be a live public URL.
const PUBLIC_SITE_URL = String(
  process.env.PUBLIC_SITE_URL || "https://jainaahar.in",
)
  .trim()
  .replace(/\/+$/, "");

// Local in-memory deduplication store fallback
const localDedupeMap = new Map();
let cachedSettings = null;
let settingsCacheExpiry = 0;

/**
 * Normalizes phone number into WhatsApp international format (e.g. 919876543210)
 */
export function formatWhatsAppNumber(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/\D/g, "");
  // If 10 digits (standard Indian mobile), prefix with country code 91
  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  }
  // If starts with 0 and has 11 digits, replace leading 0 with 91
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = `91${cleaned.slice(1)}`;
  }
  return cleaned;
}

/**
 * Masks phone number for safe display in logs and UI (e.g. +91 98****3210)
 */
export function maskPhoneNumber(phone) {
  if (!phone) return "";
  const str = String(phone).trim();
  if (str.length <= 4) return str;
  const visiblePrefix = str.slice(0, 4);
  const visibleSuffix = str.slice(-4);
  return `${visiblePrefix}****${visibleSuffix}`;
}

/**
 * Retrieve active WhatsApp integration settings (with caching)
 */
export async function getWhatsAppSettings() {
  const now = Date.now();
  if (cachedSettings && settingsCacheExpiry > now) {
    return cachedSettings;
  }

  try {
    let settingDoc = await WhatsAppSetting.findOne().lean();
    if (!settingDoc) {
      settingDoc = await WhatsAppSetting.create({
        enabled: String(process.env.WHATSAPP_ENABLED ?? "true").toLowerCase() !== "false",
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
        businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
        eventToggles: { ...DEFAULT_WHATSAPP_EVENT_TOGGLES },
      });
      settingDoc = settingDoc.toObject ? settingDoc.toObject() : settingDoc;
    }
    cachedSettings = settingDoc;
    settingsCacheExpiry = now + 10000; // 10 second cache
    return cachedSettings;
  } catch (err) {
    logger.warn("Failed to fetch WhatsApp settings, using defaults", { error: err.message });
    return {
      enabled: String(process.env.WHATSAPP_ENABLED ?? "true").toLowerCase() !== "false",
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
      eventToggles: { ...DEFAULT_WHATSAPP_EVENT_TOGGLES },
    };
  }
}

/**
 * Clears settings cache on admin updates
 */
export function invalidateWhatsAppSettingsCache() {
  cachedSettings = null;
  settingsCacheExpiry = 0;
}

/**
 * Checks if mock mode should be used
 */
function isMockMode() {
  const mockEnv = String(process.env.WHATSAPP_MOCK_MODE || "").toLowerCase();
  if (mockEnv === "true") return true;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId || token === "your_meta_system_user_access_token" || phoneId === "your_phone_number_id") {
    return true;
  }
  return false;
}

/**
 * Claims deduplication key in Redis or memory
 */
async function claimDedupeKey(key, ttlSeconds = 86400) {
  if (!key) return true;
  const redis = getRedisClient();
  if (redis) {
    try {
      const result = await redis.set(`dedupe:${key}`, "1", "EX", ttlSeconds, "NX");
      return result === "OK";
    } catch (err) {
      logger.warn("Redis WhatsApp dedupe check fallback", { error: err.message });
    }
  }

  const now = Date.now();
  const existing = localDedupeMap.get(key);
  if (existing && existing > now) {
    return false;
  }
  localDedupeMap.set(key, now + ttlSeconds * 1000);
  return true;
}

/**
 * Builds Meta Cloud API template payload
 */
function buildMetaTemplatePayload(to, templateName, languageCode = "en", bodyParameters = []) {
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
  };

  if (Array.isArray(bodyParameters) && bodyParameters.length > 0) {
    payload.template.components = [
      {
        type: "body",
        parameters: bodyParameters.map((param) => ({
          type: "text",
          text: String(param != null ? param : ""),
        })),
      },
    ];
  }

  return payload;
}

/**
 * Low-level dispatch of template message to Meta Cloud API or Mock Engine
 */
export async function sendTemplateMessage({
  to,
  templateName,
  languageCode = "en",
  bodyParameters = [],
  eventType,
  orderId = null,
  shipmentId = null,
  userId = null,
  metadata = {},
}) {
  const formattedTo = formatWhatsAppNumber(to);
  if (!formattedTo) {
    logger.warn("[WhatsAppService] No valid recipient phone number provided", { to, eventType, orderId });
    return { success: false, reason: "INVALID_PHONE_NUMBER" };
  }

  const dedupeKey = `whatsapp:${eventType || "CUSTOM"}:${orderId || "NO_ORDER"}:${formattedTo}:${shipmentId || ""}`;
  const isFirst = await claimDedupeKey(dedupeKey);
  if (!isFirst) {
    logger.info("[WhatsAppService] Duplicate notification suppressed", { dedupeKey, eventType, orderId });
    return { success: true, duplicate: true };
  }

  // Create pending log in database
  let logDoc = null;
  try {
    logDoc = await WhatsAppLog.create({
      userId: userId || undefined,
      orderId: orderId ? String(orderId) : undefined,
      shipmentId: shipmentId ? String(shipmentId) : undefined,
      phoneNumber: formattedTo,
      eventType: eventType || "CUSTOM",
      templateName,
      templateLanguage: languageCode,
      templateParams: bodyParameters,
      dedupeKey,
      status: WHATSAPP_MESSAGE_STATUS.PENDING,
      metadata,
    });
  } catch (dbErr) {
    if (dbErr.code === 11000) {
      logger.info("[WhatsAppService] Duplicate log detected (mongo index)", { dedupeKey });
      return { success: true, duplicate: true };
    }
    logger.warn("[WhatsAppService] Could not persist initial log doc", { error: dbErr.message });
  }

  const mock = isMockMode();

  // Mock Engine Simulation
  if (mock) {
    const mockMessageId = `wamid.mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info("[WhatsAppService:MOCK_MODE] Simulated WhatsApp message sent", {
      to: maskPhoneNumber(formattedTo),
      template: templateName,
      params: bodyParameters,
      eventType,
      orderId,
      mockMessageId,
    });

    if (logDoc) {
      logDoc.status = WHATSAPP_MESSAGE_STATUS.SENT;
      logDoc.messageId = mockMessageId;
      logDoc.sentAt = new Date();
      logDoc.isMock = true;
      await logDoc.save().catch(() => {});
    }

    return {
      success: true,
      messageId: mockMessageId,
      isMock: true,
    };
  }

  // Live Meta WhatsApp Cloud API
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const url = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`;

  const payload = buildMetaTemplatePayload(formattedTo, templateName, languageCode, bodyParameters);

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    const responseData = response.data;
    const messageId = responseData?.messages?.[0]?.id || `wamid.${Date.now()}`;

    if (logDoc) {
      logDoc.status = WHATSAPP_MESSAGE_STATUS.SENT;
      logDoc.messageId = messageId;
      logDoc.sentAt = new Date();
      logDoc.isMock = false;
      await logDoc.save().catch(() => {});
    }

    logger.info("[WhatsAppService] Message successfully dispatched via Meta API", {
      messageId,
      to: maskPhoneNumber(formattedTo),
      template: templateName,
      eventType,
    });

    return {
      success: true,
      messageId,
      isMock: false,
    };
  } catch (err) {
    const errData = err.response?.data?.error || {};
    const errorCode = String(errData.code || err.code || "SEND_FAILED");
    const errorMessage = errData.message || err.message || "Failed to dispatch WhatsApp message";

    logger.error("[WhatsAppService] Meta API error dispatching WhatsApp message", {
      errorCode,
      errorMessage,
      to: maskPhoneNumber(formattedTo),
      template: templateName,
    });

    if (logDoc) {
      logDoc.status = WHATSAPP_MESSAGE_STATUS.FAILED;
      logDoc.failedAt = new Date();
      logDoc.errorCode = errorCode;
      logDoc.errorMessage = errorMessage;
      await logDoc.save().catch(() => {});
    }

    return {
      success: false,
      errorCode,
      errorMessage,
    };
  }
}

/**
 * Resolves customer's phone number and WhatsApp preferences
 */
async function resolveCustomerTarget(order, extraData = {}) {
  let orderDoc = order;

  // If order is only an ID or lacks address details, fetch from DB
  const orderId = order?.orderId || extraData?.orderId || (typeof order === "string" ? order : null);
  if (orderId && (!orderDoc?.address?.phone || !orderDoc?.customer)) {
    try {
      const { default: OrderModel } = await import("../models/order.js");
      const found = await OrderModel.findOne({
        $or: [{ orderId }, { _id: orderId.length === 24 ? orderId : null }].filter(Boolean),
      }).lean();
      if (found) {
        orderDoc = found;
      }
    } catch (ordLookupErr) {
      logger.debug("[WhatsAppService] Order lookup in resolveCustomerTarget skipped", { error: ordLookupErr.message });
    }
  }

  let customerPhone = extraData.phone || orderDoc?.address?.phone || "";
  let customerName = extraData.customerName || orderDoc?.address?.name || "Valued Customer";
  let userId = orderDoc?.customer?._id || orderDoc?.customer || extraData.userId || null;
  let optIn = true;

  if (userId) {
    try {
      const user = await User.findById(userId).lean();
      if (user) {
        customerPhone = user.whatsappPhone || customerPhone || user.phone || "";
        customerName = user.name || customerName;
        if (user.whatsappNotificationsEnabled === false) {
          optIn = false;
        }
      }
    } catch (e) {}
  }

  return { customerPhone, customerName, userId, optIn, resolvedOrder: orderDoc };
}

/**
 * Extracts item summary text for WhatsApp notifications (e.g. "Item A (+2 more)")
 */
function formatItemSummary(items) {
  if (!items || !items.length) return "Items";
  const firstName = items[0]?.name || items[0]?.productName || items[0]?.title || "Item";
  if (items.length === 1) {
    const qty = items[0]?.quantity || items[0]?.qty || 1;
    return `${firstName} (Qty: ${qty})`;
  }
  return `${firstName} (+${items.length - 1} more items)`;
}

/**
 * High-level order lifecycle notification dispatcher
 */
export async function sendOrderNotification(eventType, payload = {}) {
  try {
    const settings = await getWhatsAppSettings();
    if (!settings.enabled) {
      logger.debug("[WhatsAppService] WhatsApp integration is globally disabled");
      return { skipped: true, reason: "GLOBALLY_DISABLED" };
    }

    const toggleKey = EVENT_TO_SETTING_KEY[eventType];
    if (toggleKey && settings.eventToggles?.[toggleKey] === false) {
      logger.debug("[WhatsAppService] Event toggle disabled by Admin", { eventType, toggleKey });
      return { skipped: true, reason: "EVENT_TOGGLE_DISABLED" };
    }

    const order = payload.order || payload;
    const orderId = order.orderId || payload.orderId || "UNKNOWN";

    const { customerPhone, customerName, userId, optIn, resolvedOrder } = await resolveCustomerTarget(order, payload);
    const activeOrder = resolvedOrder || order;

    if (!optIn) {
      logger.info("[WhatsAppService] Customer opted out of WhatsApp notifications", { userId, orderId });
      return { skipped: true, reason: "CUSTOMER_OPTED_OUT" };
    }

    if (!customerPhone) {
      logger.warn("[WhatsAppService] No target phone number found for order notification", { orderId, eventType });
      return { skipped: true, reason: "NO_PHONE_NUMBER" };
    }

    const templateName = WHATSAPP_TEMPLATES[eventType] || "order_placed";
    const grandTotal = Number(
      activeOrder.paymentBreakdown?.grandTotal ||
      activeOrder.pricing?.total ||
      activeOrder.total ||
      payload.amount ||
      0
    ).toFixed(2);
    const currency = activeOrder.pricing?.currency || "₹";

    let params = [];
    switch (eventType) {
      case WHATSAPP_EVENTS.ORDER_PLACED:
        params = [
          customerName,
          orderId,
          `${currency}${grandTotal}`,
          formatItemSummary(activeOrder.items),
        ];
        break;

      case WHATSAPP_EVENTS.ORDER_CONFIRMED:
        params = [
          customerName,
          orderId,
          payload.estimatedDelivery || "Soon",
        ];
        break;

      case WHATSAPP_EVENTS.PAYMENT_SUCCESS:
        params = [
          customerName,
          orderId,
          `${currency}${grandTotal}`,
          activeOrder.paymentMode || activeOrder.paymentMethod || "Online",
        ];
        break;

      case WHATSAPP_EVENTS.PAYMENT_FAILED:
        params = [
          customerName,
          orderId,
          `${currency}${grandTotal}`,
          payload.retryUrl || "your account page",
        ];
        break;

      case WHATSAPP_EVENTS.ORDER_PACKED:
        params = [
          customerName,
          orderId,
        ];
        break;

      case WHATSAPP_EVENTS.ORDER_CANCELLED:
        params = [
          customerName,
          orderId,
          payload.reason || "Cancelled upon request",
        ];
        break;

      case WHATSAPP_EVENTS.REFUND_INITIATED:
        params = [
          customerName,
          orderId,
          `${currency}${grandTotal}`,
        ];
        break;

      case WHATSAPP_EVENTS.REFUND_COMPLETED:
        params = [
          customerName,
          orderId,
          `${currency}${grandTotal}`,
        ];
        break;

      default:
        params = [customerName, orderId];
        break;
    }

    return await sendTemplateMessage({
      to: customerPhone,
      templateName,
      languageCode: settings.defaultLanguage || "en",
      bodyParameters: params,
      eventType,
      orderId,
      userId,
      metadata: { source: "order_event", orderId },
    });
  } catch (err) {
    logger.error("[WhatsAppService] Unhandled error in sendOrderNotification", { error: err.message, eventType });
    return { success: false, error: err.message };
  }
}

/**
 * High-level shipment / courier notification dispatcher
 */
export async function sendShipmentNotification(eventType, payload = {}) {
  try {
    const settings = await getWhatsAppSettings();
    if (!settings.enabled) {
      return { skipped: true, reason: "GLOBALLY_DISABLED" };
    }

    const toggleKey = EVENT_TO_SETTING_KEY[eventType];
    if (toggleKey && settings.eventToggles?.[toggleKey] === false) {
      return { skipped: true, reason: "EVENT_TOGGLE_DISABLED" };
    }

    const order = payload.order || payload;
    const shipment = payload.shipment || {};
    const orderId = order.orderId || payload.orderId || "UNKNOWN";
    const shipmentId = shipment.externalShipmentId || shipment.awbCode || payload.awbCode || null;

    const { customerPhone, customerName, userId, optIn } = await resolveCustomerTarget(order, payload);

    if (!optIn) return { skipped: true, reason: "CUSTOMER_OPTED_OUT" };
    if (!customerPhone) return { skipped: true, reason: "NO_PHONE_NUMBER" };

    const templateName = WHATSAPP_TEMPLATES[eventType] || "order_shipped";
    const courier = shipment.courierName || payload.courierName || "Shiprocket";
    const trackingNumber = shipmentId || "N/A";
    const trackingUrl =
      shipment.trackingUrl ||
      payload.trackingUrl ||
      (shipmentId
        ? `https://shiprocket.co/tracking/${shipmentId}`
        : PUBLIC_SITE_URL);

    let params = [];
    switch (eventType) {
      case WHATSAPP_EVENTS.SHIPMENT_CREATED:
      case WHATSAPP_EVENTS.ORDER_SHIPPED:
        params = [
          customerName,
          orderId,
          courier,
          trackingNumber,
          trackingUrl,
        ];
        break;

      case WHATSAPP_EVENTS.OUT_FOR_DELIVERY:
        params = [
          customerName,
          orderId,
          courier,
          trackingUrl,
        ];
        break;

      case WHATSAPP_EVENTS.ORDER_DELIVERED:
        params = [
          customerName,
          orderId,
        ];
        break;

      case WHATSAPP_EVENTS.DELIVERY_FAILED:
        params = [
          customerName,
          orderId,
          payload.reason || "Recipient unavailable",
          trackingUrl,
        ];
        break;

      default:
        params = [customerName, orderId, trackingUrl];
        break;
    }

    return await sendTemplateMessage({
      to: customerPhone,
      templateName,
      languageCode: settings.defaultLanguage || "en",
      bodyParameters: params,
      eventType,
      orderId,
      shipmentId,
      userId,
      metadata: { source: "shipment_event", courier, trackingNumber },
    });
  } catch (err) {
    logger.error("[WhatsAppService] Unhandled error in sendShipmentNotification", { error: err.message, eventType });
    return { success: false, error: err.message };
  }
}

/**
 * Sends a diagnostic test message triggered by Admin
 */
export async function sendTestMessage({ to, templateName = "order_placed", customParams = [] }) {
  const settings = await getWhatsAppSettings();
  const params = customParams.length > 0 ? customParams : ["Test Customer", "ORD-TEST-999", "₹499.00", "Sample Product"];

  return await sendTemplateMessage({
    to,
    templateName,
    languageCode: settings.defaultLanguage || "en",
    bodyParameters: params,
    eventType: "TEST_MESSAGE",
    orderId: "TEST-ORDER",
    metadata: { source: "admin_test" },
  });
}

/**
 * Processes incoming delivery receipts and status updates from Meta Webhooks
 */
export async function processWebhookStatus(payload) {
  try {
    const entries = payload?.entry || [];
    let updatedCount = 0;

    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const statuses = change?.value?.statuses || [];
        for (const statusObj of statuses) {
          const messageId = statusObj?.id;
          const status = statusObj?.status; // sent, delivered, read, failed
          const timestamp = statusObj?.timestamp ? new Date(Number(statusObj.timestamp) * 1000) : new Date();

          if (!messageId || !status) continue;

          const updateDoc = {};
          if (status === "sent") {
            updateDoc.status = WHATSAPP_MESSAGE_STATUS.SENT;
            updateDoc.sentAt = timestamp;
          } else if (status === "delivered") {
            updateDoc.status = WHATSAPP_MESSAGE_STATUS.DELIVERED;
            updateDoc.deliveredAt = timestamp;
          } else if (status === "read") {
            updateDoc.status = WHATSAPP_MESSAGE_STATUS.READ;
            updateDoc.readAt = timestamp;
          } else if (status === "failed") {
            updateDoc.status = WHATSAPP_MESSAGE_STATUS.FAILED;
            updateDoc.failedAt = timestamp;
            const errDetails = statusObj?.errors?.[0] || {};
            updateDoc.errorCode = String(errDetails.code || "WEBHOOK_FAILED");
            updateDoc.errorMessage = errDetails.title || errDetails.message || "Message delivery failed";
          }

          const res = await WhatsAppLog.updateOne({ messageId }, { $set: updateDoc });
          if (res.modifiedCount > 0) updatedCount += 1;
        }
      }
    }

    return { success: true, updatedCount };
  } catch (err) {
    logger.error("[WhatsAppService] Error processing webhook status", { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Returns summary diagnostic status for Admin UI
 */
export async function getWhatsAppStatus() {
  const settings = await getWhatsAppSettings();
  const mock = isMockMode();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || settings.phoneNumberId || "";
  const maskedPhoneId = phoneId ? `${phoneId.slice(0, 4)}...${phoneId.slice(-4)}` : "Not Configured";

  const [totalLogs, sentCount, deliveredCount, failedCount] = await Promise.all([
    WhatsAppLog.countDocuments(),
    WhatsAppLog.countDocuments({ status: WHATSAPP_MESSAGE_STATUS.SENT }),
    WhatsAppLog.countDocuments({ status: WHATSAPP_MESSAGE_STATUS.DELIVERED }),
    WhatsAppLog.countDocuments({ status: WHATSAPP_MESSAGE_STATUS.FAILED }),
  ]);

  return {
    enabled: settings.enabled,
    isMockMode: mock,
    phoneNumberId: maskedPhoneId,
    businessAccountId: settings.businessAccountId ? `${settings.businessAccountId.slice(0, 4)}...` : "Not Configured",
    webhookVerified: settings.webhookVerified,
    lastWebhookAt: settings.lastWebhookAt,
    stats: {
      total: totalLogs,
      sent: sentCount,
      delivered: deliveredCount,
      failed: failedCount,
    },
    eventToggles: settings.eventToggles,
  };
}

export const NOTIFICATION_TO_WA_EVENT = Object.freeze({
  ORDER_PLACED: WHATSAPP_EVENTS.ORDER_PLACED,
  PAYMENT_SUCCESS: WHATSAPP_EVENTS.PAYMENT_SUCCESS,
  PAYMENT_FAILED: WHATSAPP_EVENTS.PAYMENT_FAILED,
  ORDER_CONFIRMED: WHATSAPP_EVENTS.ORDER_CONFIRMED,
  ORDER_PACKED: WHATSAPP_EVENTS.ORDER_PACKED,
  OUT_FOR_DELIVERY: WHATSAPP_EVENTS.OUT_FOR_DELIVERY,
  ORDER_DELIVERED: WHATSAPP_EVENTS.ORDER_DELIVERED,
  ORDER_CANCELLED: WHATSAPP_EVENTS.ORDER_CANCELLED,
  REFUND_INITIATED: WHATSAPP_EVENTS.REFUND_INITIATED,
  REFUND_COMPLETED: WHATSAPP_EVENTS.REFUND_COMPLETED,
  WAREHOUSE_PACKED: WHATSAPP_EVENTS.ORDER_PACKED,
  WAREHOUSE_READY_TO_SHIP: WHATSAPP_EVENTS.SHIPMENT_CREATED,
  SHIPMENT_CREATED: WHATSAPP_EVENTS.SHIPMENT_CREATED,
  ORDER_SHIPPED: WHATSAPP_EVENTS.ORDER_SHIPPED,
  DELIVERY_FAILED: WHATSAPP_EVENTS.DELIVERY_FAILED,
});

/**
 * Universal Lifecycle Event Receiver
 */
export async function handleLifecycleEvent(eventType, payload = {}) {
  try {
    const waEvent = NOTIFICATION_TO_WA_EVENT[eventType] || eventType;
    if (!waEvent || !WHATSAPP_TEMPLATES[waEvent]) return;

    if (
      waEvent === WHATSAPP_EVENTS.SHIPMENT_CREATED ||
      waEvent === WHATSAPP_EVENTS.ORDER_SHIPPED ||
      waEvent === WHATSAPP_EVENTS.OUT_FOR_DELIVERY ||
      waEvent === WHATSAPP_EVENTS.DELIVERY_FAILED
    ) {
      await sendShipmentNotification(waEvent, payload);
    } else {
      await sendOrderNotification(waEvent, payload);
    }
  } catch (err) {
    logger.debug("[WhatsAppService] Event handling error skipped", { error: err.message, eventType });
  }
}

export default {
  formatWhatsAppNumber,
  maskPhoneNumber,
  getWhatsAppSettings,
  invalidateWhatsAppSettingsCache,
  sendTemplateMessage,
  sendOrderNotification,
  sendShipmentNotification,
  sendTestMessage,
  processWebhookStatus,
  getWhatsAppStatus,
  handleLifecycleEvent,
};

