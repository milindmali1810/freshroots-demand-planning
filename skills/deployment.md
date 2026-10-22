# Skill: deploy

**Purpose:** `dev` deploys a Vercel preview; `main` deploys production. Merging to `main` is a deliberate, human-approved step.

**Steps**
1. Before pushing: `npm run lint`, `npm test`, `npm run build`. CI (`.github/workflows/ci.yml`) repeats these on every push and PR.
2. Environment variables in Vercel (Project → Settings → Environment Variables): `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `APP_PASSWORD`. Add values in the dashboard yourself; never commit them or paste them into chat.
3. Database migrations are never run by Vercel. Run `npx prisma migrate deploy` locally with `DIRECT_URL` pointing at the target database, before deploying code that needs the new schema.
4. Push `dev` → Vercel builds a preview. Smoke test the preview: log in, run the engine, approve one recommendation, run a pre-placement check, check `/api/health`.
5. Open a PR `dev` → `main`. After CI is green and the owner approves, merge. That deploys production.
6. If production breaks: Vercel → Deployments → promote the last good deployment, then fix forward on `dev`.

**Known limit:** branch protection on `main` needs GitHub Pro or a public repo; until then the "no merge without green CI" rule is by convention.

**Example prompts**
- "Deploy the current dev branch as a preview and run the smoke test."
- "Prepare the dev → main PR with a checklist of what to verify."
- "The preview shows 500 on /api/runs. Check the Vercel runtime logs and find the cause."
