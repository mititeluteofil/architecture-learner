import { vi } from "vitest";

export const TENANT = "11111111-1111-4111-8111-111111111111";
export const CLIENT_ID = "22222222-2222-4222-8222-222222222222";
export const KID = "test-key-1";

const enc = new TextEncoder();

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === "string" ? enc.encode(data) : new Uint8Array(data);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface TestKey {
  privateKey: CryptoKey;
  publicJwk: JsonWebKey & { kid: string };
}

export async function generateKey(kid = KID): Promise<TestKey> {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return { privateKey: pair.privateKey, publicJwk: { ...jwk, kid, alg: "RS256", use: "sig" } };
}

/** Claims of a token the worker should accept; override per test. */
export function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    oid: "aaaaaaaa-0000-4000-8000-000000000001",
    tid: TENANT,
    preferred_username: "ada@example.test",
    name: "Ada Lovelace",
    scp: "Progress.Sync",
    aud: `api://${CLIENT_ID}`,
    iss: `https://login.microsoftonline.com/${TENANT}/v2.0`,
    iat: now,
    nbf: now - 10,
    exp: now + 3600,
    ...overrides,
  };
}

/** Signs an RS256 token; `header` overrides let a test forge other algorithms. */
export async function signToken(
  key: TestKey,
  claims: Record<string, unknown> = validClaims(),
  header: Record<string, unknown> = {}
): Promise<string> {
  const h = { alg: "RS256", typ: "JWT", kid: key.publicJwk.kid, ...header };
  const signingInput = `${b64url(JSON.stringify(h))}.${b64url(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key.privateKey, enc.encode(signingInput));
  return `${signingInput}.${b64url(sig)}`;
}

/** Token with a header/signature that is not RS256 (alg none, or HS256 with an HMAC). */
export async function forgeToken(alg: "none" | "HS256", claims = validClaims()): Promise<string> {
  const signingInput = `${b64url(JSON.stringify({ alg, typ: "JWT", kid: KID }))}.${b64url(JSON.stringify(claims))}`;
  if (alg === "none") return `${signingInput}.`;
  const hmac = await crypto.subtle.importKey("raw", enc.encode("secret"), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return `${signingInput}.${b64url(await crypto.subtle.sign("HMAC", hmac, enc.encode(signingInput)))}`;
}

/** Makes the worker's JWKS fetch return `key` instead of calling Microsoft. */
export function stubJwks(key: TestKey) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url === `https://login.microsoftonline.com/${TENANT}/discovery/v2.0/keys`) {
      return Response.json({ keys: [key.publicJwk] });
    }
    return new Response("unexpected fetch", { status: 500 });
  });
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
