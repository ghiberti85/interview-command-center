import { describe, it, expect } from "vitest";
import { rowToProcess, processToRow } from "../../supabase.js";

const baseRow = {
  id: "abc",
  company: "Nubank",
  role: "FE",
  stage: "contacted",
  location: "",
  salary: "",
  recruiter: "",
  recruiter_email: "",
  origin: "inbound",
  contacted_date: "2026-05-01",
  next_step_date: null,
  next_step_note: "",
  job_url: "",
  tags: [],
  notes: "",
  steps: [],
  ai_context: "",
  starred: false,
};

describe("rowToProcess — channel", () => {
  it("mapeia channel: 'linkedin' para process.channel === 'linkedin'", () => {
    const p = rowToProcess({ ...baseRow, channel: "linkedin" });
    expect(p.channel).toBe("linkedin");
  });

  it("mapeia channel: null para process.channel === ''", () => {
    const p = rowToProcess({ ...baseRow, channel: null });
    expect(p.channel).toBe("");
  });

  it("mapeia channel ausente para process.channel === ''", () => {
    const p = rowToProcess({ ...baseRow });
    expect(p.channel).toBe("");
  });

  it("preserva outros canais", () => {
    expect(rowToProcess({ ...baseRow, channel: "whatsapp" }).channel).toBe("whatsapp");
    expect(rowToProcess({ ...baseRow, channel: "email" }).channel).toBe("email");
    expect(rowToProcess({ ...baseRow, channel: "indicacao" }).channel).toBe("indicacao");
  });
});

describe("processToRow — channel", () => {
  const baseProcess = rowToProcess(baseRow);

  it("mapeia channel: 'email' para row.channel === 'email'", () => {
    const row = processToRow({ ...baseProcess, channel: "email" });
    expect(row.channel).toBe("email");
  });

  it("mapeia channel: '' para row.channel === null", () => {
    const row = processToRow({ ...baseProcess, channel: "" });
    expect(row.channel).toBeNull();
  });

  it("round-trip preserva channel", () => {
    const row = processToRow(rowToProcess({ ...baseRow, channel: "linkedin" }));
    expect(row.channel).toBe("linkedin");
  });
});
