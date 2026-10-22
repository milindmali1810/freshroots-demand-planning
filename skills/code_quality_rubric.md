# Rubric: code quality

Score each item pass / needs work. Anything marked **(must)** blocks a merge.

- **(must)** `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` all pass.
- **(must)** No secrets in code, logs, commits or docs; `.env*` is ignored except `.env.example`.
- **(must)** The engine in `src/lib/engine/` is pure: no database, network, clock or environment reads. Dates come in as arguments.
- Thresholds live in `src/config/engine.ts`, never as magic numbers in logic.
- Every API route uses `route()` and zod validation, returns `{ error: { code, message } }`, and uses the right status code.
- Database access is in `src/lib/services/`; route files stay thin.
- Every page has loading and error states; failures show a plain-English message and a retry.
- Changes are small and traceable: each changed line serves the request; no drive-by refactors.
- Names and comments explain *why*, not *what*. New logic has a test.
- Logs are structured JSON (`src/lib/logger.ts`) for runs, decisions and guardrail halts.
