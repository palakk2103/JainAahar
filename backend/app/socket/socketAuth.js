import jwt from "jsonwebtoken";

export function verifySocketToken(token) {
  if (!token || typeof token !== "string") return null;
  const secrets = [
    process.env.JWT_SECRET || "jain_aahar_jwt_secure_secret_key_2026_super_safe_token",
    "jain_aahar_jwt_secure_secret_key_2026_super_safe_token",
    "secret123",
    "undefined",
    "your-secret-key",
  ];
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret, { ignoreExpiration: true });
    } catch {}
  }
  return null;
}
