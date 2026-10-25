import type { Env } from "./index";

export interface MicrosoftClaims {
  oid: string;
  tid: string;
  preferred_username?: string;
  name?: string;
  scp?: string;
  aud: string;
  iss: string;
  exp: number;
  nbf?: number;
}

export const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOCK_SKEW_SEC = 300;

/**
 * Verifies an Entra ID v2.0 *access token* issued for this API (not an ID token):
 * RS256 signature against the JWKS, exp/nbf, audience, issuer, tenant allowlist, scope.
 */
export async function verifyMicrosoftJwt(authHeader: string | null, env: Env): Promise<MicrosoftClaims | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const parts = authHeader.slice(7).trim().split(".");
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(base64UrlDecodeString(parts[0])) as { kid: string; alg: string };
    const claims = JSON.parse(base64UrlDecodeString(parts[1])) as MicrosoftClaims;
    if (header.alg !== "RS256") return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SEC < nowSec) return null;
    if (typeof claims.nbf === "number" && claims.nbf - CLOCK_SKEW_SEC > nowSec) return null;

    const audiences = [env.AZURE_CLIENT_ID, `api://${env.AZURE_CLIENT_ID}`];
    if (!audiences.includes(claims.aud)) return null;

    if (!claims.tid || !claims.oid) return null;
    const allowedTenants = GUID.test(env.AZURE_TENANT_ID)
      ? [env.AZURE_TENANT_ID]
      : (env.ALLOWED_TENANT_IDS ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    if (!allowedTenants.includes(claims.tid)) return null;
    if (claims.iss !== `https://login.microsoftonline.com/${claims.tid}/v2.0`) return null;

    if (env.REQUIRED_SCOPE && !(claims.scp ?? "").split(" ").includes(env.REQUIRED_SCOPE)) return null;

    const jwksRes = await fetch(`https://login.microsoftonline.com/${claims.tid}/discovery/v2.0/keys`, {
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (!jwksRes.ok) return null;

    const jwks = (await jwksRes.json()) as { keys: Array<JsonWebKey & { kid: string }> };
    const matchingKey = jwks.keys.find((k) => k.kid === header.kid);
    if (!matchingKey) return null;

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      matchingKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      base64UrlDecodeBytes(parts[2]),
      signedData
    );

    return isValid ? claims : null;
  } catch {
    return null;
  }
}

function base64UrlDecodeBytes(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeString(base64Url: string): string {
  return new TextDecoder().decode(base64UrlDecodeBytes(base64Url));
}
