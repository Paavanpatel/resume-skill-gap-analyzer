# Resume Skill Gap Analyzer

## Project Identity

- **Backend**: Python 3.11 / FastAPI in `backend/app/`, PostgreSQL 16, Redis 7, Celery workers
- **Frontend**: Next.js / TypeScript / React in `frontend/src/`, Tailwind CSS
- **Tests**: pytest (`backend/tests/`), Jest + React Testing Library (`frontend/src/**/__tests__/`)
- **CI**: GitHub Actions — lint-backend, lint-frontend, test-backend (70% coverage), test-frontend (78% coverage), build-docker, bundle-size (500kB)
- **Deploy**: Auto on merge to main — Docker images to GHCR — SSH rolling restart with Alembic migrations
- **Git**: `feature/PascalCase` or `fix/PascalCase` branches, PRs to `main`

## Command Reference

```bash
# Run the app (ONLY way — dev compose is NOT configured)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs <service> --tail=50
docker compose -f docker-compose.prod.yml down

# Backend lint/fix
cd backend && ruff check app/ --fix --select I && ruff format app/

# Backend lint verify (no fix)
cd backend && ruff check app/ && ruff format --check app/

# Frontend lint/fix
cd frontend && npx eslint . --fix && npx prettier --write . && npx tsc --noEmit

# Frontend lint verify (no fix)
cd frontend && npx eslint . && npx prettier --check . && npx tsc --noEmit

# Backend tests (activate venv first, run from backend/)
cd backend && .venv/Scripts/activate && pytest tests/ -v
cd backend && .venv/Scripts/activate && pytest tests/ -v --cov=app --cov-fail-under=70

# Frontend tests (run from frontend/)
cd frontend && npx jest --config jest.config.js
cd frontend && npx jest --config jest.config.js --verbose --coverage

# Alembic migration (when models change)
cd backend && alembic revision --autogenerate -m "description"
cd backend && alembic upgrade head

# GitHub CLI
gh pr checks <NUMBER>
gh run view <RUN_ID> --log-failed
gh run list --workflow=deploy.yml --limit=1
```

## Development Workflow (13 Steps)

When the user requests a new feature, enhancement, or bug fix, follow this workflow end-to-end.

```
User: "add feature X"
       |
  [1]  UNDERSTAND -- parse request, identify affected layers
       |
  [2]  PLAN -- list files, migrations, env vars, tests
       |
  [3]  ASK USER -- "Does this plan look right?"
       |
  [4]  BRANCH + IMPLEMENT -- git checkout -b feature/Name, write code
       |
  [5]  LINT & FORMAT -- ruff, eslint, prettier, tsc (auto-fix)
       |
  [6]  WRITE TESTS -- pytest (backend), jest (frontend)
       |
  [7]  FIX FAILURES -- up to 3 attempts, then escalate to user
       |
  [8]  LOCAL CI -- full lint + test + coverage verification
       |
  [9]  FUNCTIONAL VERIFICATION -- spin up stack, hit endpoints, verify it works
       |
 [10]  COMMIT + PUSH -- conventional commits, push to remote
       |
 [11]  CREATE PR -- gh pr create with structured body
       |
 [12]  MONITOR CI -- fix failures/conflicts (3 attempts max)
       |
 [13]  CONFIRM DEPLOY -- check deploy workflow, report status
       |
       "What's next?"
```

### Step 1: Understand the Feature Request

- Parse the request. Identify which layers are affected: backend, frontend, or both.
- Determine if it touches: database models, env vars, API endpoints, UI components, services.
- If the request is genuinely ambiguous, ask the user. If intent is clear, proceed.
- Exit criteria: one-paragraph summary of what to build and which layers are affected.

### Step 2: Plan

Produce a plan listing:
1. Files to create or modify (full paths)
2. Database model changes (if any) — triggers Alembic migration in Step 4
3. New env vars needed (if any) — triggers env var checklist in Step 4
4. API contract changes (new endpoints, changed schemas)
5. Frontend route or component changes
6. Test files to create or modify

### Step 3: Ask User for Plan Approval

Present the plan and ask: "Does this plan look right, or should I adjust anything?"

This is the ONE big checkpoint. After approval, proceed autonomously through Steps 4-13.

### Step 4: Branch and Implement

```bash
git checkout main
git pull origin main
git checkout -b feature/FeatureName   # or fix/FixName
```

Implement following existing patterns:
- **Backend**: models in `backend/app/models/`, schemas in `backend/app/schemas/`, services in `backend/app/services/`, endpoints in `backend/app/api/v1/endpoints/`, repositories in `backend/app/repositories/`
- **Frontend**: components in `frontend/src/components/`, hooks in `frontend/src/hooks/`, pages in `frontend/src/app/`, types in `frontend/src/types/`, API in `frontend/src/lib/api.ts`

**If models changed**, generate Alembic migration:
```bash
cd backend && alembic revision --autogenerate -m "description_of_change"
```
Then READ the generated migration file to verify correctness. Flag any `DROP` operations to the user.

**If new env vars needed**: Add to `.env.example`, `.env.production.example`, and `backend/app/core/config.py` Settings class. Remind user to update local `.env.production`.

**Full-stack features**: implement backend first (models -> schemas -> services -> endpoints), then frontend (types -> API -> components -> pages).

### Step 5: Lint and Format

```bash
# Backend
cd backend && ruff check app/ --fix --select I && ruff format app/

# Frontend
cd frontend && npx eslint . --fix && npx prettier --write . && npx tsc --noEmit
```

Fix all issues. If `tsc --noEmit` reveals type errors, fix them. Proceed autonomously.

### Step 6: Write Tests

- **Backend**: In `backend/tests/unit/test_<module>.py`. Use pytest, unittest.mock.AsyncMock, patch. Fixtures from `backend/tests/integration/conftest.py`.
- **Frontend**: In `frontend/src/<module>/__tests__/<Component>.test.tsx`. Use @testing-library/react, jest.mock(), screen, fireEvent, waitFor.

```bash
# Backend
cd backend && .venv/Scripts/activate && pytest tests/ -v

# Frontend
cd frontend && npx jest --config jest.config.js --verbose
```

### Step 7: Fix Failing Tests

If any test fails: analyze, fix, re-run. Repeat up to 3 times.

After 3 failed attempts, STOP and report to user:
- Which tests are failing
- Error messages
- What was attempted
- Suggested path forward

### Step 8: Local CI Verification

Run the full CI simulation locally:
```bash
# 1. lint-backend
cd backend && ruff check app/ && ruff format --check app/

# 2. lint-frontend
cd frontend && npx eslint . && npx prettier --check . && npx tsc --noEmit

# 3. test-backend with coverage
cd backend && .venv/Scripts/activate && pytest tests/ --cov=app --cov-fail-under=70 -v

# 4. test-frontend with coverage
cd frontend && npx jest --config jest.config.js --coverage
```

### Step 9: Functional Verification

Unit tests passing does not mean the feature works. Verify in a real environment.

```bash
# Start the stack
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps

# Test endpoints (nginx on port 80)
curl -s http://localhost/api/v1/health
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/<endpoint>
curl -s http://localhost/<frontend-route>

# Check logs for errors
docker compose -f docker-compose.prod.yml logs backend --tail=50
docker compose -f docker-compose.prod.yml logs frontend --tail=50

# Tear down
docker compose -f docker-compose.prod.yml down
```

**Verification by feature type:**
| Type | Curl Endpoints | Full Docker Stack | Frontend Render |
|------|---------------|-------------------|----------------|
| Backend API only | Yes | Yes | No |
| Frontend UI only | No | Yes | Yes |
| Full-stack | Yes | Yes | Yes |
| DB migration | Yes (regression) | Yes | No |

If verification fails: check docker logs, fix implementation, re-run Steps 5-9. After 3 cycles, stop and report.

### Step 10: Commit and Push

```bash
git add <specific files>
git status
git commit -m "feat: short description

Longer description explaining why.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git push -u origin feature/FeatureName
```

Commit message rules:
- Prefix: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Subject: imperative mood, under 72 chars, no period
- Body: explain WHY, not WHAT
- Always include Co-Authored-By trailer

Never commit: `.env`, `.env.production`, secrets, `node_modules/`, `__pycache__/`

### Step 11: Create Pull Request

```bash
gh pr create --title "feat: Short description" --body "$(cat <<'EOF'
## Summary
- Bullet point 1
- Bullet point 2

## Changes
- **Backend**: what changed
- **Frontend**: what changed
- **Database**: migration added (if applicable)
- **Env vars**: new vars added (if applicable)

## Test plan
- [ ] Backend unit tests pass
- [ ] Frontend unit tests pass
- [ ] Local lint passes
- [ ] Manual smoke test: (describe what to verify)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

Report the PR URL to the user.

### Step 12: Monitor CI and Fix Failures

```bash
gh pr checks <PR_NUMBER> --watch
```

If a check fails:
1. Read failure log: `gh run view <RUN_ID> --log-failed`
2. Fix locally, commit, push
3. Repeat up to 3 times per failing job

Merge conflict handling:
```bash
git fetch origin main
git merge origin/main
# resolve conflicts
git add -A
git commit -m "chore: resolve merge conflicts with main"
git push
```

After 3 CI fix attempts, stop and report to user.

### Step 13: Confirm Deployment

After PR is merged:
```bash
gh run list --workflow=deploy.yml --limit=1
gh run view <LATEST_RUN_ID>
```

Report deployment status. If deployment failed, diagnose from logs and suggest fix or rollback.

## Autonomy Policy

**Always ask the user:**
- Plan approval (Step 3)
- Ambiguous feature requests
- After 3 failed fix attempts (tests, CI, or verification)
- Non-trivial merge conflicts
- Breaking API changes
- Any destructive git operation

**Proceed autonomously:**
- Implementation (Step 4)
- Lint/format fixing (Step 5)
- Test writing (Step 6)
- First 3 test fix attempts (Step 7)
- Local CI verification (Step 8)
- Functional verification (Step 9)
- Commit, push (Step 10)
- PR creation (Step 11)
- First 3 CI fix iterations (Step 12)

## Rollback Strategies

### Code hasn't been pushed yet (low risk)
```bash
git checkout main
git branch -D feature/FeatureName
```

### PR is open but not merged (low risk)
```bash
# ASK USER FIRST
gh pr close <PR_NUMBER>
git push origin --delete feature/FeatureName
git checkout main && git branch -D feature/FeatureName
```

### PR merged to main (medium risk)
```bash
# ASK USER FIRST
git checkout main && git pull origin main
git revert -m 1 <merge-commit-hash>
git push origin main
```

### Code is deployed and broken (high risk)
```bash
# ASK USER FIRST — act fast, revert first, investigate later
git checkout main && git pull origin main
git revert -m 1 <merge-commit-hash>
git push origin main
# Deploy auto-triggers with the revert
```

### Bad database migration (highest risk)
```bash
# ASK USER FIRST — data loss possible
docker compose -f docker-compose.prod.yml exec backend alembic downgrade -1
```

**Prevention**: Before any Alembic migration, read the generated file line by line. Flag `DROP` operations to the user. Require explicit confirmation before committing migrations that drop columns or tables.

### Rollback autonomy rules

| Scenario | Autonomous | Must ask user |
|----------|-----------|---------------|
| Discard local uncommitted changes | Yes (git stash) | git reset --hard |
| Delete local feature branch | Yes | No |
| Close a PR | No | Always ask |
| Delete remote branch | No | Always ask |
| git revert on main | No | Always ask |
| Force push | Never | Never (forbidden) |
| Alembic downgrade | No | Always ask |
