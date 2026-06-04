import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fmtDate, daysDiff } from "../../utils/dateUtils.js";

describe("fmtDate", () => {
  it("formata data válida em pt-BR", () => {
    expect(fmtDate("2026-05-20")).toMatch(/20.*mai/);
  });

  it("retorna — para null", () => {
    expect(fmtDate(null)).toBe("—");
  });

  it("retorna — para string vazia", () => {
    expect(fmtDate("")).toBe("—");
  });

  it("não retorna dia anterior por causa de timezone (UTC-3)", () => {
    // Sem T12:00:00, "2026-05-20" em UTC-3 cai no dia 19
    const result = fmtDate("2026-05-20");
    expect(result).not.toMatch(/19/);
    expect(result).toMatch(/20/);
  });

  it("formata janeiro corretamente", () => {
    expect(fmtDate("2026-01-01")).toMatch(/01.*jan/);
  });

  it("formata dezembro corretamente", () => {
    expect(fmtDate("2026-12-31")).toMatch(/31.*dez/);
  });
});

describe("daysDiff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna null para null", () => {
    expect(daysDiff(null)).toBeNull();
  });

  it("retorna null para string vazia", () => {
    expect(daysDiff("")).toBeNull();
  });

  it("retorna 0 para hoje", () => {
    expect(daysDiff("2026-05-20")).toBe(0);
  });

  it("retorna 1 para amanhã", () => {
    expect(daysDiff("2026-05-21")).toBe(1);
  });

  it("retorna 2 para depois de amanhã", () => {
    expect(daysDiff("2026-05-22")).toBe(2);
  });

  it("retorna -1 para ontem", () => {
    expect(daysDiff("2026-05-19")).toBe(-1);
  });

  it("retorna valor positivo para datas futuras", () => {
    expect(daysDiff("2026-06-20")).toBeGreaterThan(0);
  });
});
