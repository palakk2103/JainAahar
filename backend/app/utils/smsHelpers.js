import crypto from "crypto";

const DEFAULT_OTP_LENGTH = 4;

export function normalizeMobile(mobile) {
  return String(mobile || "").replace(/\D/g, "").slice(-10);
}

export function toIndianNumber(mobile) {
  const normalized = normalizeMobile(mobile);
  return normalized ? `91${normalized}` : "";
}

export function getOtpLength() {
  const parsed = parseInt(process.env.OTP_LENGTH || `${DEFAULT_OTP_LENGTH}`, 10);
  return Number.isFinite(parsed) && parsed >= 4 ? parsed : DEFAULT_OTP_LENGTH;
}

export function generateOTP(length = getOtpLength()) {
  const safeLength = Math.max(4, Number(length || DEFAULT_OTP_LENGTH));
  const min = 10 ** (safeLength - 1);
  const max = 10 ** safeLength;
  return crypto.randomInt(min, max).toString();
}

export function buildMessage(otp) {
  const minutes = parseInt(process.env.OTP_EXPIRY_MINUTES || "5", 10);
  const configuredTemplate = String(
    process.env.SMS_INDIA_HUB_TEMPLATE_TEXT || "",
  ).trim();

  // SMS India Hub validates the body against the DLT-approved template and
  // rejects anything else with ErrorCode 006 ("Invalid template text"), so a
  // generic fallback would silently never deliver. Fail loudly instead.
  if (!configuredTemplate) {
    const error = new Error(
      "Missing SMS config: SMS_INDIA_HUB_TEMPLATE_TEXT must match the DLT-approved template body",
    );
    error.statusCode = 500;
    throw error;
  }

  const template = configuredTemplate;
  const appName = String(process.env.APP_NAME || "Noyo").trim();

  // Primary replacements for common tags
  let msg = template
    .replace(/\{\{OTP\}\}/g, String(otp))
    .replace(/\{\{MINUTES\}\}/g, String(minutes))
    .replace(/\{\{APP_NAME\}\}/g, appName)
    .replace(/\$\{otp\}/g, String(otp))
    .replace(/\$\{minutes\}/g, String(minutes))
    .replace(/\$\{appName\}/g, appName);

  // Count total occurrences of generic placeholders
  const genericTokens = ["##var##", "{#var#}", "{#VAR#}"];
  let totalGenericTokens = 0;
  for (const token of genericTokens) {
    let pos = 0;
    while ((pos = msg.indexOf(token, pos)) !== -1) {
      totalGenericTokens += 1;
      pos += token.length;
    }
  }

  // Determine replacement order based on token count
  let replacementOrder;
  if (totalGenericTokens === 1) {
    replacementOrder = [String(otp)];
  } else if (totalGenericTokens === 2) {
    if (/(?:hi|dear)\s*(?:\{#var#\}|##var##|\{#VAR#\})/i.test(template)) {
      replacementOrder = ["User", String(otp)];
    } else if (/valid for\s*(?:\{#var#\}|##var##|\{#VAR#\})/i.test(template)) {
      replacementOrder = [String(otp), String(minutes)];
    } else {
      // In standard Indian DLT templates: 1st var is Brand/AppName, 2nd var is OTP
      replacementOrder = [appName, String(otp)];
    }
  } else {
    replacementOrder = [appName, String(otp), String(minutes)];
  }

  // Replace explicit numbered DLT placeholders first if present
  msg = msg
    .replace(/\{#var1#\}/g, appName)
    .replace(/\{#var2#\}/g, String(otp))
    .replace(/\{#var3#\}/g, String(minutes));

  // Replace unnumbered generic placeholders in determined order
  genericTokens.forEach((placeholder) => {
    let occurrence = 0;
    while (msg.includes(placeholder)) {
      const replacement =
        replacementOrder[Math.min(occurrence, replacementOrder.length - 1)];
      msg = msg.replace(placeholder, replacement);
      occurrence += 1;
    }
  });

  return msg;
}


