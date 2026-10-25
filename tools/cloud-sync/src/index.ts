import { verifyMicrosoftJwt, GUID } from "./auth";
import { handleSync, handleGetState, handleGetLeaderboard, type SyncPayload } from "./sync";
import { json } from "./http";

export interface Env {
  DB: D1Database;
  AZURE_TENANT_ID: string;      // a tenant GUID, or "organizations"
  AZURE_CLIENT_ID: string;      // the API app registration's client ID
  ALLOWED_TENANT_IDS?: string;  // comma-separated; required when AZURE_TENANT_ID is not a GUID
  REQUIRED_SCOPE?: string;      // delegated scope the access token must carry, e.g. "Progress.Sync"
  ALLOWED_ORIGIN: string;
}

const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

function isConfigured(env: Env): boolean {
  if (!env.AZURE_CLIENT_ID || env.AZURE_CLIENT_ID === PLACEHOLDER_ID) return false;
  return GUID.test(env.AZURE_TENANT_ID) || !!env.ALLOWED_TENANT_IDS?.trim();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ status: "ok", configured: isConfigured(env) }, 200, corsHeaders);
    }

    // Fail closed: never accept tokens while the app registration is unset.
    if (!isConfigured(env)) {
      return json({ error: "Worker not configured: set AZURE_CLIENT_ID and a tenant allowlist" }, 503, corsHeaders);
    }

    const claims = await verifyMicrosoftJwt(request.headers.get("Authorization"), env);
    if (!claims) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    try {
      if (url.pathname === "/api/sync" && request.method === "POST") {
        const body = (await request.json()) as SyncPayload;
        if (!Array.isArray(body?.sessions)) {
          return json({ error: "sessions[] is required" }, 400, corsHeaders);
        }
        return await handleSync(claims, body, env, corsHeaders);
      }

      if (url.pathname === "/api/state" && request.method === "GET") {
        return await handleGetState(claims, env, corsHeaders);
      }

      if (url.pathname === "/api/leaderboard" && request.method === "GET") {
        return await handleGetLeaderboard(claims, env, corsHeaders);
      }

      return json({ error: "Not Found" }, 404, corsHeaders);
    } catch (err: unknown) {
      console.error(err);
      return json({ error: "Internal Worker Error" }, 500, corsHeaders);
    }
  },
};
