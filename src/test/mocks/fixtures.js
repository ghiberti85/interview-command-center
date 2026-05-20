export const mockProcesses = [
  {
    id: "p1", company: "Nubank", role: "Senior FE Engineer", stage: "interview",
    location: "Remoto", salary: "R$ 22.000", recruiter: "Ana Costa",
    recruiterEmail: "ana@nubank.com.br", origin: "inbound",
    contactedDate: "2026-05-01", nextStepDate: "2026-05-22",
    nextStepNote: "Entrevista técnica", jobUrl: "", tags: ["react", "typescript", "fintech"],
    notes: "Time de design system.", steps: [
      { date: "2026-05-01", type: "contacted", note: "LinkedIn" },
      { date: "2026-05-08", type: "screening", note: "Conversa com recruiter" },
    ], aiContext: "", starred: true,
  },
  {
    id: "p2", company: "Spotify", role: "Senior SWE — Web", stage: "offer",
    location: "Remoto (global)", salary: "USD 140k", recruiter: "James H.",
    recruiterEmail: "j@spotify.com", origin: "outbound",
    contactedDate: "2026-04-10", nextStepDate: "2026-05-25",
    nextStepNote: "Prazo para aceitar proposta", jobUrl: "https://spotify.com/jobs/1",
    tags: ["typescript", "streaming"], notes: "Equity incluído.", steps: [],
    aiContext: "", starred: true,
  },
  {
    id: "p3", company: "Stone", role: "FE Engineer", stage: "rejected",
    location: "Rio de Janeiro", salary: "R$ 15.000", recruiter: "Mariana S.",
    recruiterEmail: "m@stone.com", origin: "inbound",
    contactedDate: "2026-04-05", nextStepDate: null,
    nextStepNote: "", jobUrl: "", tags: ["vue"], notes: "Buscavam Vue.",
    steps: [], aiContext: "", starred: false,
  },
];

export const mockUser = { id: "user-uuid-1", email: "fernando@test.com" };

export const mockSession = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  user: mockUser,
};
