import { SELF, env } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type TestKey, authHeader, forgeToken, generateKey, signToken, stubJwks, validClaims } from "./helpers";

const state = (token: string) => SELF.fetch("https://worker.test/api/state", { headers: authHeader(token) });
const now = () => Math.floor(Date.now() / 1000);

let key: TestKey;
beforeAll(async () => {
  key = await generateKey();
});
afterEach(() => vi.restoreAllMocks());

describe("auth", () => {
  it("accepts a valid access token", async () => {
    stubJwks(key);
    const res = await state(await signToken(key));
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://dashboard.test");
  });

  it("accepts the bare client id as audience", async () => {
    stubJwks(key);
    const res = await state(await signToken(key, validClaims({ aud: env.AZURE_CLIENT_ID })));
    expect(res.status).toBe(200);
  });

  it("rejects a request without a bearer token", async () => {
    const res = await SELF.fetch("https://worker.test/api/state");
    expect(res.status).toBe(401);
  });

  it.each([
    ["wrong aud", { aud: "api://33333333-3333-4333-8333-333333333333" }],
    ["wrong iss", { iss: "https://sts.windows.net/11111111-1111-4111-8111-111111111111/" }],
    ["tid not allowed", { tid: "44444444-4444-4444-8444-444444444444" }],
    ["expired", { exp: now() - 3600 }],
    ["future nbf", { nbf: now() + 3600 }],
    ["missing scope", { scp: "User.Read" }],
    ["no scope claim", { scp: undefined }],
  ])("rejects %s with 401", async (_name, overrides) => {
    stubJwks(key);
    // iss must follow the claimed tid for the "tid not allowed" case to reach the tenant check
    const res = await state(await signToken(key, validClaims(overrides)));
    expect(res.status).toBe(401);
  });

  it("rejects alg none", async () => {
    stubJwks(key);
    expect((await state(await forgeToken("none"))).status).toBe(401);
  });

  it("rejects alg HS256", async () => {
    stubJwks(key);
    expect((await state(await forgeToken("HS256"))).status).toBe(401);
  });

  it("rejects a token signed by an unknown key", async () => {
    stubJwks(key);
    const other = await generateKey();
    expect((await state(await signToken(other))).status).toBe(401);
  });

  it("rejects a token whose kid is not in the JWKS", async () => {
    stubJwks(key);
    expect((await state(await signToken(key, validClaims(), { kid: "nope" }))).status).toBe(401);
  });

  it("rejects when the JWKS endpoint fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("boom", { status: 500 }));
    expect((await state(await signToken(key))).status).toBe(401);
  });
});

describe("configuration (fail closed)", () => {
  it("returns 503 on protected routes while the client id is the placeholder", async () => {
    // The worker reads env per request; calling the handler directly lets the test swap vars.
    const { default: worker } = await import("../src/index");
    const placeholderEnv = { ...env, AZURE_CLIENT_ID: "00000000-0000-0000-0000-000000000000" };
    const req = new Request("https://worker.test/api/state", { headers: authHeader(await signToken(key)) });
    expect((await worker.fetch(req, placeholderEnv)).status).toBe(503);

    const health = await worker.fetch(new Request("https://worker.test/api/health"), placeholderEnv);
    expect(await health.json()).toEqual({ status: "ok", configured: false });
  });

  it("returns 503 for 'organizations' without a tenant allowlist", async () => {
    const { default: worker } = await import("../src/index");
    const open = { ...env, AZURE_TENANT_ID: "organizations", ALLOWED_TENANT_IDS: "" };
    const res = await worker.fetch(new Request("https://worker.test/api/state"), open);
    expect(res.status).toBe(503);
  });

  it("health reports configured under the test vars", async () => {
    const res = await SELF.fetch("https://worker.test/api/health");
    expect(await res.json()).toEqual({ status: "ok", configured: true });
  });
});
