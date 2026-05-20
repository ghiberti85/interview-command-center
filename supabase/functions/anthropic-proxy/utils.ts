type RateLimitEntry = { count: number; resetAt: number };

export function checkRateLimit(
  map: Map<string, RateLimitEntry>,
  userId: string,
  limit = 20,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const entry = map.get(userId);
  if (!entry || now > entry.resetAt) {
    map.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export function corsHeaders(origin: string, allowedOrigin: string): Record<string, string> {
  const effectiveOrigin =
    allowedOrigin === "*" || origin === allowedOrigin ? origin || "*" : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": effectiveOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
