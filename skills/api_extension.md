# Skill: add or change an API endpoint

**Purpose:** keep every endpoint consistent: zod validation, `{ error: { code, message } }` errors, correct status codes, structured logs.

**Steps**
1. Create `src/app/api/<path>/route.ts`. Wrap each handler in `route("<METHOD> <path>", async (req, ctx) => ...)` from `src/lib/api.ts`.
2. Validate input with zod (`parseBody` for JSON, `schema.parse` for query strings, `parseId` for path ids). Throw `ApiError(status, CODE, message)` for expected failures: 400 invalid, 401 not logged in, 404 missing, 409 conflict, 422 not allowed in this state.
3. Put database logic in `src/lib/services/`, not in the route file. Log meaningful events with `logger`.
4. Do not add `export const dynamic` (Next 16 with `cacheComponents` rejects it). Dynamic route params are Promises: `await ctx.params`.
5. The login gate (`src/proxy.ts`) protects every route except `/login`, `/api/login`, `/api/logout` and `/api/health`.
6. Smoke test with curl against `npm run dev` (log in first for the cookie), including the error cases. Record results in `HANDOFF.md`. Delete any test rows you created.

**Example prompts**
- "Add GET /api/skus to list SKUs with their latest flag, with the same error format."
- "Add an endpoint to export a run's approved quantities as CSV for procurement."
- "Add DELETE /api/flags/[id] so Raghav can end an event flag early."
