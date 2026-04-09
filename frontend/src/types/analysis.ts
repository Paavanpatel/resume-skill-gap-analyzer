/**
 * TypeScript types for the analysis domain.
 *
 * These mirror the backend Pydantic schemas exactly.
 * Updated in Phase 8 to include Phase 6 gap analysis types.
 */

// ── Skill types ─────────────────────────────────────────────

export interface Skill {
  name: string;
  confidence: number; // 0.0 - 1.0
  category: string;
  source?: "resume" | "job_description";
}

export interface MissingSkill {
  name: string;
  priority: "high" | "medium" | "low";
  category: string;
  weight?: number;
}

// ── Resume suggestion ───────────────────────────────────────

export interface ResumeSuggestion {
  section: string;
  current: string;
  suggested: string;
  reason: string;
  priority?: "high" | "medium" | "low";
  source?: "rule" | "llm";
}

// ── Category breakdown (Phase 6) ────────────────────────────

export interface CategoryBreakdown {
  category: string;
  display_name: string;
  total_job_skills: number;
  matched_count: number;
  missing_count: number;
  match_percentage: number;
  matched_skills: string[];
  missing_skills: string[];
  priority: "critical" | "important" | "nice_to_have";
}

// ── Score explanation (Phase 6) ─────────────────────────────

export interface ScoreExplanation {
  match_score: number;
  ats_score: number;
  match_summary: string;
  ats_summary: string;
  strengths: string[];
  weaknesses: string[];
  overall_verdict: string;
}

// ── ATS check (Phase 6) ────────────────────────────────────

export interface ATSIssue {
  severity: "error" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  fix: string;
}

export interface ATSCheck {
  issues: ATSIssue[];
  format_score: number;
  passed_checks: number;
  total_checks: number;
}

// ── Analysis result ─────────────────────────────────────────

export interface AnalysisResult {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  match_score: number | null;
  ats_score: number | null;
  matched_skills: Skill[];
  missing_skills: MissingSkill[];
  resume_skills: Skill[];
  job_skills: Skill[];
  suggestions: ResumeSuggestion[];
  category_breakdowns: CategoryBreakdown[];
  score_explanation: ScoreExplanation | null;
  ats_check: ATSCheck | null;
  processing_time_ms: number | null;
  ai_provider: string | null;
  ai_model: string | null;
  ai_tokens_used: number | null;
  suggestions_limited?: boolean;
  created_at: string;
}

// ── Async job types ─────────────────────────────────────────

export interface AnalysisSubmitResponse {
  job_id: string;
  status: string;
  estimated_seconds: number;
  status_url: string;
  ws_url: string;
}

export interface AnalysisStatusResponse {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number; // 0-100
  current_step: string | null;
  error_message: string | null;
}

// ── History ─────────────────────────────────────────────────

export interface AnalysisHistoryItem {
  id: string;
  job_title: string | null;
  job_company: string | null;
  match_score: number | null;
  ats_score: number | null;
  status: string;
  created_at: string;
}

// ── Roadmap (Phase 9) ──────────────────────────────────────

export interface RoadmapPhase {
  week_range: string;
  focus: string;
  objectives: string[];
  resources: string[];
}

export interface RoadmapResponse {
  id: string;
  analysis_id: string;
  total_weeks: number;
  phases: RoadmapPhase[];
}

// ── Resume Advisor (Phase 9) ───────────────────────────────

export interface SectionRewrite {
  section: string;
  original: string;
  rewritten: string;
  changes_made: string[];
  confidence: number;
}

export interface AdvisorResponse {
  rewrites: SectionRewrite[];
  overall_summary: string;
}

// ── Resume types ────────────────────────────────────────────

export interface ResumeUploadResponse {
  id: string;
  original_filename: string;
  file_type: string;
  file_size_bytes: number;
  created_at: string;
  last_used_at: string | null;
}

export interface PaginatedResumeResponse {
  resumes: ResumeUploadResponse[];
  total: number;
  skip: number;
  limit: number;
}
