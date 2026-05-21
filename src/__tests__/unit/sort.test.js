import { describe, it, expect } from "vitest";
import { sortProcesses } from "../../App.jsx";

const makeProcess = (overrides = {}) => ({
  id: crypto.randomUUID(),
  company: "Empresa",
  role: "Dev",
  stage: "contacted",
  contactedDate: "2026-05-01",
  nextStepDate: null,
  channel: "",
  tags: [],
  starred: false,
  origin: "inbound",
  ...overrides,
});

describe("sortProcesses — urgencia", () => {
  it("coloca nextStepDate mais próxima primeiro", () => {
    const list = [
      makeProcess({ id:"a", nextStepDate:"2026-06-10" }),
      makeProcess({ id:"b", nextStepDate:"2026-05-25" }),
      makeProcess({ id:"c", nextStepDate:"2026-05-22" }),
    ];
    const sorted = sortProcesses(list, "urgencia");
    expect(sorted[0].id).toBe("c");
    expect(sorted[1].id).toBe("b");
    expect(sorted[2].id).toBe("a");
  });

  it("coloca nextStepDate nula por último", () => {
    const list = [
      makeProcess({ id:"a", nextStepDate:null }),
      makeProcess({ id:"b", nextStepDate:"2026-05-25" }),
    ];
    const sorted = sortProcesses(list, "urgencia");
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
  });
});

describe("sortProcesses — empresa", () => {
  it("ordena alfabeticamente por company (case-insensitive)", () => {
    const list = [
      makeProcess({ id:"a", company:"Zara" }),
      makeProcess({ id:"b", company:"alpha" }),
      makeProcess({ id:"c", company:"Mercado Livre" }),
    ];
    const sorted = sortProcesses(list, "empresa");
    expect(sorted[0].id).toBe("b"); // alpha
    expect(sorted[1].id).toBe("c"); // Mercado Livre
    expect(sorted[2].id).toBe("a"); // Zara
  });
});

describe("sortProcesses — stage", () => {
  it("ordena pela ordem do pipeline", () => {
    const list = [
      makeProcess({ id:"a", stage:"offer" }),
      makeProcess({ id:"b", stage:"contacted" }),
      makeProcess({ id:"c", stage:"interview" }),
    ];
    const sorted = sortProcesses(list, "stage");
    expect(sorted[0].id).toBe("b"); // contacted=0
    expect(sorted[1].id).toBe("c"); // interview=2
    expect(sorted[2].id).toBe("a"); // offer=4
  });
});

describe("sortProcesses — recente", () => {
  it("coloca contactedDate mais recente primeiro", () => {
    const list = [
      makeProcess({ id:"a", contactedDate:"2026-04-01" }),
      makeProcess({ id:"b", contactedDate:"2026-05-20" }),
      makeProcess({ id:"c", contactedDate:"2026-05-10" }),
    ];
    const sorted = sortProcesses(list, "recente");
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("c");
    expect(sorted[2].id).toBe("a");
  });

  it("coloca contactedDate ausente por último", () => {
    const list = [
      makeProcess({ id:"a", contactedDate:"" }),
      makeProcess({ id:"b", contactedDate:"2026-05-01" }),
    ];
    const sorted = sortProcesses(list, "recente");
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
  });
});

describe("sortProcesses — não mutável", () => {
  it("não muta o array original", () => {
    const list = [
      makeProcess({ id:"a", company:"Z" }),
      makeProcess({ id:"b", company:"A" }),
    ];
    const original = [...list];
    sortProcesses(list, "empresa");
    expect(list[0].id).toBe(original[0].id);
  });
});
