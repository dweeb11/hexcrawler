import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const SESSION_COOKIE_NAME = "waning_light_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

function getSessionSecret(): string | null {
  return process.env.ADMIN_API_KEY ?? null;
}

function getPassphrase(): string | null {
  return process.env.ADMIN_PASSPHRASE ?? null;
}

export function constantTimeEqual(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  const size = Math.max(providedBuf.length, expectedBuf.length);
  const a = Buffer.alloc(size);
  const b = Buffer.alloc(size);
  providedBuf.copy(a);
  expectedBuf.copy(b);
  const valuesMatch = timingSafeEqual(a, b);
  const lengthMatch = providedBuf.length === expectedBuf.length;
  return valuesMatch && lengthMatch;
}

export function verifyPassphrase(passphrase: string): boolean {
  const expected = getPassphrase();
  if (!expected || !passphrase) {
    return false;
  }
  return constantTimeEqual(passphrase, expected);
}

export function verifyApiKey(apiKey: string): boolean {
  const expected = getSessionSecret();
  if (!expected || !apiKey) {
    return false;
  }
  return constantTimeEqual(apiKey, expected);
}

function signPayload(payloadB64: string): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("ADMIN_API_KEY is not configured.");
  }
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createSessionToken(): string {
  const payload = {
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    nonce: randomBytes(16).toString("hex"),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${signPayload(payloadB64)}`;
}

export function verifySessionToken(token: string): boolean {
  if (!getSessionSecret() || !token) {
    return false;
  }

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    return false;
  }

  if (!constantTimeEqual(signature, signPayload(payloadB64))) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function safeDecodeCookieValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    const decoded = safeDecodeCookieValue(trimmed.slice(separatorIndex + 1));
    if (decoded !== null) {
      cookies[key] = decoded;
    }
  }

  return cookies;
}

function cookieSecureFlag(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export function setSessionCookie(res: VercelResponse, token: string): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  if (cookieSecureFlag()) {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res: VercelResponse): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (cookieSecureFlag()) {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function hasValidSession(req: VercelRequest): boolean {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  return token ? verifySessionToken(token) : false;
}

export function hasValidApiKeyHeader(req: VercelRequest): boolean {
  const providedKey = req.headers["x-api-key"];
  const apiKey = Array.isArray(providedKey) ? providedKey[0] : providedKey;
  return apiKey ? verifyApiKey(apiKey) : false;
}

export function isSessionAuthenticated(req: VercelRequest): boolean {
  if (!getSessionSecret()) {
    return false;
  }
  return hasValidApiKeyHeader(req) || hasValidSession(req);
}

export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  if (!getSessionSecret()) {
    res.status(500).json({ error: "Server misconfigured: ADMIN_API_KEY is missing." });
    return false;
  }
  if (isSessionAuthenticated(req)) {
    return true;
  }
  res.status(401).json({ error: "Unauthorized" });
  return false;
}

export function requirePassphraseConfigured(res: VercelResponse): boolean {
  if (!getPassphrase()) {
    res.status(500).json({ error: "Server misconfigured: ADMIN_PASSPHRASE is missing." });
    return false;
  }
  if (!getSessionSecret()) {
    res.status(500).json({ error: "Server misconfigured: ADMIN_API_KEY is missing." });
    return false;
  }
  return true;
}
