import http from "http";
import https from "https";
import axios from "axios";
import { buildMessage, normalizeMobile, toIndianNumber } from "../utils/smsHelpers.js";

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const SMS_INDIA_SUCCESS_CODE = "000";

function getSmsIndiaConfig() {
  return {
    apiKey: String(
      process.env.SMS_INDIA_HUB_API_KEY ||
        process.env.SMS_API_KEY ||
        process.env.SMS_KEY ||
        "",
    ).trim(),
    senderId: String(
      process.env.SMS_INDIA_HUB_SENDER_ID ||
        process.env.SMS_SENDER_ID ||
        process.env.SMS_SENDERID ||
        "",
    ).trim(),
    dltTemplateId: String(
      process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID ||
        process.env.SMS_INDIA_HUB_TEMPLATE_ID ||
        process.env.SMS_TEMPLATE_ID ||
        process.env.SMS_DLT_TEMPLATE_ID ||
        "",
    ).trim(),
    gatewayId: String(
      process.env.SMS_INDIA_HUB_GWID ||
        process.env.SMS_INDIA_HUB_CHANNEL ||
        process.env.SMS_CHANNEL ||
        "2",
    ).trim(),
    campaignId: String(
      process.env.SMS_CAMPAIGN_ID ||
        process.env.SMS_INDIA_HUB_CAMPAIGN_ID ||
        "12719",
    ).trim(),
    routeId: String(
      process.env.SMS_ROUTE_ID ||
        process.env.SMS_INDIA_HUB_ROUTE_ID ||
        process.env.SMS_INDIA_HUB_ROUTE ||
        "100768",
    ).trim(),
    peId: String(
      process.env.SMS_INDIA_HUB_PE_ID ||
        process.env.SMS_INDIA_HUB_ENTITY_ID ||
        process.env.SMS_PE_ID ||
        process.env.SMS_ENTITY_ID ||
        "",
    ).trim(),
    username: String(process.env.SMS_USERNAME || "").trim(),
    url: String(
      process.env.SMS_INDIA_HUB_URL ||
        process.env.SMS_API_URL ||
        "http://cloud.smsindiahub.in/vendorsms/pushsms.aspx",
    ).trim(),
    timeoutMs: parseInt(
      process.env.SMS_INDIA_HUB_TIMEOUT_MS ||
        process.env.SMS_TIMEOUT_MS ||
        "10000",
      10,
    ),
  };
}

function normalizeProviderPayload(payload) {
  return typeof payload === "string" ? payload : JSON.stringify(payload || {});
}

function parseSmsIndiaResponse(payload) {
  if (payload && typeof payload === "object") {
    const errorCode = String(
      payload.ErrorCode || payload.errorCode || payload.code || "",
    ).trim();
    const errorMessage = String(
      payload.ErrorMessage || payload.errorMessage || "",
    ).toLowerCase();

    if (errorCode === SMS_INDIA_SUCCESS_CODE || errorMessage === "done") {
      return { code: SMS_INDIA_SUCCESS_CODE, raw: normalizeProviderPayload(payload) };
    }

    const status = String(payload.status || "").toLowerCase();
    if (["success", "ok", "done", "submitted", "000"].includes(status)) {
      return { code: SMS_INDIA_SUCCESS_CODE, raw: normalizeProviderPayload(payload) };
    }
    if (Array.isArray(payload.response)) {
      const anySuccess = payload.response.some(
        (r) => String(r.status || "").toLowerCase() === "success",
      );
      if (anySuccess) {
        return { code: SMS_INDIA_SUCCESS_CODE, raw: normalizeProviderPayload(payload) };
      }
    }
    if (status === "failure" || status === "error") {
      return { code: "PROVIDER_ERROR", raw: normalizeProviderPayload(payload) };
    }
  }

  const raw = normalizeProviderPayload(payload);
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  const directCode = trimmed.slice(0, 3);
  if (/^\d{3}$/.test(directCode)) {
    return { code: directCode, raw };
  }

  const xmlStatusMatch = trimmed.match(/<status>\s*([^<]+)\s*<\/status>/i);
  if (xmlStatusMatch) {
    const statusValue = String(xmlStatusMatch[1] || "").trim();
    if (/^\d{3}$/.test(statusValue)) {
      return { code: statusValue, raw };
    }
    if (["success", "ok", "done", "submitted"].includes(statusValue.toLowerCase())) {
      return { code: SMS_INDIA_SUCCESS_CODE, raw };
    }
  }

  const jsonStatusMatch = trimmed.match(
    /"status"\s*:\s*"?(success|ok|done|submitted|000)"?/i,
  );
  if (jsonStatusMatch) {
    return { code: SMS_INDIA_SUCCESS_CODE, raw };
  }

  const matched = trimmed.match(/\b(\d{3})\b/);
  if (matched) {
    return { code: matched[1], raw };
  }

  if (
    lower === "success" ||
    lower === "ok" ||
    lower === "done" ||
    lower.startsWith("success#") ||
    lower.startsWith("done#") ||
    lower.includes("message submitted") ||
    lower.includes("sms sent successfully") ||
    lower.includes('"status":"success"')
  ) {
    return { code: SMS_INDIA_SUCCESS_CODE, raw };
  }

  return { code: null, raw };
}

function providerSnippet(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function mapSmsIndiaError(code) {
  const messages = {
    "001": "SMS India HUB configuration issue",
    "006":
      "SMS India HUB rejected the message body: it must match the DLT-approved " +
      "template for SMS_INDIA_HUB_DLT_TEMPLATE_ID exactly. Check SMS_INDIA_HUB_TEMPLATE_TEXT.",
    "007": "SMS India HUB API key is invalid",
    "021": "SMS India HUB credits exhausted",
  };
  const error = new Error(messages[code] || "SMS India HUB request failed");
  error.isKnownProviderCode = Boolean(messages[code]);
  error.statusCode = code === "001" || code === "006" || code === "007" ? 500 : 502;
  error.providerCode = code;
  return error;
}

export async function sendSmsIndiaHubOtp({ phone, otp, message }) {
  const config = getSmsIndiaConfig();
  const requiredConfig = {
    apiKey: config.apiKey,
    senderId: config.senderId,
    url: config.url,
  };
  const missing = Object.entries(requiredConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    const error = new Error(`Missing SMS config: ${missing.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }

  const isBulkSmsSender = config.url.includes("bulksmssender");
  const params = isBulkSmsSender
    ? {
        key: config.apiKey,
        campaign: config.campaignId,
        routeid: config.routeId,
        type: "text",
        contacts: normalizeMobile(phone),
        senderid: config.senderId,
        msg: message || buildMessage(otp),
        ...(config.dltTemplateId ? { template_id: config.dltTemplateId } : {}),
        ...(config.peId ? { pe_id: config.peId } : {}),
      }
    : {
        APIKey: config.apiKey,
        msisdn: toIndianNumber(phone),
        sid: config.senderId,
        msg: message || buildMessage(otp),
        fl: "0",
        gwid: config.gatewayId,
        ...(config.dltTemplateId
          ? {
              dlt_template_id: config.dltTemplateId,
              DLT_TE_ID: config.dltTemplateId,
              TE_ID: config.dltTemplateId,
              TemplateID: config.dltTemplateId,
              dlttemplateid: config.dltTemplateId,
            }
          : {}),
        ...(config.peId
          ? {
              dlt_entity_id: config.peId,
              PE_ID: config.peId,
              EntityId: config.peId,
              EntityID: config.peId,
              entityid: config.peId,
            }
          : {}),
      };

  const response = await axios.get(config.url, {
    params,
    timeout: config.timeoutMs,
    httpAgent,
    httpsAgent,
  });

  const body = response.data;
  const inlineErrorCode =
    body && typeof body === "object"
      ? body.ErrorCode || body.errorCode || body.code
      : null;
  const { code: providerCode, raw } = parseSmsIndiaResponse(body);
  const effectiveCode = inlineErrorCode || providerCode;

  if (effectiveCode !== SMS_INDIA_SUCCESS_CODE) {
    const errorMsg =
      (body &&
        typeof body === "object" &&
        (body.msg || body.message || body.error || body.reason)) ||
      null;
    const error = mapSmsIndiaError(effectiveCode);
    if (errorMsg) {
      error.message = `SMS provider error: ${errorMsg}`;
    } else if (!error.isKnownProviderCode && raw) {
      const cleanSnippet = providerSnippet(raw);
      error.message =
        cleanSnippet.startsWith("ERR:") || cleanSnippet.startsWith("Error:")
          ? `SMS provider error: ${cleanSnippet}`
          : `${error.message}: ${cleanSnippet}`;
    }
    error.providerRaw = raw;
    throw error;
  }

  return {
    provider: isBulkSmsSender ? "bulksmssender" : "sms_india_hub",
    providerCode,
    rawResponse: body,
  };
}

export const __testables = {
  getSmsIndiaConfig,
  mapSmsIndiaError,
  parseSmsIndiaResponse,
};

