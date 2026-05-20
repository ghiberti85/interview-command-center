export const STAGE = {
  contacted: { label: "Contactado", bar: "#22D3EE", badgeBg: "var(--cyan-d)", badgeColor: "var(--cyan)", badgeBorder: "var(--cyan-b)" },
  screening: { label: "Conversa",   bar: "#7C6AFF", badgeBg: "var(--acc-d)",  badgeColor: "var(--acc)",  badgeBorder: "var(--acc-b)"  },
  interview: { label: "Entrevista", bar: "#F5A623", badgeBg: "var(--amb-d)",  badgeColor: "var(--amb)",  badgeBorder: "var(--amb-b)"  },
  technical: { label: "Técnica",    bar: "#A78BFA", badgeBg: "rgba(167,139,250,0.12)", badgeColor: "#A78BFA", badgeBorder: "rgba(167,139,250,0.25)" },
  offer:     { label: "Proposta",   bar: "#22C67A", badgeBg: "var(--grn-d)",  badgeColor: "var(--grn)",  badgeBorder: "var(--grn-b)"  },
  rejected:  { label: "Encerrado",  bar: "#FF6A6A", badgeBg: "var(--red-d)",  badgeColor: "var(--red)",  badgeBorder: "var(--red-b)"  },
  archived:  { label: "Arquivado",  bar: "var(--t3)", badgeBg: "var(--bg-s)", badgeColor: "var(--t3)",   badgeBorder: "var(--border)" },
};

export const ACTIVE_STAGES = ["contacted", "screening", "interview", "technical", "offer"];

export const CHANNELS = {
  linkedin: { label: "LinkedIn", icon: "linkedin", color: "#0A66C2", accent: "#378FE9", bg: "rgba(10,102,194,0.12)", border: "rgba(10,102,194,0.3)", hint: "Tom profissional e direto. Máximo 3 parágrafos curtos." },
  email:    { label: "E-mail",   icon: "email",    color: "#6366F1", accent: "#A5B4FC", bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.3)", hint: "Tom formal mas caloroso. Inclui assunto, saudação e despedida." },
  whatsapp: { label: "WhatsApp", icon: "whatsapp", color: "#25D366", accent: "#4AE07A", bg: "rgba(37,211,102,0.12)", border: "rgba(37,211,102,0.3)", hint: "Tom leve e conversacional. Curto, sem formalidades." },
};

export const SCENARIOS = [
  { id: "reply_recruiter",   label: "Responder contato inicial" },
  { id: "confirm_interest",  label: "Confirmar interesse"       },
  { id: "schedule_first",    label: "Agendar primeira conversa" },
  { id: "confirm_interview", label: "Confirmar entrevista"      },
  { id: "reschedule",        label: "Remarcar horário"          },
  { id: "post_interview",    label: "Follow-up pós-entrevista"  },
  { id: "ask_feedback",      label: "Pedir feedback"            },
  { id: "negotiate_offer",   label: "Negociar proposta"         },
  { id: "accept_offer",      label: "Aceitar proposta"          },
  { id: "decline_offer",     label: "Declinar proposta"         },
];
