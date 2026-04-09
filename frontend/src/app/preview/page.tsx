"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  BarChart3,
  Target,
  Lightbulb,
  BookOpen,
  MessageSquare,
  Lock,
  Download,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Zap,
  Shield,
  Award,
} from "lucide-react";

// ── Mock Data ──────────────────────────────────────────────────

const MOCK_SCORES = {
  match: 74,
  ats: 82,
  format: 91,
};

const MOCK_VERDICT = {
  overall_verdict: "Strong Match",
  match_summary:
    "Your resume demonstrates solid alignment with the target role, with notable strengths in core technical skills.",
  strengths: [
    "Strong proficiency in React, TypeScript, and Node.js — directly matching the core requirements",
    "Demonstrated experience with CI/CD pipelines and cloud infrastructure (AWS)",
    "Quantified achievements with clear impact metrics across multiple roles",
  ],
  weaknesses: [
    "Missing GraphQL and Apollo experience listed as preferred qualifications",
    "No mention of design system contributions or component library work",
    "Could strengthen leadership narrative for senior-level positioning",
  ],
};

const MOCK_CATEGORIES = [
  {
    category: "frontend",
    display_name: "Frontend Development",
    total_job_skills: 8,
    matched_count: 6,
    missing_count: 2,
    match_percentage: 75,
    matched_skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "HTML5", "CSS3"],
    missing_skills: ["GraphQL", "Storybook"],
    priority: "critical" as const,
  },
  {
    category: "backend",
    display_name: "Backend & APIs",
    total_job_skills: 5,
    matched_count: 4,
    missing_count: 1,
    match_percentage: 80,
    matched_skills: ["Node.js", "REST APIs", "PostgreSQL", "Redis"],
    missing_skills: ["Apollo Server"],
    priority: "critical" as const,
  },
  {
    category: "devops",
    display_name: "DevOps & Infrastructure",
    total_job_skills: 4,
    matched_count: 3,
    missing_count: 1,
    match_percentage: 75,
    matched_skills: ["Docker", "AWS", "CI/CD"],
    missing_skills: ["Kubernetes"],
    priority: "important" as const,
  },
  {
    category: "soft_skills",
    display_name: "Soft Skills & Leadership",
    total_job_skills: 3,
    matched_count: 2,
    missing_count: 1,
    match_percentage: 67,
    matched_skills: ["Agile/Scrum", "Code Review"],
    missing_skills: ["Team Leadership"],
    priority: "nice_to_have" as const,
  },
];

const MOCK_MATCHED_SKILLS = [
  { name: "React", confidence: 0.95, category: "Frontend" },
  { name: "TypeScript", confidence: 0.92, category: "Frontend" },
  { name: "Node.js", confidence: 0.88, category: "Backend" },
  { name: "Next.js", confidence: 0.85, category: "Frontend" },
  { name: "PostgreSQL", confidence: 0.82, category: "Backend" },
  { name: "Docker", confidence: 0.78, category: "DevOps" },
  { name: "AWS", confidence: 0.75, category: "DevOps" },
  { name: "Tailwind CSS", confidence: 0.9, category: "Frontend" },
  { name: "REST APIs", confidence: 0.88, category: "Backend" },
  { name: "Redis", confidence: 0.7, category: "Backend" },
];

const MOCK_MISSING_SKILLS = [
  { name: "GraphQL", priority: "high" as const, category: "Frontend" },
  { name: "Kubernetes", priority: "high" as const, category: "DevOps" },
  { name: "Apollo Server", priority: "medium" as const, category: "Backend" },
  { name: "Storybook", priority: "medium" as const, category: "Frontend" },
  { name: "Team Leadership", priority: "low" as const, category: "Soft Skills" },
];

const MOCK_SUGGESTIONS = [
  {
    section: "Experience",
    current: "Built web applications using React and Node.js",
    suggested:
      "Architected and delivered 3 production React/TypeScript applications serving 50K+ MAU, reducing page load times by 40% through code splitting and lazy loading",
    reason: "Quantify impact and specify technologies to match job requirements",
    priority: "high" as const,
    source: "llm" as const,
  },
  {
    section: "Skills",
    current: "JavaScript, React, CSS",
    suggested:
      "React, TypeScript, Next.js, Tailwind CSS, Node.js, PostgreSQL, Docker, AWS, CI/CD, REST APIs",
    reason: "Mirror exact terminology from the job description for ATS optimization",
    priority: "high" as const,
    source: "rule" as const,
  },
  {
    section: "Summary",
    current: "Experienced software developer looking for new opportunities",
    suggested:
      "Senior Frontend Engineer with 6+ years building scalable web applications in React and TypeScript. Proven track record of improving performance, mentoring developers, and shipping user-facing products at scale.",
    reason: "Lead with seniority level and core stack to immediately signal fit",
    priority: "medium" as const,
    source: "llm" as const,
  },
];

// ── Tab definitions ────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "skills", label: "Skills", icon: Target },
  { id: "suggestions", label: "Suggestions", icon: Lightbulb },
  { id: "roadmap", label: "Roadmap", icon: BookOpen, locked: true },
  { id: "advisor", label: "Advisor", icon: MessageSquare, locked: true },
];

// ── Main Preview Page ──────────────────────────────────────────

export default function PreviewPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-950">
      {/* Ambient gradient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-primary-100/40 via-accent-100/20 to-transparent dark:from-primary-950/30 dark:via-accent-950/20 blur-3xl" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-success-100/30 via-primary-100/10 to-transparent dark:from-success-950/20 dark:via-primary-950/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-8">
        {/* Preview Banner */}
        <div className="mb-6 flex items-center gap-2 rounded-full bg-accent-50 dark:bg-accent-950/30 border border-accent-200 dark:border-accent-800/50 px-4 py-2 w-fit">
          <Sparkles className="h-4 w-4 text-accent-500" />
          <span className="text-sm font-medium text-accent-700 dark:text-accent-300">
            UI Preview — Sample Design
          </span>
        </div>

        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="group flex h-10 w-10 items-center justify-center rounded-2xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark-sm border border-gray-100 dark:border-surface-700 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                <ArrowLeft className="h-4.5 w-4.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tightest text-gray-900 dark:text-gray-50">
                  Analysis Results
                </h1>
                <p className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-400 dark:text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  Completed in 12.4s
                </p>
              </div>
            </div>
            <button className="flex items-center gap-2 rounded-xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark-sm border border-gray-100 dark:border-surface-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        </header>

        {/* ── Score Cards ── */}
        <section className="mb-10">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                score: MOCK_SCORES.match,
                label: "Skill Match",
                icon: Target,
                gradient: "from-primary-500 to-accent-500",
                bgGlow: "bg-primary-500/10 dark:bg-primary-500/5",
              },
              {
                score: MOCK_SCORES.ats,
                label: "ATS Score",
                icon: Shield,
                gradient: "from-success-500 to-primary-500",
                bgGlow: "bg-success-500/10 dark:bg-success-500/5",
              },
              {
                score: MOCK_SCORES.format,
                label: "Format Score",
                icon: Award,
                gradient: "from-accent-500 to-primary-500",
                bgGlow: "bg-accent-500/10 dark:bg-accent-500/5",
              },
            ].map(({ score, label, icon: Icon, gradient, bgGlow }) => (
              <div
                key={label}
                className="group relative rounded-2xl bg-white dark:bg-surface-800 border border-gray-100 dark:border-surface-700 p-6 shadow-soft dark:shadow-dark-sm transition-all duration-500 hover:shadow-lg hover:-translate-y-1"
                style={{ perspective: "800px" }}
              >
                {/* Subtle glow behind the card */}
                <div
                  className={`absolute inset-0 rounded-2xl ${bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl scale-110`}
                />

                <div className="flex items-center justify-between mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 dark:bg-surface-700/50">
                    <Icon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {label}
                  </span>
                </div>

                {/* Score Display */}
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-5xl font-bold tracking-tightest text-gray-900 dark:text-gray-50 tabular-nums">
                    {score}
                  </span>
                  <span className="text-lg font-semibold text-gray-300 dark:text-gray-600 mb-1">
                    /100
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-surface-700">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-1000 ease-out`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Verdict Section ── */}
        <section className="mb-10">
          <div className="rounded-2xl bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm border border-gray-100 dark:border-surface-700 shadow-soft dark:shadow-dark-sm overflow-hidden">
            {/* Verdict Header */}
            <div className="px-7 pt-7 pb-5 border-b border-gray-100 dark:border-surface-700/50">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-md">
                  <Sparkles className="h-5.5 w-5.5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-50">
                    Overall Verdict
                  </h2>
                  <span className="inline-flex items-center gap-1.5 mt-1 rounded-full bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800/50 px-3 py-0.5 text-sm font-semibold text-success-700 dark:text-success-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {MOCK_VERDICT.overall_verdict}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {MOCK_VERDICT.match_summary}
              </p>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-surface-700/50">
              {/* Strengths */}
              <div className="p-7">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-success-50 dark:bg-success-900/20">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
                  </div>
                  Strengths
                </h3>
                <ul className="space-y-3">
                  {MOCK_VERDICT.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-success-400 shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {s}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Areas to Improve */}
              <div className="p-7">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-warning-50 dark:bg-warning-900/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning-500" />
                  </div>
                  Areas to Improve
                </h3>
                <ul className="space-y-3">
                  {MOCK_VERDICT.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-warning-400 shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {w}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Tab Navigation ── */}
        <section>
          <div className="flex items-center gap-1 rounded-2xl bg-white dark:bg-surface-800 border border-gray-100 dark:border-surface-700 shadow-soft dark:shadow-dark-sm p-1.5 mb-6">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-md"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700/50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.locked && !isActive && (
                    <Lock className="h-3 w-3 text-gray-300 dark:text-gray-600" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Tab Content ── */}
          <div className="min-h-[400px]">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-4 animate-fade-in">
                {MOCK_CATEGORIES.map((cat) => {
                  const isExpanded = expandedCategory === cat.category;
                  const pct = Math.round(cat.match_percentage);

                  return (
                    <div
                      key={cat.category}
                      className="rounded-2xl bg-white dark:bg-surface-800 border border-gray-100 dark:border-surface-700 shadow-soft dark:shadow-dark-sm overflow-hidden transition-all duration-300 hover:shadow-md"
                    >
                      <button
                        onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                        className="flex w-full items-center gap-5 px-6 py-5 text-left"
                      >
                        {/* Category Icon + Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {cat.display_name}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                cat.priority === "critical"
                                  ? "bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
                                  : cat.priority === "important"
                                    ? "bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400"
                                    : "bg-gray-100 dark:bg-surface-700 text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              {cat.priority === "nice_to_have"
                                ? "Nice to have"
                                : cat.priority.charAt(0).toUpperCase() + cat.priority.slice(1)}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="flex items-center gap-4">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-surface-700">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ease-out ${
                                  pct >= 80
                                    ? "bg-gradient-to-r from-success-400 to-success-500"
                                    : pct >= 60
                                      ? "bg-gradient-to-r from-primary-400 to-primary-500"
                                      : pct >= 40
                                        ? "bg-gradient-to-r from-warning-400 to-warning-500"
                                        : "bg-gradient-to-r from-danger-400 to-danger-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100 w-12 text-right">
                              {pct}%
                            </span>
                          </div>

                          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                            {cat.matched_count} of {cat.total_job_skills} skills matched
                          </p>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
                        ) : (
                          <ChevronDown className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
                        )}
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="border-t border-gray-50 dark:border-surface-700/50 px-6 py-5 animate-fade-in">
                          <div className="grid gap-6 sm:grid-cols-2">
                            {cat.matched_skills.length > 0 && (
                              <div>
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-success-600 dark:text-success-400">
                                  Matched ({cat.matched_skills.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {cat.matched_skills.map((s) => (
                                    <span
                                      key={s}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-success-50 dark:bg-success-900/15 border border-success-100 dark:border-success-800/30 px-3 py-1.5 text-xs font-medium text-success-700 dark:text-success-300"
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {cat.missing_skills.length > 0 && (
                              <div>
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-danger-600 dark:text-danger-400">
                                  Missing ({cat.missing_skills.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {cat.missing_skills.map((s) => (
                                    <span
                                      key={s}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-danger-50 dark:bg-danger-900/15 border border-danger-100 dark:border-danger-800/30 px-3 py-1.5 text-xs font-medium text-danger-700 dark:text-danger-300"
                                    >
                                      <AlertTriangle className="h-3 w-3" />
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Skills Tab */}
            {activeTab === "skills" && (
              <div className="grid gap-5 sm:grid-cols-2 animate-fade-in">
                {/* Matched Skills */}
                <div className="rounded-2xl bg-white dark:bg-surface-800 border border-gray-100 dark:border-surface-700 shadow-soft dark:shadow-dark-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-50 dark:bg-success-900/20">
                        <CheckCircle2 className="h-4 w-4 text-success-500" />
                      </div>
                      Matched Skills
                    </h3>
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-surface-700/50 rounded-full px-2.5 py-1">
                      {MOCK_MATCHED_SKILLS.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {MOCK_MATCHED_SKILLS.map((skill) => {
                      const pct = Math.round(skill.confidence * 100);
                      return (
                        <div
                          key={skill.name}
                          className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-surface-700/30 px-4 py-3 transition-colors hover:bg-gray-100 dark:hover:bg-surface-700/50"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {skill.name}
                            </span>
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                              {skill.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="h-1 w-14 overflow-hidden rounded-full bg-gray-200 dark:bg-surface-600">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-success-400 to-success-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums w-7 text-right">
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Missing Skills */}
                <div className="rounded-2xl bg-white dark:bg-surface-800 border border-gray-100 dark:border-surface-700 shadow-soft dark:shadow-dark-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-danger-50 dark:bg-danger-900/20">
                        <AlertTriangle className="h-4 w-4 text-danger-500" />
                      </div>
                      Skill Gaps
                    </h3>
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-surface-700/50 rounded-full px-2.5 py-1">
                      {MOCK_MISSING_SKILLS.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {MOCK_MISSING_SKILLS.map((skill) => (
                      <div
                        key={skill.name}
                        className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-surface-700/30 px-4 py-3 transition-colors hover:bg-gray-100 dark:hover:bg-surface-700/50"
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {skill.name}
                          </span>
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                            {skill.category}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            skill.priority === "high"
                              ? "bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
                              : skill.priority === "medium"
                                ? "bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400"
                                : "bg-gray-100 dark:bg-surface-700 text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {skill.priority}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Quick insight */}
                  <div className="mt-5 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-950/20 dark:to-accent-950/20 border border-primary-100 dark:border-primary-800/30 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Zap className="h-4 w-4 text-primary-500" />
                      <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                        Quick Insight
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Adding GraphQL and Kubernetes to your skillset would increase your match score
                      to an estimated 88%.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions Tab */}
            {activeTab === "suggestions" && (
              <div className="space-y-4 animate-fade-in">
                {MOCK_SUGGESTIONS.map((s, i) => {
                  const isExpanded = expandedSuggestion === i;
                  return (
                    <div
                      key={i}
                      className="rounded-2xl bg-white dark:bg-surface-800 border border-gray-100 dark:border-surface-700 shadow-soft dark:shadow-dark-sm overflow-hidden transition-all duration-300 hover:shadow-md"
                    >
                      <button
                        onClick={() => setExpandedSuggestion(isExpanded ? null : i)}
                        className="flex w-full items-center gap-4 px-6 py-5 text-left"
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${
                            s.priority === "high"
                              ? "bg-danger-50 dark:bg-danger-900/20"
                              : "bg-warning-50 dark:bg-warning-900/20"
                          }`}
                        >
                          <Lightbulb
                            className={`h-4 w-4 ${
                              s.priority === "high" ? "text-danger-500" : "text-warning-500"
                            }`}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                              {s.section}
                            </span>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                s.priority === "high"
                                  ? "bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
                                  : "bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400"
                              }`}
                            >
                              {s.priority}
                            </span>
                            {s.source === "llm" && (
                              <span className="flex items-center gap-1 text-xs text-accent-500">
                                <Sparkles className="h-3 w-3" />
                                AI
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 line-clamp-1">
                            {s.reason}
                          </span>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
                        ) : (
                          <ChevronDown className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-50 dark:border-surface-700/50 px-6 py-5 space-y-4 animate-fade-in">
                          {s.current && (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Current
                              </p>
                              <p className="rounded-xl bg-danger-50/50 dark:bg-danger-900/10 border border-danger-100 dark:border-danger-800/20 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                {s.current}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                              Suggested
                            </p>
                            <p className="rounded-xl bg-success-50/50 dark:bg-success-900/10 border border-success-100 dark:border-success-800/20 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                              {s.suggested}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Roadmap Tab (Locked) */}
            {activeTab === "roadmap" && (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-surface-700 dark:to-surface-800 shadow-soft dark:shadow-dark-sm">
                    <BookOpen className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                  </div>
                  <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-surface-800 shadow-md border border-gray-100 dark:border-surface-700">
                    <Lock className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Learning Roadmap
                </h3>
                <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 text-center max-w-sm">
                  Get a personalized week-by-week learning plan to close your skill gaps
                </p>
                <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro
                </button>
              </div>
            )}

            {/* Advisor Tab (Locked) */}
            {activeTab === "advisor" && (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-surface-700 dark:to-surface-800 shadow-soft dark:shadow-dark-sm">
                    <MessageSquare className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                  </div>
                  <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-surface-800 shadow-md border border-gray-100 dark:border-surface-700">
                    <Lock className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Resume Advisor
                </h3>
                <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 text-center max-w-sm">
                  AI-powered section-by-section rewrites tailored to the job description
                </p>
                <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Footer spacer */}
        <div className="h-16" />
      </div>
    </div>
  );
}
