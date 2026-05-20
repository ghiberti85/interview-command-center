import { http, HttpResponse } from "msw";
import { mockProcesses, mockSession } from "./fixtures.js";

const SUPABASE_URL = "https://sumzkwjthwcdtjqheehn.supabase.co";
const AI_PROXY_URL = "https://sumzkwjthwcdtjqheehn.supabase.co/functions/v1/anthropic-proxy";

export const handlers = [
  // Auth — login com senha
  http.post(`${SUPABASE_URL}/auth/v1/token`, () =>
    HttpResponse.json(mockSession)
  ),

  // Auth — magic link / OTP
  http.post(`${SUPABASE_URL}/auth/v1/otp`, () =>
    HttpResponse.json({})
  ),

  // Auth — password reset email
  http.post(`${SUPABASE_URL}/auth/v1/recover`, () =>
    HttpResponse.json({})
  ),

  // Auth — get session
  http.get(`${SUPABASE_URL}/auth/v1/user`, () =>
    HttpResponse.json(mockSession.user)
  ),

  // Auth — update user (set password)
  http.put(`${SUPABASE_URL}/auth/v1/user`, () =>
    HttpResponse.json(mockSession.user)
  ),

  // Auth — sign out
  http.post(`${SUPABASE_URL}/auth/v1/logout`, () =>
    HttpResponse.json({})
  ),

  // Processes — GET
  http.get(`${SUPABASE_URL}/rest/v1/processes`, () =>
    HttpResponse.json(mockProcesses.map(p => ({
      id: p.id, company: p.company, role: p.role, stage: p.stage,
      location: p.location, salary: p.salary, recruiter: p.recruiter,
      recruiter_email: p.recruiterEmail, origin: p.origin,
      contacted_date: p.contactedDate, next_step_date: p.nextStepDate,
      next_step_note: p.nextStepNote, job_url: p.jobUrl, tags: p.tags,
      notes: p.notes, steps: p.steps, ai_context: p.aiContext,
      starred: p.starred, user_id: "user-uuid-1",
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    })))
  ),

  // Processes — INSERT
  http.post(`${SUPABASE_URL}/rest/v1/processes`, () =>
    HttpResponse.json({}, { status: 201 })
  ),

  // Processes — UPSERT / UPDATE
  http.patch(`${SUPABASE_URL}/rest/v1/processes`, () =>
    HttpResponse.json({}, { status: 200 })
  ),

  // Processes — DELETE
  http.delete(`${SUPABASE_URL}/rest/v1/processes`, () =>
    new HttpResponse(null, { status: 204 })
  ),

  // AI proxy
  http.post(AI_PROXY_URL, () =>
    HttpResponse.json({
      content: [{ type: "text", text: '{"body":"Olá Fernando, obrigado pelo contato."}' }],
    })
  ),
];

// Handlers de erro para sobrescrever em testes específicos
export const errorHandlers = {
  authInvalid: http.post(`${SUPABASE_URL}/auth/v1/token`, () =>
    HttpResponse.json({ error: "invalid_grant", error_description: "Invalid login credentials" }, { status: 400 })
  ),
  aiRateLimit: http.post(AI_PROXY_URL, () =>
    HttpResponse.json({ error: "Rate limit exceeded. Tente novamente em 1 minuto." }, { status: 429 })
  ),
  dbError: http.get(`${SUPABASE_URL}/rest/v1/processes`, () =>
    HttpResponse.json({ message: "JWT expired" }, { status: 401 })
  ),
};
