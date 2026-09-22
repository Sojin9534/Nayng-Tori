// Only trust signed Access application tokens, never caller-supplied identity headers.
const keyCache = new Map();
const bytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const decode = (s) => JSON.parse(new TextDecoder().decode(bytes(s)));

export async function verifyAccessUser(headers, env, fetchKeys = fetch) {
  const { ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: audience, ADMIN_EMAIL: adminEmail, ADMIN_OWNER_ID: ownerId } = env;
  if (!domain || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain) || !adminEmail || !ownerId) return null;
  // Cloudflare Access injects this header only after its edge policy has allowed
  // the request. Vinext does not consistently forward the JWT header/cookie to
  // Next server components, so use the verified edge identity on this Worker.
  const edgeEmail = headers.get("cf-access-authenticated-user-email");
  if (env.ACCESS_EDGE_PROTECTED === "true" && edgeEmail?.trim().toLowerCase() === adminEmail.trim().toLowerCase()) {
    return { userId: ownerId, email: edgeEmail.trim(), displayName: edgeEmail.trim(), fullName: null };
  }
  const cookie = headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith("CF_Authorization="))?.slice("CF_Authorization=".length);
  const token = headers.get("cf-access-jwt-assertion") || cookie;
  if (!token || token.length > 16384) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [head, body, signature] = parts;
    const header = decode(head), claims = decode(body);
    const now = Date.now() / 1000;
    if (header.alg !== "RS256" || typeof header.kid !== "string" || header.crit) return null;
    if (claims.iss !== domain || (audience && (!Array.isArray(claims.aud) || !claims.aud.includes(audience)))) return null;
    if (typeof claims.exp !== "number" || claims.exp <= now || typeof claims.iat !== "number" || claims.iat > now + 30) return null;
    if (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf > now + 30)) return null;
    if (typeof claims.sub !== "string" || !claims.sub || typeof claims.email !== "string" || claims.email.toLowerCase() !== adminEmail.trim().toLowerCase()) return null;
    let entry = keyCache.get(domain);
    if (!entry || entry.expires <= now) {
      const response = await fetchKeys(`${domain}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000), redirect: "error" });
      if (!response.ok) return null;
      const jwks = await response.json();
      if (!Array.isArray(jwks.keys)) return null;
      entry = { keys: jwks.keys, expires: now + 300 };
      keyCache.set(domain, entry);
    }
    const jwk = entry.keys.find(k => k.kid === header.kid && k.kty === "RSA" && (!k.alg || k.alg === "RS256"));
    if (!jwk) { keyCache.delete(domain); return null; }
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bytes(signature), new TextEncoder().encode(`${head}.${body}`))) return null;
    return { userId: ownerId, email: claims.email, displayName: claims.email, fullName: null };
  } catch { return null; }
}
