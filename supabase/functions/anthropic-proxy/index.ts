import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "";

// Simple in-memory rate limiter: max 20 requests per user per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGIN || "*";
  const allowedOrigin = (allowed === "*" || origin === allowed) ? origin || "*" : allowed;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  // JWT is validated by Supabase (verify_jwt: true) — extract user id from header
  const authHeader = req.headers.get("Authorization") ?? "";
  let userId = "anonymous";
  try {
    const jwt = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    userId = payload.sub ?? "anonymous";
  } catch { /* use anonymous */ }

  if (!checkRateLimit(userId)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em 1 minuto." }), {
      status: 429, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "Proxy misconfigured" }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const anthropicRes = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data = await anthropicRes.json();
  return new Response(JSON.stringify(data), {
    status: anthropicRes.status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
});
