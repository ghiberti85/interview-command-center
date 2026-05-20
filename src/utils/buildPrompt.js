import { STAGE, CHANNELS } from "./constants.js";

export function buildPrompt({ process, channel, scenario, scenLabel, recruiterMsg, extra }) {
  const ch = CHANNELS[channel];
  return `Você é um assistente especializado em comunicação profissional para processos seletivos de tecnologia.
Candidato: Fernando, Senior Full-Stack Engineer / Front-End Tech Lead (React, Next.js, Node.js, TypeScript, Supabase, liderança técnica).
Contexto: ${process.origin === "outbound" ? "Fernando se candidatou ativamente para esta vaga." : "Fernando foi contactado pelo recrutador — ele não aplica ativamente."}
Empresa: ${process.company} | Cargo: ${process.role} | Etapa: ${STAGE[process.stage]?.label} | Recrutador(a): ${process.recruiter || "—"} | Salário: ${process.salary || "—"}
${recruiterMsg ? `\nMensagem do recrutador:\n"""${recruiterMsg}"""\n` : ""}Canal: ${ch.label} | Tom: ${ch.hint} | Objetivo: ${scenLabel}${extra ? `\nContexto extra: ${extra}` : ""}
${channel === "email"
  ? `Responda EXATAMENTE neste JSON (sem markdown):\n{"subject":"assunto","body":"corpo completo"}`
  : `Responda EXATAMENTE neste JSON (sem markdown):\n{"body":"mensagem completa"}`}
A resposta deve soar natural e humana. Não mencione IA. Em português.`;
}
