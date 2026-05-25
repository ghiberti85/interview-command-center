import { describe, it, expect } from "vitest";
import {
  isChatGPTFormat,
  isICCFormat,
  looksLikeRecruitment,
  parseCSV,
  normalizeProcess,
} from "../../utils/importHelpers.js";

// ── isChatGPTFormat ──────────────────────────────────────────────────────────

describe("isChatGPTFormat", () => {
  it("retorna true para array com campo mapping", () => {
    expect(isChatGPTFormat([{ mapping: {}, title: "Conversa" }])).toBe(true);
  });

  it("retorna false para array vazio", () => {
    expect(isChatGPTFormat([])).toBe(false);
  });

  it("retorna false para array sem mapping", () => {
    expect(isChatGPTFormat([{ company: "Nubank", role: "Dev" }])).toBe(false);
  });

  it("retorna false para não-array", () => {
    expect(isChatGPTFormat(null)).toBe(false);
    expect(isChatGPTFormat("string")).toBe(false);
    expect(isChatGPTFormat({ mapping: {} })).toBe(false);
  });

  it("retorna false para objeto isolado com mapping (não array)", () => {
    expect(isChatGPTFormat({ mapping: {} })).toBe(false);
  });
});

// ── isICCFormat ──────────────────────────────────────────────────────────────

describe("isICCFormat", () => {
  it("retorna true para array com campo company", () => {
    expect(isICCFormat([{ company: "Nubank", role: "Dev", stage: "contacted" }])).toBe(true);
  });

  it("retorna false para array vazio", () => {
    expect(isICCFormat([])).toBe(false);
  });

  it("retorna false para array sem company", () => {
    expect(isICCFormat([{ mapping: {} }])).toBe(false);
  });

  it("retorna false para não-array", () => {
    expect(isICCFormat(null)).toBe(false);
    expect(isICCFormat("string")).toBe(false);
  });
});

// ── looksLikeRecruitment ─────────────────────────────────────────────────────

describe("looksLikeRecruitment", () => {
  it("detecta 'recrutador' no título", () => {
    expect(looksLikeRecruitment({ title: "Conversa com recrutador" })).toBe(true);
  });

  it("detecta 'job' (inglês)", () => {
    expect(looksLikeRecruitment({ title: "Senior job offer" })).toBe(true);
  });

  it("detecta 'vaga' (português)", () => {
    expect(looksLikeRecruitment({ title: "Vaga de Dev React" })).toBe(true);
  });

  it("detecta 'interview'", () => {
    expect(looksLikeRecruitment({ title: "Technical interview at Nubank" })).toBe(true);
  });

  it("detecta 'desenvolvedor'", () => {
    expect(looksLikeRecruitment({ title: "Oportunidade para desenvolvedor" })).toBe(true);
  });

  it("retorna false para conversa genérica", () => {
    expect(looksLikeRecruitment({ title: "Como fazer pizza margherita" })).toBe(false);
  });

  it("é case-insensitive", () => {
    expect(looksLikeRecruitment({ title: "RECRUTADOR SENIOR" })).toBe(true);
  });

  it("retorna false para título vazio", () => {
    expect(looksLikeRecruitment({ title: "" })).toBe(false);
  });

  it("retorna false quando título é undefined", () => {
    expect(looksLikeRecruitment({})).toBe(false);
  });
});

// ── parseCSV ─────────────────────────────────────────────────────────────────

describe("parseCSV", () => {
  it("parseia CSV simples com cabeçalho", () => {
    const csv = `company,role,stage\nNubank,Senior FE,interview`;
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].company).toBe("Nubank");
    expect(result[0].role).toBe("Senior FE");
    expect(result[0].stage).toBe("interview");
  });

  it("parseia múltiplas linhas", () => {
    const csv = `company,role\nNubank,Dev\nSpotify,SWE\nStone,Tech Lead`;
    expect(parseCSV(csv)).toHaveLength(3);
  });

  it("filtra linhas sem company", () => {
    const csv = `company,role\nNubank,Dev\n,SemEmpresa`;
    expect(parseCSV(csv)).toHaveLength(1);
  });

  it("aceita campo 'empresa' (português)", () => {
    const csv = `empresa,role\nNubank,Dev`;
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].empresa).toBe("Nubank");
  });

  it("retorna array vazio para CSV sem dados (só cabeçalho)", () => {
    expect(parseCSV("company,role")).toHaveLength(0);
  });

  it("retorna array vazio para texto vazio", () => {
    expect(parseCSV("")).toHaveLength(0);
  });

  it("retorna array vazio para uma única linha sem cabeçalho", () => {
    expect(parseCSV("somente uma linha")).toHaveLength(0);
  });

  it("remove aspas duplas dos valores", () => {
    const csv = `company,role\n"Nubank","Senior FE"`;
    const result = parseCSV(csv);
    expect(result[0].company).toBe("Nubank");
    expect(result[0].role).toBe("Senior FE");
  });

  it("converte cabeçalhos para minúsculas", () => {
    const csv = `Company,Role\nNubank,Dev`;
    const result = parseCSV(csv);
    expect(result[0]).toHaveProperty("company");
    expect(result[0]).toHaveProperty("role");
  });

  it("suporta quebra de linha Windows (\\r\\n)", () => {
    const csv = "company,role\r\nNubank,Dev\r\nSpotify,SWE";
    expect(parseCSV(csv)).toHaveLength(2);
  });

  it("campos ausentes ficam como string vazia", () => {
    const csv = `company,role,stage\nNubank,Dev`;
    const result = parseCSV(csv);
    expect(result[0].stage).toBe("");
  });
});

// ── normalizeProcess ─────────────────────────────────────────────────────────

describe("normalizeProcess", () => {
  it("preserva campos válidos do processo ICC", () => {
    const input = {
      id: "test-id",
      company: "Nubank",
      role: "Senior FE",
      stage: "interview",
      origin: "inbound",
      location: "Remoto",
      salary: "R$ 25k",
      recruiter: "Ana",
      recruiterEmail: "ana@nu.com",
      contactedDate: "2026-05-01",
      notes: "Ótima vaga",
      tags: ["react", "typescript"],
    };
    const result = normalizeProcess(input);
    expect(result.id).toBe("test-id");
    expect(result.company).toBe("Nubank");
    expect(result.role).toBe("Senior FE");
    expect(result.stage).toBe("interview");
    expect(result.origin).toBe("inbound");
    expect(result.tags).toEqual(["react", "typescript"]);
  });

  it("stage inválido cai para 'contacted'", () => {
    expect(normalizeProcess({ company: "X", stage: "nao_existe" }).stage).toBe("contacted");
  });

  it("origin 'outbound' preservado", () => {
    expect(normalizeProcess({ company: "X", origin: "outbound" }).origin).toBe("outbound");
  });

  it("origin desconhecido → 'inbound'", () => {
    expect(normalizeProcess({ company: "X", origin: "qualquer" }).origin).toBe("inbound");
  });

  it("fallback de company para 'Empresa?'", () => {
    expect(normalizeProcess({}).company).toBe("Empresa?");
  });

  it("fallback de role para 'Cargo?'", () => {
    expect(normalizeProcess({}).role).toBe("Cargo?");
  });

  it("aceita alias português 'empresa'", () => {
    expect(normalizeProcess({ empresa: "Stone" }).company).toBe("Stone");
  });

  it("aceita alias português 'cargo'", () => {
    expect(normalizeProcess({ cargo: "Tech Lead" }).role).toBe("Tech Lead");
  });

  it("tags como string separada por ; vira array", () => {
    const result = normalizeProcess({ company: "X", tags: "react;node;typescript" });
    expect(result.tags).toEqual(["react", "node", "typescript"]);
  });

  it("tags array mantido como array", () => {
    const result = normalizeProcess({ company: "X", tags: ["react", "node"] });
    expect(result.tags).toEqual(["react", "node"]);
  });

  it("sem tags → array vazio", () => {
    expect(normalizeProcess({ company: "X" }).tags).toEqual([]);
  });

  it("gera id quando ausente", () => {
    const result = normalizeProcess({ company: "X" });
    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
  });

  it("recruiterEmail aceita alias 'email'", () => {
    const result = normalizeProcess({ company: "X", email: "teste@email.com" });
    expect(result.recruiterEmail).toBe("teste@email.com");
  });

  it("convTitle null quando ausente", () => {
    expect(normalizeProcess({ company: "X" }).convTitle).toBeNull();
  });

  it("convTitle preservado quando presente", () => {
    expect(normalizeProcess({ company: "X", convTitle: "Conversa ChatGPT" }).convTitle).toBe("Conversa ChatGPT");
  });
});
