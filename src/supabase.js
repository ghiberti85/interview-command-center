import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  };
}
