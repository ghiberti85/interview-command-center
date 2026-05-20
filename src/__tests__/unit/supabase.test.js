import { describe, it, expect } from "vitest";
import { rowToProcess, processToRow } from "../../supabase.js";

const fullRow = {
  id: "abc123",
  company: "Nubank",
  role: "Senior FE",
  stage: "interview",
  location: "Remoto",
  salary: "R$ 22k",
  recruiter: "Ana",
  recruiter_email: "ana@nu.com.br",
  origin: "inbound",
  contacted_date: "2026-05-01",
  next_step_date: "2026-05-22",
  next_step_note: "Entrevista técnica",
  job_url: "https://nubank.com/jobs/1",
  tags: ["react", "typescript"],
  notes: "Time de design system.",
  steps: [{ date: "2026-05-01", type: "contacted", note: "LinkedIn" }],
  ai_context: "Contexto extra",
  starred: true,
};

describe("rowToProcess", () => {
  it("mapeia campos snake_case para camelCase", () => {
    const p = rowToProcess(fullRow);
    expect(p.recruiterEmail).toBe("ana@nu.com.br");
    expect(p.contactedDate).toBe("2026-05-01");
    expect(p.nextStepDate).toBe("2026-05-22");
    expect(p.nextStepNote).toBe("Entrevista técnica");
    expect(p.jobUrl).toBe("https://nubank.com/jobs/1");
    expect(p.aiContext).toBe("Contexto extra");
  });

  it("preserva campos diretos", () => {
    const p = rowToProcess(fullRow);
    expect(p.id).toBe("abc123");
    expect(p.company).toBe("Nubank");
    expect(p.stage).toBe("interview");
    expect(p.starred).toBe(true);
  });

  it("preserva arrays", () => {
    const p = rowToProcess(fullRow);
    expect(p.tags).toEqual(["react", "typescript"]);
    expect(p.steps).toHaveLength(1);
    expect(p.steps[0].type).toBe("contacted");
  });

  it("usa fallback vazio para recruiter_email ausente", () => {
    const p = rowToProcess({ ...fullRow, recruiter_email: null });
    expect(p.recruiterEmail).toBe("");
  });

  it("usa fallback [] para tags ausente", () => {
    const p = rowToProcess({ ...fullRow, tags: null });
    expect(p.tags).toEqual([]);
  });

  it("usa fallback [] para steps ausente", () => {
    const p = rowToProcess({ ...fullRow, steps: null });
    expect(p.steps).toEqual([]);
  });

  it("usa fallback false para starred ausente", () => {
    const p = rowToProcess({ ...fullRow, starred: null });
    expect(p.starred).toBe(false);
  });

  it("usa fallback inbound para origin ausente", () => {
    const p = rowToProcess({ ...fullRow, origin: null });
    expect(p.origin).toBe("inbound");
  });
});

describe("processToRow", () => {
  const process = rowToProcess(fullRow);

  it("mapeia campos camelCase para snake_case", () => {
    const row = processToRow(process);
    expect(row.recruiter_email).toBe("ana@nu.com.br");
    expect(row.contacted_date).toBe("2026-05-01");
    expect(row.next_step_date).toBe("2026-05-22");
    expect(row.next_step_note).toBe("Entrevista técnica");
    expect(row.job_url).toBe("https://nubank.com/jobs/1");
    expect(row.ai_context).toBe("Contexto extra");
  });

  it("round-trip reproduz valores", () => {
    const row = processToRow(rowToProcess(fullRow));
    expect(row.company).toBe(fullRow.company);
    expect(row.stage).toBe(fullRow.stage);
    expect(row.recruiter_email).toBe(fullRow.recruiter_email);
    expect(row.job_url).toBe(fullRow.job_url);
  });

  it("converte contactedDate vazio para null", () => {
    const row = processToRow({ ...process, contactedDate: "" });
    expect(row.contacted_date).toBeNull();
  });

  it("converte nextStepDate vazio para null", () => {
    const row = processToRow({ ...process, nextStepDate: "" });
    expect(row.next_step_date).toBeNull();
  });

  it("preserva starred", () => {
    expect(processToRow(process).starred).toBe(true);
    expect(processToRow({ ...process, starred: false }).starred).toBe(false);
  });
});
