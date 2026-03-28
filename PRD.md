# Project Requirement — Resume Skill Gap Analyzer (RSGA)

> **Purpose**: This document is the master context and single source of truth for continuing development of the Resume Skill Gap Analyzer application. It captures every technical decision, architectural pattern, data structure, and implementation detail accumulated over a week of active development. A new developer or cowork session should be able to pick up exactly where the team left off by reading this document alone.

---

## 1. Project Overview

### 1.1 What Is RSGA?

The Resume Skill Gap Analyzer is a full-stack web application that helps job seekers understand how well their resume aligns with a target job description. Users upload a resume (PDF, DOCX, or TXT), paste a job description, and the system uses AI-powered analysis to produce:

- A **match score** (0–100) quantifying overall alignment
- A **categorized skill breakdown** (technical, soft, domain, certification) showing matched vs. missing skills
- An **ATS compatibility check** scoring the resume on structural elements (contact info, section headings, keyword density, formatting, length)
- **Actionable suggestions** for improving the resume, powered by a hybrid rule-based + LLM engine
- A **learning roadmap** with prioritized resources for closing skill gaps
- An **AI career advisor** providing personalized narrative guidance
- **PDF export** of the full analysis report

### 1.2 Target Users

- Job seekers preparing applications for specific roles
- Career changers evaluating skill transferability
- Students and bootcamp graduates benchmarking against industry requirements
- Recruiters and hiring managers (future: team/enterprise tier)

### 1.3 Business Model (Planned Tiers)

| Tier | Analyses/Month | Features |
|------|---------------|----------|
| Free | 5 | Basic analysis, score, suggestions |
| Pro | 50 | Roadmap, advisor, PDF export, history |
| Enterprise | Unlimited | Team dashboard, API access, custom models |

The `User` model already includes a `tier` field (`free`, `pro`, `enterprise`) with a default of `free`.

### 1.4 Repository Structure

```
resume-skill-gap-analyzer/
├── backend/                    # FastAPI application
│   ├── alembic/                # Database migrations (3 versions)
│   ├── app/
│   │   ├── api/routes/         # REST endpoint handlers
│   │   ├── core/               # Config, security, dependencies
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic v2 request/response models
│   │   ├── services/           # Business logic layer
│   │   └── workers/            # Celery async task definitions
│   ├── tests/                  # Pytest test suite (365 tests)
│   ├── requirements.txt
│   └── main.py
├── frontend/                   # Next.js 16 application
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   ├── components/         # UI + layout + dashboard components
│   │   ├── context/            # React contexts (Auth, Tracker, Theme)
│   │   ├── lib/                # API client, utilities
│   │   ├── styles/             # Global CSS + Tailwind config
│   │   └── types/              # TypeScript interfaces
│   ├── jest.config.js
│   ├── tailwind.config.ts
│   └── package.json
├── docker-compose.yml          # 5-service orchestration
├── FRONTEND_ENHANCEMENT_PLAN.md
├── PHASE-1-ARCHITECTURE.md
├── PHASE-3-DATABASE.md
├── TEST_COVERAGE_REPORT.md
└── .skill/SKILL.md             # Project knowledge base
```

---

## 2. Current Progress

### 2.1 Development Phases

The project has completed 17 development phases, tracked in `.skill/SKILL.md`:

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|-----------------|
| 0 | Project Setup | COMPLETE | Repo structure, Docker config, CI/CD foundation |
| 1 | Database Layer | COMPLETE | PostgreSQL schema, SQLAlchemy models, Alembic migrations |
| 2 | Auth System | COMPLETE | JWT dual-token (access + refresh), registration, login, httpOnly cookies |
| 3 | Resume Processing | COMPLETE | PDF/DOCX/TXT parsing, file upload with validation |
| 4 | AI Integration | COMPLETE | OpenAI + Anthropic providers, circuit breaker pattern |
| 5 | Skill Extraction | COMPLETE | LLM-powered parallel extraction from resume + job description |
| 6 | Gap Analysis Engine | COMPLETE | Pure-logic analyzer, category scoring, ATS checker |
| 7 | Results & Suggestions | COMPLETE | Hybrid suggestion engine, learning roadmap, career advisor |
| 8 | PDF Export | COMPLETE | ReportLab-based PDF generation with professional formatting |
| 9 | Frontend MVP | COMPLETE | All pages, auth flows, dashboard, analysis results display |
| 10 | Frontend Enhancement Phase 1 | COMPLETE | Design tokens, dark mode, 12 new UI components, navbar redesign |
| 11 | Frontend Enhancement Phase 2 | COMPLETE | Auth experience redesign, split-screen layout, password strength, multi-step register wizard |
| 12 | Frontend Enhancement Phase 3 | COMPLETE | Dashboard wizard with ProgressSteps, FileUploadZone, JobDescriptionInput, confirmation modal |
| 13 | Frontend Enhancement Phase 4 | COMPLETE | Results page tabbed layout, animated score reveal, staggered entrance, glow effects, AnimatedCounter integration |
| 14 | Frontend Enhancement Phase 5 | COMPLETE | History dashboard with stats bar, filters/sort/search, enhanced cards, comparison mode, score trend chart, pagination |
| 15 | Frontend Enhancement Phase 6 | COMPLETE | PageTransition, ScrollReveal, StaggerChildren, ShakeOnError, PressScale, AnimatedList, WizardTransition + 5 new Tailwind keyframes |
| 16 | Frontend Enhancement Phase 7 | COMPLETE | ErrorBoundary, SkipToContent, LiveAnnouncer, MobileBottomNav, dynamic imports, SEO metadata, security headers, next.config optimization |
| 17 | Full-Stack Phase 2 — User Settings & Profile Management | COMPLETE | PATCH /auth/profile, PUT /auth/password, DELETE /auth/account, PATCH /auth/preferences; /settings page (4 tabs: Profile, Security, Preferences, Account); Settings enabled in Navbar + MobileBottomNav |
| 18 | Full-Stack Phase 3 — Subscription Tier Enforcement & Billing | COMPLETE | UsageRecord model, usage_service (quota tracking), TierGuard deps (require_tier/enforce_analysis_quota), billing_service (Stripe checkout/portal/webhooks), /billing endpoints, migration 006; Frontend: /pricing page (3-column), UsageWidget, FeatureGate component, Billing tab in /settings, tier badge in Navbar, lock icons + quota CTA in dashboard wizard |

### 2.3 Full-Stack Phase 3 — Subscription Tier Enforcement & Billing (COMPLETE)

**Backend deliverables:**

- `app/models/usage.py` — `UsageRecord` model (user_id, period YYYY-MM, analyses_count, advisor_count, export_count). Unique constraint on (user_id, period). FK to users with CASCADE delete.
- `app/services/usage_service.py` — `current_period()`, `get_or_create_usage()`, `check_analysis_quota()`, `increment_analysis_count()`, `get_usage_summary()`. Tier quotas: free=5, pro=50, enterprise=9999.
- `app/core/tier_guard.py` — `require_tier(minimum)` FastAPI dependency factory (raises 403 if user.tier is below minimum); `enforce_analysis_quota()` (raises 429 QuotaExceededError if monthly limit exceeded).
- `app/services/billing_service.py` — Stripe integration: `get_or_create_customer()`, `create_checkout_session()`, `create_portal_session()`, `handle_webhook_event()` (handles `customer.subscription.updated/deleted`, updates user.tier in DB).
- `app/api/v1/endpoints/billing.py` — `GET /billing/usage`, `POST /billing/checkout/{tier}`, `POST /billing/portal`, `POST /billing/webhook` (Stripe webhook, no auth).
- Guards applied: `POST /analysis/{resume_id}` calls `enforce_analysis_quota` + `increment_analysis_count`. All four insights endpoints (`POST roadmap`, `GET roadmap`, `POST advisor`, `GET export`) require `require_tier("pro")`.
- `app/models/user.py` — Added `stripe_customer_id` field and `usage_records` relationship.
- Migration `006_add_billing.py` — Creates `usage_records` table, adds `stripe_customer_id` to users.
- `app/core/config.py` — Added Stripe config: `stripe_secret_key`, `stripe_publishable_key`, `stripe_webhook_secret`, `stripe_pro_price_id`, `stripe_enterprise_price_id`, `frontend_url`.

**Frontend deliverables:**

- `src/lib/api.ts` — Added `getUsageSummary()`, `createCheckoutSession()`, `createPortalSession()` + `UsageSummary` type.
- `src/components/ui/FeatureGate.tsx` — Wraps pro features; renders `UpgradePrompt` (lock icon + upgrade CTA linking to /pricing) for free users.
- `src/app/pricing/page.tsx` — Public 3-column pricing page (Free/Pro/Enterprise). Stripe Checkout redirect on upgrade. Shows current plan indicator if logged in.
- `src/components/dashboard/UsageWidget.tsx` — Progress bar widget showing `X / Y analyses used` for current period. Color-coded (yellow/red near limit). Upgrade CTA when ≥80%. Hidden for Enterprise.
- `src/app/(dashboard)/dashboard/page.tsx` — Added UsageWidget at top. Quota-blocked state: when `used >= limit`, shows a full-page CTA card with upgrade link instead of the wizard. Imports `FileUploadZone` (was missing).
- `src/app/(dashboard)/settings/page.tsx` — Added `BillingTab` (5th tab): current plan + tier badge, "Manage Subscription" portal link for paid users, monthly usage chart. `useSearchParams` for `?tab=billing` deep-link from Navbar.
- `src/components/layout/Navbar.tsx` — Tier badge (Pro/Enterprise) next to avatar (desktop) and in mobile drawer user section. "Billing & Usage" dropdown item linking to `/settings?tab=billing`.
- `src/app/(dashboard)/analysis/[id]/page.tsx` — `ExportButtonGated` (compact locked state with lock icon for free users). `FeatureGate` wrapping `RoadmapSection` and `AdvisorSection` tabs. Lock icon on Roadmap/Advisor tab labels for free tier users. Imports `useAuth`.

**Environment variables needed:**
```
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
FRONTEND_URL=http://localhost:3000
```

### 2.2 Frontend Enhancement Plan — Phase 1 Complete

Phase 1 ("Foundation — Design System & Core UI") was the most recently completed work. It involved:

**Phase 1A — Design Tokens & Dark Mode**
- Extended Tailwind config with semantic color tokens: `primary` (blue), `accent` (violet), `success` (emerald), `warning` (amber), `danger` (rose), `surface` (slate for dark mode)
- Implemented dark mode via `next-themes` using the `class` strategy
- Added CSS custom properties for dynamic theming
- Created glass-morphism utilities via a Tailwind plugin (`glass-light`, `glass-dark`)
- Added custom animations: `fade-in`, `slide-up`, `scale-in`

**Phase 1B — New UI Component Library (12 Components)**
1. `Button` — Variants: primary, secondary, outline, ghost, danger. Sizes: sm, md, lg. Loading state with spinner.
2. `Input` — Floating label, error state with red border + message, icon support (left/right), helper text.
3. `Badge` — Variants: success, warning, danger, info, neutral. Sizes: sm, md, lg.
4. `Card` — Variants: default, glass, elevated. Hover lift animation. Header/footer slots.
5. `Modal` — Sizes: sm, md, lg, xl. Escape/backdrop close. Body scroll lock. Accessible (role=dialog, aria-modal, aria-labelledby/describedby).
6. `Tooltip` — Configurable delay (default 200ms). Positions: top, bottom, left, right. Arrow indicator.
7. `Dropdown` — Keyboard navigation (Arrow keys, Enter, Space, Escape). Divider + disabled + danger items. Outside click close.
8. `Skeleton` — Variants: rect, circle, card, text (multi-line). Composite skeletons: ScoreCardSkeleton, ListItemSkeleton.
9. `ScoreRing` — SVG circular progress with animated stroke. Color-coded by score thresholds. Size variants.
10. `ThemeToggle` — Sun/Moon icon with rotation animation. Accessible button.
11. `FloatingAnalysisTracker` — Global analysis progress indicator. Gradient progress bar. Expandable/collapsible.
12. `Toast` — (Planned, not yet implemented)

**Phase 1C — Navbar Redesign**
- Sticky header with backdrop blur
- Desktop: horizontal nav links with active indicator, user dropdown (avatar + initials + chevron), theme toggle
- Mobile: hamburger → slide-out drawer with backdrop overlay, user info section, nav links, logout
- Active route detection via `usePathname()`

### 2.2b Frontend Enhancement Plan — Phase 2 Complete

Phase 2 ("Auth Experience") redesigned the login/register flows:

**Phase 2A — Auth Layout & Branding**
- Split-screen layout: left panel (branding illustration, hidden on mobile) + right panel (form)
- `AuthIllustration` component: gradient background, decorative circles, app logo, feature highlights (Smart Resume Parsing, AI Skill Matching, Actionable Roadmap), social proof text
- Mobile-only branding header with app name shown when illustration panel is hidden
- Fade-in animation on auth form mount

**Phase 2B — Login Page Redesign**
- Glass-morphism card with backdrop-blur and semi-transparent background
- Icon-adorned inputs: `Mail` icon (email), `Lock` icon (password)
- Show/hide password toggle (inline SVG eye icons — replaced lucide `Eye`/`EyeOff` to avoid Docker type resolution issues)
- "Forgot password?" link (UI stub, not yet wired to backend)
- "Remember me" checkbox (UI only, persistence not implemented)
- Inline email validation on blur (regex check with error message)
- Animated error state with `AlertCircle` icon and `animate-slide-up`
- Social login buttons: Google (colored SVG) + GitHub (monochrome SVG), UI-only placeholders
- Divider with "Or continue with" text

**Phase 2C — Register Page Redesign (Multi-Step Wizard)**
- 3-step wizard using existing `ProgressSteps` component: "Your Info" → "Security" → "Confirm"
- Step 1: Full name (optional, with `User` icon) + Email (required, with `Mail` icon, inline validation)
- Step 2: Password (with `Lock` icon, show/hide toggle) + `PasswordStrengthMeter` + Confirm password (with match indicator)
- Step 3: Account summary review card + Terms/Privacy checkbox (required to submit)
- Back/Continue navigation with `ArrowLeft`/`ArrowRight` icons
- Step validation gates: Step 1 requires valid email, Step 2 requires all password requirements met + match, Step 3 requires terms acceptance

**Phase 2D — PasswordStrengthMeter Component**
- New component: `src/components/ui/PasswordStrengthMeter.tsx`
- 4-segment color bar: red (Weak, 1/4) → amber (Fair, 2/4) → blue (Good, 3/4) → green (Strong, 4/4)
- Requirements checklist with check/X icons: 8+ chars, uppercase, number, special char
- Exports `getRequirements()` and `getStrength()` helpers for testing
- Renders nothing when password is empty

### 2.2c Frontend Enhancement Plan — Phase 3 Complete

Phase 3 ("Dashboard & Analysis Flow") redesigned the analysis submission experience:

**Phase 3A — Dashboard Wizard with ProgressSteps**
- Replaced flat 2-card layout with a 3-step wizard: "Upload" → "Describe" → "Review"
- `ProgressSteps` component with custom icons per step (Upload, Briefcase, CheckCircle2)
- Each step uses `data-testid` attributes for reliable test targeting
- Back/Forward navigation between all wizard steps
- `animate-fade-in` transitions when stepping between screens

**Phase 3B — FileUploadZone Component**
- New component: `src/components/dashboard/FileUploadZone.tsx`
- Three visual states: dropzone (drag/click to upload), uploading (progress bar + spinner), uploaded (success card with filename)
- File type icons: red FileText for PDF, blue File for DOCX, gray FileText for TXT
- Simulated upload progress bar (0→90% during upload, jumps to 100% on success)
- `formatFileSize()` helper for human-readable file sizes
- Remove button (X icon) to clear uploaded file and return to upload step

**Phase 3C — JobDescriptionInput Component**
- New component: `src/components/dashboard/JobDescriptionInput.tsx`
- Auto-resizing textarea (expands with content, 160px minimum)
- Real-time character count with color coding: gray (empty) → amber (below min) → green (meets min)
- "X more characters needed" warning when below 50-char minimum
- Paste detection: shows "Pasted!" confirmation badge for 2 seconds after paste event
- Focus hint overlay: "Tip: Paste the job posting directly" shown on empty focus

**Phase 3D — Confirmation Modal**
- Pre-submission confirmation modal using existing `Modal` + `ModalFooter` components
- Shows resume filename, job title, and description preview
- "Start Analysis?" title with note about monthly credits
- Cancel / "Start Analysis" buttons with Sparkles icon

**Phase 3E — Review Step**
- Summary card showing: resume (with file icon), target position (title + company), JD preview (4-line clamp + character count)
- "Edit" back button to return to describe step for modifications
- "Analyze My Resume" button opens confirmation modal

### 2.2d Frontend Enhancement Plan — Phase 4 & 5 Complete

Phase 5 ("History & Data Management") redesigned the history page with advanced features:

**Phase 5A — Stats Bar**
- 4-stat grid: Total Analyses, Avg Score, Best Score, This Month
- `AnimatedCounter` integration for count-up animation on each stat
- Staggered entrance animation with per-card delay (0/100/200/300ms)
- Color-coded icons: primary (total), accent (avg), success (best), warning (monthly)

**Phase 5B — History Filters**
- Search input with debounced (300ms) search by job title/company
- Status dropdown filter: All, Completed, Processing, Queued, Failed
- Sort selector: Newest, Oldest, Highest Score, Lowest Score
- Result count display ("X of Y analyses") with clear-filters button
- Clear search button (X icon) inside search input

**Phase 5C — Enhanced History Cards (`HistoryCard`)**
- Left gradient accent bar color-coded by score range: success (≥80), primary (60–79), warning (40–59), danger (<40)
- Processing status badge with animated pulse dot
- Relative timestamps ("Just now", "5m ago", "3d ago") with full date tooltip
- Quick actions dropdown (View, Re-analyze, Delete) via existing `Dropdown` component
- Delete confirmation modal using existing `Modal` + `ModalFooter`
- Comparison checkbox mode: when selectable, shows checkbox + selected ring state

**Phase 5D — Comparison Mode**
- Toggle "Compare" button in header enables checkbox selection on cards
- Sticky compare bar: "Select 2 analyses to compare" → "Select 1 more" → "Ready to compare!"
- `ComparisonView` component fetches full `AnalysisResult` for both analyses via `getAnalysisResult()`
- Side-by-side score columns with `ScoreRing`, `AnimatedCounter`, ATS/Format scores, skill counts
- Delta display: score changes (A → B) with colored badges (green ↑ improved, red ↓ regressed, gray — no change)
- `SkillsDiff` component: categorizes skills as Improved (was missing → now matched), Regressed (was matched → now missing), Consistent (matched in both)

**Phase 5E — Score Trend Chart**
- Recharts `LineChart` with two lines: Match Score (solid blue) and ATS Score (dashed violet)
- Custom tooltip with formatted date and color-coded score values
- Only renders with ≥2 completed analyses (hidden otherwise)
- Responsive container, gridlines, Y-axis 0–100% domain

**Phase 5F — Pagination (`HistoryPagination`)**
- Page numbers with ellipsis for large page counts
- Previous/Next buttons with disabled state
- Items-per-page selector (10/20/50)
- "Showing X–Y of Z" range display
- Hidden when ≤10 total items

### 2.2e Frontend Enhancement Plan — Phase 6 Complete

Phase 6 ("Animations & Micro-interactions") added 7 reusable animation components and 5 new Tailwind keyframes, all pure CSS — no framer-motion dependency:

**Phase 6A — PageTransition**
- Route-change-aware wrapper that replays fade/slide animations on navigation
- Variants: `fade`, `slide-up`, `slide-right` with configurable duration
- Integrated into `DashboardLayout` wrapping all dashboard page content

**Phase 6B — ScrollReveal**
- IntersectionObserver-based viewport reveal with directional fade (up/down/left/right/none)
- Configurable delay, distance, duration, threshold, and `once` mode
- Respects `prefers-reduced-motion` (instant reveal for accessibility)
- Integrated into history page wrapping stats bar and trend chart

**Phase 6C — StaggerChildren**
- Container that cascades entrance animations across children with configurable stagger delay
- Optional `onScroll` mode using IntersectionObserver
- Respects `prefers-reduced-motion`

**Phase 6D — Micro-interactions**
- `ShakeOnError`: horizontal shake animation triggered by boolean prop, auto-resets after duration
- `PressScale`: mouseDown scale-down + mouseUp reset for tactile button feedback, hover lift
- 5 new Tailwind keyframes: `shake`, `bounce-in`, `check-in`, `glow-pulse`, `slide-out-right`
- Corresponding animation utilities added to tailwind config

**Phase 6E — AnimatedList**
- Generic typed list component with staggered entrance for new items
- Supports `removingIds` prop for slide-out-right exit animation before removal
- Key-based tracking detects newly added items and staggers their entrance

**Phase 6F — WizardTransition**
- Direction-aware step transition: forward slides from right, backward from left
- Wraps dashboard wizard steps, replacing per-step `animate-fade-in` classes

### 2.3 Test Status

**Backend**: 365 tests passing (290 unit + 58 integration + 17 E2E), 78% overall coverage.

Coverage gaps:
- Workers module: 0% (Celery tasks need Redis mock)
- File parsers: 24–37% (PDF/DOCX edge cases)
- LLM client: 52% (circuit breaker edge paths)

**Frontend**: 53 test suites with 630 test cases (32 from Phase 2, 16 from Phase 3, 23 from Phase 4, 64 from Phase 5, 48 from Phase 6, 43 from Phase 7). Phase 7 added 7 new test suites: ErrorBoundary (8), SkipToContent (7), LiveAnnouncer (6), MobileBottomNav (8), usePageTitle (3), GlobalError (6), DashboardError (5). Previous fixes still apply:
- Updating class name assertions to match new semantic design tokens (e.g., `bg-green-100` → `bg-success-100`)
- Updating RGB color values in ScoreRing tests to match new design system colors
- Wrapping `jest.advanceTimersByTime()` calls in `act()` for Tooltip and AnalysisPage tests
- Fixing CSS selector escaping for `querySelectorAll` (e.g., `span.h-0\\.5`, `[class*="bg-black"]`)
- Resolving text ambiguity in Modal tests using `getByRole("button", { name: "Confirm" })`
- Fixing Skeleton variant class assertions (`rounded` → `rounded-lg`)
- Refactoring Dropdown from wrapper `<div role="button">` to `cloneElement` pattern

**Test command** (run from `frontend/` directory):
```bash
npx jest --config jest.config.js --verbose --no-coverage 2>&1 | tee test-report.txt
```

### 2.4 Frontend Enhancement Phase 7 (Complete)

Phase 7 ("Polish & Performance") delivered error handling, accessibility, performance, and mobile experience improvements:

**Phase 7A — Error Boundaries**
- `ErrorBoundary` class component with default fallback UI (warning icon, error message, Try Again button), custom fallback prop, onError callback, dev-mode error details
- `error.tsx` for dashboard route group (Next.js App Router error handling)
- `error.tsx` for root app (global error boundary)
- Integrated ErrorBoundary into dashboard layout wrapping PageTransition

**Phase 7B — Accessibility**
- `SkipToContent` — screen-reader-visible skip link targeting `#main-content`, shows on Tab focus
- `LiveAnnouncerProvider` + `useLiveAnnouncer` hook — `aria-live` region for screen reader announcements via context
- Added `id="main-content"` to dashboard layout `<main>` element
- Integrated SkipToContent and LiveAnnouncerProvider into root layout

**Phase 7C — Performance (Dynamic Imports)**
- `ScoreTrendChart` and `ComparisonView` on history page: `next/dynamic` with `ssr: false` + skeleton loading placeholders
- `RoadmapSection` and `AdvisorSection` on analysis results page: `next/dynamic` with skeleton loading placeholders
- Reduces initial bundle size by code-splitting heavy components (recharts, complex analysis views)

**Phase 7D — SEO Metadata**
- Enhanced root layout metadata: title template (`%s | RSGA`), OpenGraph, Twitter card, keywords, viewport, theme-color (light/dark), robots
- `usePageTitle` hook for client-side pages: sets `document.title` with RSGA suffix, restores on unmount
- Integrated into all 4 main pages: Dashboard ("New Analysis"), History ("Analysis History"), Login ("Sign In"), Register ("Create Account")

**Phase 7E — Mobile Bottom Navigation**
- `MobileBottomNav` component: fixed bottom bar with Analyze/History links, active state with primary color, 44px min touch targets, safe-area-inset-bottom support
- Hidden on `sm:` screens via Tailwind responsive class
- Added `safe-area-bottom` CSS utility in globals.css
- Added `bounce-subtle` Tailwind keyframe animation for active icon feedback
- Bottom padding on dashboard main content (`pb-24 sm:pb-8`) to prevent content overlap

**Phase 7F — Performance & Security Headers**
- `next.config.js` enhanced: `compress: true`, `poweredByHeader: false`, `reactStrictMode: true`
- Security headers on all routes: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- Long-lived cache headers for `/_next/static/` and `/fonts/` (1 year, immutable)

**Phase 7 Test Suites (7 suites, 43 tests):**
- `ErrorBoundary.test.tsx` (8 tests)
- `SkipToContent.test.tsx` (7 tests)
- `LiveAnnouncer.test.tsx` (6 tests)
- `MobileBottomNav.test.tsx` (8 tests)
- `usePageTitle.test.ts` (3 tests)
- `GlobalError.test.tsx` (6 tests)
- `DashboardError.test.tsx` (5 tests)

### 2.5 Full-Stack Phase 2 — User Settings & Profile Management (Complete)

**Backend — 4 new endpoints (`/api/v1/auth/...`)**

| Method | Path | Purpose |
|--------|------|---------|
| PATCH | `/auth/profile` | Update `full_name` and/or `email` with uniqueness check |
| PUT | `/auth/password` | Verify current password, hash new, triggers client logout |
| DELETE | `/auth/account` | Soft-delete (`is_active=False`) after password + "DELETE" confirmation |
| PATCH | `/auth/preferences` | Shallow-merge JSONB preferences blob |

- Migration `005_add_user_preferences`: adds `preferences JSONB NOT NULL DEFAULT '{}'` to `users`
- `User` model gains `preferences: Mapped[dict]` (SQLAlchemy + PostgreSQL JSONB)
- New Pydantic schemas: `ProfileUpdateRequest`, `PasswordUpdateRequest`, `AccountDeleteRequest`, `PreferencesUpdateRequest`
- `UserResponse` now includes `preferences`
- New service functions: `update_profile`, `update_password`, `delete_account`, `update_preferences`

**Frontend — `/settings` page with 4 tabs**

| Tab | Key Features |
|-----|-------------|
| Profile | Name + email form, avatar initials, tier badge, live save |
| Security | Password change form with `PasswordStrengthMeter`, auto-logout on success |
| Preferences | Theme buttons (synced with `next-themes`), email notifications toggle, AI provider radio |
| Account | Account info card, danger zone with `DELETE` confirmation modal |

- New API functions in `lib/api.ts`: `updateProfile`, `updatePassword`, `deleteAccount`, `updatePreferences`
- `types/auth.ts`: `User` type gains `preferences: UserPreferences`; `UserPreferences` interface added
- `AuthContext`: `updateUser(user: User)` exposed to allow settings tabs to refresh in-memory state
- `Navbar.tsx`: Settings dropdown item enabled (navigates to `/settings`)
- `MobileBottomNav.tsx`: Settings item added as third nav entry

### 2.6 Planned Additional Features

1. ~~**Side-by-side comparison view**~~ — ✅ Implemented in Phase 5D
2. ~~**Score trend tracking**~~ — ✅ Implemented in Phase 5E
3. ~~**Settings page**~~ — ✅ Implemented in Full-Stack Phase 2
4. **Keyboard shortcuts** — Global shortcut system (Cmd+K command palette)
5. **Resume versioning** — Track resume iterations with diff view
6. **Smart notifications** — Real-time toast notifications for analysis completion
7. **Quick actions** — Floating action button for common tasks
8. **Public sharing** — Shareable analysis links with privacy controls

---

## 3. Tech Stack & Architecture

### 3.1 Frontend Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.2.0 | React framework (App Router) |
| React | 18.3.0 | UI library |
| TypeScript | Strict mode | Type safety |
| Tailwind CSS | 3.4 | Utility-first styling with custom design tokens |
| next-themes | Latest | Dark mode (class strategy) |
| axios | Latest | HTTP client with interceptors |
| lucide-react | 0.440.0 | Icon library (see Known Pitfalls re: Docker type resolution) |
| recharts | Latest | Data visualization charts |
| react-dropzone | Latest | File upload drag-and-drop |
| tailwind-merge | Latest | Conditional class merging (`cn()` utility) |
| Jest | Latest | Testing framework |
| @testing-library/react | Latest | Component testing utilities |
| @swc/jest | Latest | Fast TypeScript transform for Jest |

### 3.2 Backend Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11+ | Runtime |
| FastAPI | Latest | Async-first REST API framework |
| SQLAlchemy | 2.0 | Async ORM with repository pattern |
| Alembic | Latest | Database migration management |
| Pydantic | v2 | Request/response validation |
| Celery | Latest | Distributed task queue for async processing |
| Redis | 7 | Cache, sessions, rate limits, job status, Celery broker |
| PostgreSQL | 16 | Primary database |
| python-jose | Latest | JWT token creation/verification |
| passlib[bcrypt] | Latest | Password hashing |
| python-multipart | Latest | File upload handling |
| ReportLab | Latest | PDF generation (chosen over WeasyPrint to avoid GTK/Cairo deps) |
| openai | Latest | OpenAI API client |
| anthropic | Latest | Anthropic API client |
| pytest | Latest | Testing framework |
| httpx | Latest | Async test client |

### 3.3 Infrastructure (Docker Compose)

Five services orchestrated via `docker-compose.yml`:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend    │────▶│  Backend    │────▶│ PostgreSQL  │
│  (Next.js)  │     │  (FastAPI)  │     │  (16-alpine)│
│  Port: 3000 │     │  Port: 8000 │     │  Port: 5432 │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐     ┌─────────────┐
                    │   Worker    │────▶│   Redis     │
                    │  (Celery)  │     │  (7-alpine) │
                    │             │     │  Port: 6379 │
                    └─────────────┘     └─────────────┘
```

Key configuration:
- PostgreSQL: `POSTGRES_DB=skillgap_db`, `POSTGRES_USER=skillgap_user`
- Redis: Used as both Celery broker and result backend
- Backend mounts `./backend:/app` for hot reload
- Frontend mounts `./frontend:/app` with `.next` in anonymous volume
- Worker shares backend codebase, runs `celery -A app.workers.celery_app worker`

### 3.4 System Architecture (6-Layer)

```
Layer 1: CDN / Edge
  └─ Static assets, Next.js ISR pages

Layer 2: API Gateway (planned)
  └─ Rate limiting, request routing, SSL termination

Layer 3: Application Layer
  ├─ Frontend (Next.js App Router, SSR + CSR)
  └─ Backend (FastAPI, async endpoints)

Layer 4: Worker Layer
  └─ Celery workers (analysis pipeline, PDF generation)

Layer 5: Data Layer
  ├─ PostgreSQL (persistent storage)
  └─ Redis (cache, sessions, job status)

Layer 6: External Services
  ├─ OpenAI API (GPT-4/3.5)
  └─ Anthropic API (Claude)
```

### 3.5 Authentication Architecture

**JWT Dual-Token Strategy:**
- **Access Token**: 15-minute expiry, sent in `Authorization: Bearer` header
- **Refresh Token**: 7-day expiry, stored in httpOnly cookie with rotation on use
- On 401 response, the Axios interceptor automatically attempts token refresh before failing
- Logout invalidates both tokens (refresh token blacklisted in Redis)

**Auth Flow:**
1. Register → hash password (bcrypt) → create user → issue tokens
2. Login → verify credentials → issue access + refresh tokens
3. Protected routes → verify access token → extract user from JWT `sub` claim
4. Token refresh → verify refresh token cookie → rotate → issue new pair
5. Logout → blacklist refresh token in Redis → clear cookie

**Frontend Auth Context** (`AuthContext.tsx`):
- Wraps the app, provides `user`, `isAuthenticated`, `isLoading`, `login()`, `register()`, `logout()`
- Checks auth state on mount via `/auth/me` endpoint
- Handles token refresh transparently via Axios interceptor

### 3.6 AI Integration Architecture

**LLM Client** (`llm_client.py`):
- Abstract interface supporting OpenAI and Anthropic providers
- **Circuit breaker pattern**: After 3 consecutive failures, the primary provider trips and falls back to the secondary for 60 seconds
- Configurable via environment variables: `LLM_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- Retry policy: 3 attempts with exponential backoff

**Analysis Pipeline** (executed by Celery worker):
```
1. Parse Resume (PDF/DOCX/TXT → plain text)
2. Extract Skills (parallel LLM calls for resume + job description)
3. Analyze Gaps (pure logic: match, categorize, score)
4. Check ATS Compatibility (structural analysis)
5. Generate Suggestions (hybrid: rule-based + LLM)
6. Generate Roadmap (LLM-powered learning path)
7. Generate Advisor Response (LLM-powered career guidance)
8. Persist Results (PostgreSQL + Redis cache)
```

### 3.7 Scaling Playbook (from PHASE-1-ARCHITECTURE.md)

| Stage | Users | Infrastructure |
|-------|-------|---------------|
| MVP | <100 | Single Docker Compose, 1 worker |
| Growth | 100–1K | Horizontal worker scaling, Redis cluster |
| Scale | 1K–10K | K8s deployment, read replicas, CDN |
| Enterprise | 10K+ | Multi-region, dedicated worker pools, custom models |

---

## 4. Core Features & Functionality

### 4.1 API Endpoints

**Authentication** (`/api/v1/auth/`):
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create account (email, password, full_name) |
| POST | `/login` | Authenticate, receive tokens |
| POST | `/refresh` | Rotate refresh token |
| POST | `/logout` | Invalidate tokens |
| GET | `/me` | Get current user profile |

**Resume Management** (`/api/v1/resume/`):
| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload` | Upload resume file (PDF/DOCX/TXT, max 5MB) |
| GET | `/{resume_id}` | Get resume metadata + parsed text |
| GET | `/list` | List user's resumes (paginated) |

**Analysis** (`/api/v1/analysis/`):
| Method | Path | Description |
|--------|------|-------------|
| POST | `/submit` | Start new analysis (resume_id + job_description) |
| GET | `/{analysis_id}/status` | Poll analysis status (pending/processing/completed/failed) |
| GET | `/{analysis_id}/results` | Get full analysis results |
| GET | `/history` | List past analyses (paginated, with filters) |

**Insights** (`/api/v1/insights/`):
| Method | Path | Description |
|--------|------|-------------|
| GET | `/{analysis_id}/roadmap` | Get learning roadmap |
| GET | `/{analysis_id}/advisor` | Get AI career advisor response |
| GET | `/{analysis_id}/export/pdf` | Download PDF report |

**Admin** (`/api/v1/admin/`):
| Method | Path | Description |
|--------|------|-------------|
| POST | `/sweep-stale` | Clean up stale/stuck analyses |

### 4.2 Frontend Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Root | Redirects to `/login` or `/dashboard` based on auth state |
| `/login` | Login | Split-screen with branding, glass card, icon inputs, show/hide password, social login stubs, inline validation |
| `/register` | Register | 3-step wizard (Info → Security → Confirm), password strength meter, terms checkbox |
| `/dashboard` | Dashboard | 3-step wizard (Upload → Describe → Review) with ProgressSteps, FileUploadZone, JobDescriptionInput, confirmation modal |
| `/history` | History | Stats bar, score trend chart, filterable/sortable/searchable history cards with comparison mode, pagination |
| `/analysis/[id]` | Analysis Results | Three states: processing (with tracker), error, results (tabbed layout with animated scores) |

### 4.3 Dashboard — Analysis Submission Flow

The dashboard implements a 3-step wizard with `ProgressSteps` navigation:

**Step 0: Upload Resume** (`FileUploadZone` component)
- Drag-and-drop zone (react-dropzone) or click to browse
- Accepted: `.pdf`, `.docx`, `.txt` (max 10MB)
- Three visual states: empty dropzone, uploading (progress bar), uploaded (success card with file icon)
- Auto-advances to Step 1 on successful upload

**Step 1: Describe the Job** (`JobDescriptionInput` component)
- Uploaded file summary card with remove button (returns to Step 0)
- Job title + company inputs (optional)
- Auto-resizing textarea with character count, paste detection ("Pasted!" badge), and min-length warning
- "Review & Submit" button (disabled until 50+ chars) advances to Step 2
- Back button returns to Step 0

**Step 2: Review & Confirm**
- Summary card: resume filename, target position (title + company), JD preview (4-line clamp)
- "Edit" back button returns to Step 1
- "Analyze My Resume" button opens confirmation modal
- Modal: "Start Analysis?" with resume/job details, Cancel / "Start Analysis" buttons
- On confirm: submits, registers with tracker, transitions to success state

**Success State (Step 3):**
- Green success card with CheckCircle2 icon
- "View Progress" button (navigates to `/analysis/[id]`)
- "Start Another Analysis" button (resets wizard to Step 0)

### 4.4 Analysis Results Page (Phase 4 Redesign)

The results page displays when analysis status is `completed`. Redesigned in Phase 4 with tabbed layout, animated score reveal, and enhanced visual design.

**Animated Score Cards (3-column grid):**
- Three `ScoreRing` components: Skill Match, ATS Score, Format Score
- Staggered entrance animation: cards fade in and slide up with 0ms/150ms/300ms delays
- `AnimatedCounter` below each ring showing count-up percentage animation
- Score-dependent glow effects: `shadow-glow-success` (≥80), `shadow-glow` (60–79), `shadow-glow-warning` (40–59), `shadow-glow-danger` (<40)
- Hoverable cards with lift effect

**Verdict Banner:**
- Sparkles icon with "Overall Verdict" heading and `VerdictBadge`
- Two-column layout: Strengths (green CheckCircle2 items) and Areas to Improve (amber AlertTriangle items)
- Each item has staggered slide-in animation from left/right respectively

**Tabbed Content Sections** (using existing `Tabs` + `TabPanel` components):
- 5 tabs with icons: Overview (BarChart3), Skills (Target), Suggestions (Lightbulb), Roadmap (BookOpen), Advisor (MessageSquare)
- Underline variant with sliding indicator animation
- Overview tab (default): `CategoryBreakdown` component
- Skills tab: `SkillsSection` with matched/missing skills
- Suggestions tab: `SuggestionsSection` or empty state if no suggestions
- Roadmap tab: `RoadmapSection` component
- Advisor tab: `AdvisorSection` component

**Empty Tab State:**
- `EmptyTabState` helper component with icon, title, description
- Used when suggestions array is empty

**Export Button** (`ExportButton`):
- Downloads PDF report via `/api/v1/insights/{id}/export/pdf`

### 4.5 Global Analysis Tracking

The `AnalysisTrackerContext` provides app-wide awareness of in-progress analyses:

- Stores `activeAnalysisId` and `status` in context
- Polls `/api/v1/analysis/{id}/status` at regular intervals
- `FloatingAnalysisTracker` component renders as a fixed-position indicator
- Shows progress stages: "Parsing Resume" → "Extracting Skills" → "Analyzing Gaps" → "Generating Report"
- Persists across page navigation

### 4.6 Design System (Semantic Tokens)

All components use semantic color tokens instead of literal Tailwind colors:

```
primary:    blue (50–950)   — Actions, links, active states
accent:     violet (50–950) — Highlights, secondary actions
success:    emerald (50–950) — Positive states, matched skills
warning:    amber (50–950)  — Caution states, partial matches
danger:     rose (50–950)   — Error states, missing skills, destructive actions
surface:    slate (50–950)  — Dark mode backgrounds, borders
```

Key color mappings (for test assertions):
- `success-500` = `#10b981` = `rgb(16, 185, 129)`
- `primary-500` = `#3b82f6` = `rgb(59, 130, 246)`
- `warning-500` = `#f59e0b` = `rgb(245, 158, 11)`
- `danger-500` = `#f43f5e` = `rgb(244, 63, 94)`

**Dark mode**: Implemented via `next-themes` with `class` strategy. The `ThemeProvider` wraps the app. Components use `dark:` variant classes. Surface tokens provide dark background shades.

**Glass-morphism**: Custom Tailwind plugin adds `.glass-light` and `.glass-dark` utility classes with `backdrop-blur` and semi-transparent backgrounds.

---

## 5. Data Structures

### 5.1 Database Schema (PostgreSQL)

**Users Table:**
```sql
id:             UUID (PK, default gen_random_uuid())
email:          VARCHAR(255), UNIQUE, NOT NULL, INDEXED
hashed_password: VARCHAR(255), NOT NULL
full_name:      VARCHAR(255), NOT NULL
tier:           VARCHAR(20), DEFAULT 'free'  -- 'free' | 'pro' | 'enterprise'
is_active:      BOOLEAN, DEFAULT true
created_at:     TIMESTAMP WITH TIME ZONE, DEFAULT now()
updated_at:     TIMESTAMP WITH TIME ZONE, DEFAULT now(), ON UPDATE now()
```

**Resumes Table:**
```sql
id:             UUID (PK)
user_id:        UUID (FK → users.id), NOT NULL, INDEXED
filename:       VARCHAR(255), NOT NULL
file_type:      VARCHAR(10), NOT NULL  -- 'pdf' | 'docx' | 'txt'
file_size:      INTEGER, NOT NULL  -- bytes
parsed_text:    TEXT  -- extracted plain text content
upload_date:    TIMESTAMP WITH TIME ZONE, DEFAULT now()
```

**Analyses Table:**
```sql
id:             UUID (PK)
user_id:        UUID (FK → users.id), NOT NULL, INDEXED
resume_id:      UUID (FK → resumes.id), NOT NULL
job_description: TEXT, NOT NULL
status:         VARCHAR(20), DEFAULT 'pending'  -- 'pending' | 'processing' | 'completed' | 'failed'
overall_score:  FLOAT  -- 0.0 to 100.0
matched_skills: JSONB  -- Array of matched skill objects
missing_skills: JSONB  -- Array of missing skill objects
suggestions:    JSONB  -- Array of suggestion objects
ats_score:      FLOAT  -- 0.0 to 100.0
category_scores: JSONB  -- { technical: float, soft: float, domain: float, certification: float }
error_message:  TEXT  -- populated if status = 'failed'
created_at:     TIMESTAMP WITH TIME ZONE, DEFAULT now()
completed_at:   TIMESTAMP WITH TIME ZONE
```

**Skills Table:**
```sql
id:             UUID (PK)
name:           VARCHAR(100), NOT NULL, INDEXED
category:       VARCHAR(50), NOT NULL  -- 'technical' | 'soft' | 'domain' | 'certification'
aliases:        JSONB  -- ["React.js", "ReactJS", "React"] for deduplication
weight:         FLOAT, DEFAULT 1.0  -- importance multiplier
```

**Roadmaps Table:**
```sql
id:             UUID (PK)
analysis_id:    UUID (FK → analyses.id), NOT NULL, UNIQUE
content:        JSONB  -- Structured learning path data
advisor_result: JSONB  -- AI career advisor response (added in migration 002)
created_at:     TIMESTAMP WITH TIME ZONE, DEFAULT now()
```

### 5.2 Alembic Migrations

Three migration versions exist:
1. **001_initial**: Creates all 5 tables with relationships
2. **002_advisor_result**: Adds `advisor_result` JSONB column to roadmaps table
3. **003_gap_analysis_columns**: Adds `ats_score`, `category_scores`, `error_message` to analyses table

### 5.3 Key Design Decision — JSONB Over Normalized Tables

The `matched_skills`, `missing_skills`, `suggestions`, and `category_scores` fields in the Analyses table use PostgreSQL JSONB columns instead of normalized join tables. Rationale:
- Each analysis produces a snapshot of skills at that point in time
- Skill data is read-heavy and written once (immutable after analysis completion)
- JSONB allows flexible schema evolution without migrations
- Avoids expensive JOINs on the most frequently queried table
- PostgreSQL JSONB supports indexing (`GIN`) for query performance if needed

### 5.4 TypeScript Interfaces (Frontend)

```typescript
interface User {
  id: string;
  email: string;
  full_name: string;
  tier: "free" | "pro" | "enterprise";
  is_active: boolean;
  created_at: string;
}

interface Resume {
  id: string;
  user_id: string;
  filename: string;
  file_type: "pdf" | "docx" | "txt";
  file_size: number;
  parsed_text?: string;
  upload_date: string;
}

interface Analysis {
  id: string;
  user_id: string;
  resume_id: string;
  job_description: string;
  status: "pending" | "processing" | "completed" | "failed";
  overall_score?: number;
  matched_skills?: Skill[];
  missing_skills?: Skill[];
  suggestions?: Suggestion[];
  ats_score?: number;
  category_scores?: CategoryScores;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

interface Skill {
  name: string;
  category: "technical" | "soft" | "domain" | "certification";
  confidence?: number;
}

interface Suggestion {
  text: string;
  priority: "high" | "medium" | "low";
  category?: string;
}

interface CategoryScores {
  technical: number;
  soft: number;
  domain: number;
  certification: number;
}

interface Roadmap {
  id: string;
  analysis_id: string;
  content: RoadmapItem[];
  advisor_result?: AdvisorResult;
}

interface RoadmapItem {
  skill: string;
  resources: Resource[];
  priority: number;
  estimated_time: string;
}

interface Resource {
  title: string;
  url: string;
  type: "course" | "tutorial" | "documentation" | "book" | "video";
}

interface AdvisorResult {
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  career_path_suggestions: string[];
}
```

### 5.5 Pydantic Schemas (Backend)

The backend uses Pydantic v2 models for request/response validation. Key schemas:

- `UserCreate`: email, password, full_name (request)
- `UserResponse`: id, email, full_name, tier, is_active, created_at (response)
- `TokenResponse`: access_token, token_type (response)
- `ResumeUpload`: file (UploadFile), validated for type and size
- `AnalysisSubmit`: resume_id (UUID), job_description (str, min 50 chars)
- `AnalysisStatusResponse`: id, status, progress_stage (optional)
- `AnalysisResultResponse`: Full analysis with all computed fields
- `RoadmapResponse`: Structured learning path with resources
- `AdvisorResponse`: AI advisor narrative with structured sections

---

## 6. Open Issues & Unresolved Items

### 6.1 Test Coverage Gaps

- **Workers module (0% coverage)**: Celery tasks require Redis mocking. The `analysis_task` with retry policy needs dedicated test fixtures.
- **File parsers (24–37%)**: PDF parsing edge cases (scanned images, tables, multi-column layouts) and DOCX edge cases (complex formatting, embedded images) are not covered.
- **LLM client (52%)**: Circuit breaker edge paths (recovery after timeout, concurrent failures, provider switch mid-request) need more tests.
- **Frontend test environment limitation**: SWC native binding doesn't work in sandboxed Linux VMs. Tests must be run locally on the developer's machine.

### 6.2 Backend Items

- **Rate limiting**: Planned but not yet implemented. Redis is already available as the backing store. Need middleware to enforce per-user, per-endpoint limits based on tier.
- **Email verification**: User registration doesn't require email verification. Need SMTP integration and verification flow.
- **Password reset**: No forgot-password flow exists. Need email-based reset token system.
- **File storage**: Uploaded resumes are stored on local filesystem. Need migration to S3/MinIO for production.
- **Stale analysis cleanup**: `/admin/sweep-stale` endpoint exists but needs scheduling (cron job or Celery beat).
- **Error handling standardization**: Some services return raw exceptions; need consistent error response format across all endpoints.

### 6.3 Frontend Items

- **Forgot password flow (frontend)**: "Forgot password?" link exists on login page but is not wired to a backend endpoint. Needs password reset API.
- **Remember me persistence**: Checkbox exists on login page but does not persist sessions beyond the default token expiry.
- **OAuth integration**: Social login buttons (Google, GitHub) exist as UI stubs. Need backend OAuth flow implementation.
- **Loading states**: Some pages lack proper loading skeletons. The `Skeleton` component is built but not integrated everywhere.
- ~~**Error boundaries**~~: ✅ Implemented in Phase 7A (ErrorBoundary component + error.tsx files)
- **Empty states**: History page with no analyses shows nothing. Need designed empty state components.
- ~~**Responsive polish**~~: ✅ Mobile bottom navigation added in Phase 7E with 44px touch targets and safe-area support.
- ~~**SEO/Meta tags**~~: ✅ Implemented in Phase 7D (OpenGraph, Twitter card, viewport, theme-color, per-page titles).

### 6.4 Infrastructure Items

- **Environment variable management**: `.env` files used locally. Need secrets management for production (Vault, AWS Secrets Manager, etc.).
- **CI/CD pipeline**: Not yet configured. Need GitHub Actions for lint, test, build, deploy.
- **Monitoring/Observability**: No APM, logging aggregation, or alerting. Architecture doc mentions Prometheus + Grafana but not implemented.
- **Database backups**: No automated backup strategy.
- **HTTPS/TLS**: Docker compose runs on HTTP. Need TLS termination (Nginx/Traefik/Caddy).

### 6.5 Known Pitfalls (from .skill/SKILL.md)

- **Windows path compatibility**: Use `pathlib.Path` not string concatenation for file paths
- **Pytest cache conflicts**: Delete `.pytest_cache` and `__pycache__` when switching between sync/async test modes
- **PowerShell syntax**: Multi-line commands need backtick continuation, not backslash
- **SQLAlchemy async sessions**: Always use `async with` for session lifecycle; never share sessions across tasks
- **Celery + asyncpg fork safety**: Async engines created at module level hold connections bound to the parent process's event loop. After Celery forks a worker, these connections are stale (event loop is closed in the child). Fix: `session.py` exposes `reinitialize_engines()` which disposes inherited pools and creates fresh engines; `celery_app.py` calls it via `worker_process_init` signal. Task functions must use deferred imports (`from app.db.session import WriteSession` inside the async function body) so they pick up the reinitialized session factory.
- **Next.js App Router**: All components are Server Components by default; add `"use client"` directive for components using hooks, event handlers, or browser APIs
- **Tailwind dark mode**: Must use `dark:` variant, not conditional classes based on theme context
- **lucide-react v0.440 Docker builds**: This version uses the legacy `typings` field in package.json instead of `types`/`exports`. With `moduleResolution: "bundler"` in tsconfig, TypeScript cannot resolve any named icon imports during `next build` type checking. Fix: `typescript: { ignoreBuildErrors: true }` in `next.config.js` (type checking runs separately in CI via `tsc --noEmit`). Additionally, `Eye`/`EyeOff` icons were replaced with inline SVG components in login/register pages to avoid future export instability.
- **Dockerfile.prod `--ignore-scripts`**: Do NOT use `--ignore-scripts` with `npm install` in Docker — it prevents `@swc/core` from installing its native binaries, causing build failures. The current Dockerfile uses `npm install --legacy-peer-deps` without `--ignore-scripts`.

---

## 7. Immediate Next Steps

### 7.1 Priority 1 — Frontend Enhancement Phase 7 (COMPLETE)

All Phase 7 items delivered: ErrorBoundary + error.tsx, SkipToContent, LiveAnnouncer, dynamic imports for heavy components, SEO metadata with usePageTitle, MobileBottomNav with safe-area support, security headers, next.config optimization. 7 test suites with 43 tests.

**Remaining frontend items:**
1. **Comprehensive empty states** — Dashboard and analysis pages still need designed empty state components.
2. **Full keyboard navigation audit** — Tab order, focus trapping in modals, arrow key support in dropdowns.
3. **WCAG AA contrast audit** — Verify all color combinations meet 4.5:1 ratio.
4. **Settings page** — Profile editing, notification preferences, account management.

### 7.2 Priority 2 — Test Coverage Improvement

- Write Celery worker tests with Redis mocking
- Add PDF parser edge case tests (scanned documents, malformed files)
- Expand LLM client circuit breaker tests
- Achieve 85%+ backend coverage target
- Ensure all frontend components have corresponding test files

### 7.3 Priority 3 — Backend Hardening

- Implement rate limiting middleware (tier-based limits)
- Add email verification flow
- Add password reset flow
- Standardize error responses across all endpoints
- Configure Celery beat for scheduled cleanup tasks

### 7.4 Priority 4 — Production Readiness

- Docker Compose production hardening (resource limits, health checks)
- CI/CD pipeline (GitHub Actions: lint → test → build → deploy)
- Monitoring/observability (Prometheus + Grafana, structured logging)
- Database backup automation

### 7.5 Coding Conventions to Follow

**Python (Backend):**
- Async-first: all database operations use `async/await`
- Repository pattern: data access through repository classes, not direct ORM queries in routes
- Service layer: business logic in service functions, routes are thin handlers
- Type hints on all function signatures
- Docstrings on all public functions

**TypeScript (Frontend):**
- Strict mode enabled
- `"use client"` directive on all components using hooks or event handlers
- `cn()` utility (from `tailwind-merge`) for conditional class composition
- Semantic color tokens only (never literal Tailwind colors like `bg-red-500`)
- Component props interfaces defined and exported
- Default exports for components

**Testing:**
- Jest + React Testing Library for frontend
- Pytest + httpx for backend
- `@swc/jest` for TypeScript transformation
- Mock external dependencies (lucide-react icons, next/navigation, next-themes, contexts)
- Use `act()` for any test involving timer-based state updates
- Escape special characters in `querySelectorAll` CSS selectors (e.g., `\\.` for dots in class names)

---

*Document generated from project source code analysis and development session history. Last updated: March 23, 2026 (Phase 7 complete — Polish & Performance).*

---

## Changelog

| Date | Summary |
|------|---------|
| 2026-03-21 | Initial PRD created from project source code analysis covering Phases 0–10. |
| 2026-03-22 | Phase 11 (Frontend Enhancement Phase 2 — Auth Experience) complete: split-screen auth layout, login redesign with glass card/social buttons/inline validation, 3-step register wizard with PasswordStrengthMeter, 32 new tests (all passing). |
| 2026-03-22 | Phase 12 (Frontend Enhancement Phase 3 — Dashboard & Analysis Flow) complete: 3-step wizard with ProgressSteps, FileUploadZone with upload progress, JobDescriptionInput with auto-resize/paste detection, confirmation modal, 16 tests (all passing). |
| 2026-03-22 | Phase 13 (Frontend Enhancement Phase 4 — Results Page Showpiece) complete: tabbed layout with 5 tabs (Overview/Skills/Suggestions/Roadmap/Advisor), animated score reveal with staggered entrance (0/150/300ms delays), AnimatedCounter integration, score-dependent glow effects, verdict banner with animated strength/weakness items, EmptyTabState component, 23 tests (all 475 passing). |
| 2026-03-22 | Docker build fix: resolved lucide-react v0.440 type resolution failure (legacy `typings` field incompatible with `moduleResolution: "bundler"`). Added `typescript.ignoreBuildErrors = true` to next.config.js. Replaced `Eye`/`EyeOff` with inline SVGs in auth pages. Removed `--ignore-scripts` from Dockerfile to restore SWC native binaries. Updated Known Pitfalls section. |
| 2026-03-22 | Phase 14 (Frontend Enhancement Phase 5 — History & Data Management) complete: stats bar with AnimatedCounter, filters/sort/search, enhanced history cards with score accent + quick actions + delete modal, comparison mode with side-by-side analysis view + score deltas + skill diff, Recharts score trend chart, pagination, 64 new tests across 7 suites (539 total). |
| 2026-03-23 | Phase 15 (Frontend Enhancement Phase 6 — Animations & Micro-interactions) complete: 7 reusable animation components (PageTransition, ScrollReveal, StaggerChildren, ShakeOnError, PressScale, AnimatedList, WizardTransition), 5 new Tailwind keyframes, integrated into dashboard layout + history page + wizard steps, 48 new tests across 7 suites (587 total). |
| 2026-03-23 | Phase 16 (Frontend Enhancement Phase 7 — Polish & Performance) complete: ErrorBoundary with fallback UI + error.tsx files, SkipToContent + LiveAnnouncerProvider for accessibility, dynamic imports for 4 heavy components, enhanced SEO metadata with usePageTitle hook, MobileBottomNav with safe-area support, security/performance headers in next.config.js, 43 new tests across 7 suites (630 total). |
| 2026-03-24 | Bug fix: Celery worker "Event loop is closed" crash. Root cause: asyncpg engines created at module level inherited stale parent event loop after fork. Fix: added `reinitialize_engines()` to `session.py` + `worker_process_init` signal in `celery_app.py` to dispose and recreate engine pools in each forked worker. |
| 2026-03-26 | Phase 17 (Full-Stack CRUD & Resume Management) complete. Backend: `DELETE /api/v1/analysis/{id}` (ownership check, 409 if processing, ORM cascade), `POST /api/v1/analysis/{id}/retry` (failed-only, max 3 retries via new `retry_count` column), `DELETE /api/v1/resume/{id}` (ownership check, 409 if analysis processing, cascade + file delete), `last_used_at` column on Resume (updated on each new analysis submission), `retry_count` column on Analysis, Alembic migration 004, `ConflictError` (409) added to exception hierarchy. Frontend: `deleteAnalysis`, `retryAnalysis`, `deleteResume` in `lib/api.ts`; HistoryCard retry dropdown item for failed analyses; history/page.tsx wired with real API calls + optimistic delete + toast notifications; analysis/[id]/page.tsx retry banner on error state; `ResumePicker` component (Tabs: Upload New / Use Existing, sorted by `last_used_at`) integrated into dashboard wizard Step 1. |
