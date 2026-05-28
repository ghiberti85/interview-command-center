import { describe, it, expect } from "vitest";
import { buildPrompt } from "../../utils/buildPrompt.js";

const baseProcess = {
  company: "Nubank",
  role: "Senior FE Engineer",
  stage: "interview",
  recruiter: "Ana Costa",
  salary: "R$ 22.000",
  origin: "inbound",
};

describe("buildPrompt — canais", () => {
  it("canal linkedin gera JSON {body}", () => {
    const prompt = buildPrompt({
      process: baseProcess, channel: "linkedin",
      scenario: "reply_recruiter", scenLabel: "Responder contato inicial",
      recruiterMsg: "", extra: "",
    });
    expect(prompt).toContain('{"body":"mensagem completa"}');
    expect(prompt).not.toContain('"subject"');
  });

  it("canal email gera JSON {subject, body}", () => {
    const prompt = buildPrompt({
      process: baseProcess, channel: "email",
      scenario: "reply_recruiter", scenLabel: "Responder contato inicial",
      recruiterMsg: "", extra: "",
    });
    expect(prompt).toContain('"subject"');
    expect(prompt).toContain('"body"');
  });

  it("canal whatsapp gera JSON {body}", () => {
    const prompt = buildPrompt({
      process: baseProcess, channel: "whatsapp",
      scenario: "reply_recruiter", scenLabel: "Responder contato inicial",
      recruiterMsg: "", extra: "",
    });
    expect(prompt).toContain('{"body":"mensagem completa"}');
  });
});

describe("buildPrompt — origem", () => {
  it("origin inbound menciona que foi contactado", () => {
    const prompt = buildPrompt({
      process: { ...baseProcess, origin: "inbound" }, channel: "linkedin",
      scenario: "reply_recruiter", scenLabel: "Responder contato inicial",
      recruiterMsg: "", extra: "",
    });
    expect(prompt).toContain("contactado por um recrutador");
  });

  it("origin outbound menciona candidatura ativa", () => {
    const prompt = buildPrompt({
      process: { ...baseProcess, origin: "outbound" }, channel: "linkedin",
      scenario: "reply_recruiter", scenLabel: "Responder contato inicial",
      recruiterMsg: "", extra: "",
    });
    expect(prompt).toContain("candidatou ativamente");
  });
});

describe("buildPrompt — recruiterMsg", () => {
  it("com recruiterMsg insere bloco delimitado por aspas triplas", () => {
    const prompt = buildPrompt({
      process: baseProcess, channel: "linkedin",
      scenario: "reply_recruiter", scenLabel: "Responder contato inicial",
      recruiterMsg: "Olá Fernando, temos uma vaga incrível!", extra: "",
    });
    expect(prompt).toContain('"""Olá Fernando, temos uma vaga incrível!"""');
  });

  it("sem recruiterMsg não inclui aspas triplas", () => {
    const prompt = buildPrompt({
      process: baseProcess, channel: "linkedin",
      scenario: "reply_recruiter", scenLabel: "Responder contato inicial",
      recruiterMsg: "", extra: "",
    });
    expect(prompt).not.toContain('"""');
  });
});

describe("buildPrompt — conteúdo geral", () => {
  it("inclui nome da empresa e cargo", () => {
    const prompt = buildPrompt({
      process: baseProcess, channel: "linkedin",
      scenario: "reply_recruiter", scenLabel: "Responder contato inicial",
      recruiterMsg: "", extra: "",
    });
    expect(prompt).toContain("Nubank");
    expect(prompt).toContain("Senior FE Engineer");
  });

  it("inclui contexto extra quando fornecido", () => {
    const prompt = buildPrompt({
      process: baseProcess, channel: "linkedin",
      scenario: "reply_recruiter", scenLabel: "Responder contato inicial",
      recruiterMsg: "", extra: "Tenho preferência por remoto",
    });
    expect(prompt).toContain("Tenho preferência por remoto");
  });

  it("instrui para responder no idioma da mensagem do recrutador", () => {
    const prompt = buildPrompt({
      process: baseProcess, channel: "linkedin",
      scenario: "reply_recruiter", scenLabel: "Responder contato inicial",
      recruiterMsg: "", extra: "",
    });
    expect(prompt).toContain("mesmo idioma da mensagem do recrutador");
  });

  it("proíbe mencionar IA", () => {
    const prompt = buildPrompt({
      process: baseProcess, channel: "linkedin",
      scenario: "reply_recruiter", scenLabel: "Responder contato inicial",
      recruiterMsg: "", extra: "",
    });
    expect(prompt).toContain("Não mencione IA");
  });
});
