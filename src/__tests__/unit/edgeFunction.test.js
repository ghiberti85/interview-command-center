import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, corsHeaders } from "../../../supabase/functions/anthropic-proxy/utils.ts";

describe("checkRateLimit", () => {
  let map;

  beforeEach(() => {
    map = new Map();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("primeira chamada retorna true", () => {
    expect(checkRateLimit(map, "user1")).toBe(true);
  });

  it("20ª chamada retorna true", () => {
    for (let i = 0; i < 20; i++) checkRateLimit(map, "user1");
    // A 20ª já foi feita, agora testamos que as primeiras 19 passaram
    const newMap = new Map();
    for (let i = 0; i < 19; i++) checkRateLimit(newMap, "user1");
    expect(checkRateLimit(newMap, "user1")).toBe(true); // 20ª
  });

  it("21ª chamada no mesmo minuto retorna false", () => {
    for (let i = 0; i < 20; i++) checkRateLimit(map, "user1");
    expect(checkRateLimit(map, "user1")).toBe(false); // 21ª
  });

  it("após reset de 60s, primeira chamada retorna true", () => {
    for (let i = 0; i < 20; i++) checkRateLimit(map, "user1");
    expect(checkRateLimit(map, "user1")).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit(map, "user1")).toBe(true);
  });

  it("limites de usuários são independentes", () => {
    for (let i = 0; i < 20; i++) checkRateLimit(map, "user1");
    expect(checkRateLimit(map, "user1")).toBe(false);
    expect(checkRateLimit(map, "user2")).toBe(true);
  });
});

describe("corsHeaders", () => {
  it("ALLOWED_ORIGIN=* aceita qualquer origin", () => {
    const headers = corsHeaders("https://app.example.com", "*");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
  });

  it("origin igual ao allowedOrigin retorna o origin", () => {
    const headers = corsHeaders("https://app.example.com", "https://app.example.com");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
  });

  it("origin diferente do allowedOrigin retorna allowedOrigin (não o origin malicioso)", () => {
    const headers = corsHeaders("https://evil.com", "https://app.example.com");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.example.com");
  });

  it("inclui métodos e headers permitidos", () => {
    const headers = corsHeaders("https://app.com", "*");
    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
    expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
  });
});
