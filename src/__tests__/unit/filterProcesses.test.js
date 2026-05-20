import { describe, it, expect } from "vitest";
import { filterProcesses } from "../../utils/filterProcesses.js";

const processes = [
  { id: "1", company: "Nubank",  role: "Senior FE",   stage: "interview", tags: ["react", "fintech"] },
  { id: "2", company: "Spotify", role: "SWE",          stage: "offer",     tags: ["typescript"]       },
  { id: "3", company: "Stone",   role: "FE Engineer",  stage: "rejected",  tags: ["vue"]              },
  { id: "4", company: "VTEX",    role: "Tech Lead",    stage: "interview", tags: ["react", "node"]    },
];

describe("filterProcesses — busca por texto", () => {
  it("sem busca retorna todos", () => {
    expect(filterProcesses(processes, "", "all")).toHaveLength(4);
  });

  it("filtra por company (case-insensitive)", () => {
    const result = filterProcesses(processes, "nubank", "all");
    expect(result).toHaveLength(1);
    expect(result[0].company).toBe("Nubank");
  });

  it("filtra por company em uppercase", () => {
    const result = filterProcesses(processes, "SPOTIFY", "all");
    expect(result).toHaveLength(1);
    expect(result[0].company).toBe("Spotify");
  });

  it("filtra por role", () => {
    const result = filterProcesses(processes, "tech lead", "all");
    expect(result).toHaveLength(1);
    expect(result[0].company).toBe("VTEX");
  });

  it("filtra por tag", () => {
    const result = filterProcesses(processes, "vue", "all");
    expect(result).toHaveLength(1);
    expect(result[0].company).toBe("Stone");
  });

  it("retorna múltiplos resultados para busca genérica", () => {
    const result = filterProcesses(processes, "react", "all");
    expect(result).toHaveLength(2);
  });

  it("busca sem resultado retorna array vazio", () => {
    expect(filterProcesses(processes, "xyzabc", "all")).toHaveLength(0);
  });
});

describe("filterProcesses — filtro por stage", () => {
  it("stageFilter=all retorna todos", () => {
    expect(filterProcesses(processes, "", "all")).toHaveLength(4);
  });

  it("filtra por stage interview", () => {
    const result = filterProcesses(processes, "", "interview");
    expect(result).toHaveLength(2);
    result.forEach(p => expect(p.stage).toBe("interview"));
  });

  it("filtra por stage offer", () => {
    const result = filterProcesses(processes, "", "offer");
    expect(result).toHaveLength(1);
    expect(result[0].company).toBe("Spotify");
  });

  it("stage sem correspondência retorna vazio", () => {
    expect(filterProcesses(processes, "", "technical")).toHaveLength(0);
  });
});

describe("filterProcesses — combinação", () => {
  it("stage + busca combinados", () => {
    const result = filterProcesses(processes, "react", "interview");
    expect(result).toHaveLength(2);
  });

  it("stage + busca sem match", () => {
    const result = filterProcesses(processes, "vue", "interview");
    expect(result).toHaveLength(0);
  });
});
