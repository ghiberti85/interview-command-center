import { describe, it, expect } from "vitest";
import { STAGE, ACTIVE_STAGES, CHANNELS, SCENARIOS } from "../../utils/constants.js";

describe("STAGE", () => {
  const requiredKeys = ["contacted", "screening", "interview", "technical", "offer", "rejected", "archived"];
  const requiredFields = ["label", "bar", "badgeBg", "badgeColor", "badgeBorder"];

  it("tem exatamente as 7 chaves esperadas", () => {
    expect(Object.keys(STAGE)).toEqual(requiredKeys);
  });

  requiredKeys.forEach(key => {
    it(`${key} tem todos os campos obrigatórios`, () => {
      requiredFields.forEach(field => {
        expect(STAGE[key]).toHaveProperty(field);
        expect(STAGE[key][field]).toBeTruthy();
      });
    });

    it(`${key}.label é uma string não vazia`, () => {
      expect(typeof STAGE[key].label).toBe("string");
      expect(STAGE[key].label.length).toBeGreaterThan(0);
    });
  });
});

describe("ACTIVE_STAGES", () => {
  it("tem exatamente 4 itens", () => {
    expect(ACTIVE_STAGES).toHaveLength(4);
  });

  it("não contém rejected", () => {
    expect(ACTIVE_STAGES).not.toContain("rejected");
  });

  it("não contém archived", () => {
    expect(ACTIVE_STAGES).not.toContain("archived");
  });

  it("não contém screening", () => {
    expect(ACTIVE_STAGES).not.toContain("screening");
  });

  it("todos os itens existem em STAGE", () => {
    ACTIVE_STAGES.forEach(s => {
      expect(STAGE).toHaveProperty(s);
    });
  });

  it("contém os stages ativos esperados", () => {
    ["contacted", "interview", "technical", "offer"].forEach(s => {
      expect(ACTIVE_STAGES).toContain(s);
    });
  });
});

describe("CHANNELS", () => {
  const channels = ["linkedin", "email", "whatsapp"];
  const requiredFields = ["label", "icon", "color", "accent", "bg", "border", "hint"];

  it("tem exatamente 3 canais", () => {
    expect(Object.keys(CHANNELS)).toHaveLength(3);
  });

  channels.forEach(ch => {
    it(`${ch} tem todos os campos`, () => {
      requiredFields.forEach(field => {
        expect(CHANNELS[ch]).toHaveProperty(field);
      });
    });
  });
});

describe("SCENARIOS", () => {
  it("tem 10 cenários", () => {
    expect(SCENARIOS).toHaveLength(10);
  });

  it("todos têm id e label", () => {
    SCENARIOS.forEach(s => {
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("label");
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    });
  });

  it("ids são únicos", () => {
    const ids = SCENARIOS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contém reply_recruiter", () => {
    expect(SCENARIOS.find(s => s.id === "reply_recruiter")).toBeTruthy();
  });
});
