import { env } from "cloudflare:workers";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const TOKEN_LIFETIME_MS = 15 * 60 * 1000;

function toBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function signature(value: string) {
  const secret = env.R2_SECRET_ACCESS_KEY;
  if (!secret) throw new Error("Missing upload signing secret");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function createUploadToken(userId: string) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ userId, expiresAt: Date.now() + TOKEN_LIFETIME_MS })));
  return `${payload}.${await signature(payload)}`;
}

export async function getUploadUserId(request: Request) {
  const token = request.headers.get("x-nyang-upload-token");
  if (!token) return null;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature || providedSignature !== await signature(payload)) return null;
  try {
    const data = JSON.parse(decoder.decode(fromBase64Url(payload))) as { userId?: unknown; expiresAt?: unknown };
    if (typeof data.userId !== "string" || !data.userId || typeof data.expiresAt !== "number" || data.expiresAt < Date.now()) return null;
    return data.userId;
  } catch {
    return null;
  }
}
