import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
  },
});

// Map DB row → app process object
export function rowToProcess(row) {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    stage: row.stage,
    location: row.location || "",
    salary: row.salary || "",
    recruiter: row.recruiter || "",
    recruiterEmail: row.recruiter_email || "",
    origin: row.origin || "inbound",
    contactedDate: row.contacted_date || "",
    nextStepDate: row.next_step_date || null,
    nextStepNote: row.next_step_note || "",
    jobUrl: row.job_url || "",
    tags: row.tags || [],
    notes: row.notes || "",
    steps: row.steps || [],
    aiContext: row.ai_context || "",
    starred: row.starred || false,
    channel: row.channel || "",
  };
}

// Map DB row → cv_adaptation object
export function rowToCVAdaptation(row) {
  return {
    id: row.id,
    userId: row.user_id,
    processId: row.process_id,
    content: row.content,
    jdSnapshot: row.jd_snapshot || null,
    qaAnswers: row.qa_answers || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Map cv_adaptation object → DB row
export function cvAdaptationToRow(a) {
  return {
    user_id: a.userId,
    process_id: a.processId,
    content: a.content,
    jd_snapshot: a.jdSnapshot || null,
    qa_answers: a.qaAnswers || null,
  };
}

// Map app process object → DB row
export function processToRow(p) {
  return {
    id: p.id,
    company: p.company,
    role: p.role,
    stage: p.stage,
    location: p.location || "",
    salary: p.salary || "",
    recruiter: p.recruiter || "",
    recruiter_email: p.recruiterEmail || "",
    origin: p.origin || "inbound",
    contacted_date: p.contactedDate || null,
    next_step_date: p.nextStepDate || null,
    next_step_note: p.nextStepNote || "",
    job_url: p.jobUrl || "",
    tags: p.tags || [],
    notes: p.notes || "",
    steps: p.steps || [],
    ai_context: p.aiContext || "",
    starred: p.starred || false,
    channel: p.channel || null,
  };
}
