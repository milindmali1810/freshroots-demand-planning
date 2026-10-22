# Freshroots Demand Planning App (MESA Case 01: Deepa's 90-Day Mandate)

1. Freshroots: regional FMCG (Maharashtra, Goa), ~1,200 distributors, ~400 SKUs.
2. Deepa Nair (Head of Ops) has ₹15 lakh and 90 days; we build Demand Planning (Option A).
3. A deterministic rules engine (no ML) recommends reorder quantities; Raghav approves/overrides; procurement orders. The buying decision stays human.
4. Stack is FIXED: Next.js (App Router) + TypeScript, Prisma, Postgres on Neon, Vercel, npm, GitHub (`main` = production, `dev` = development).
5. Full spec lives in `docs/BUILD_SPEC.md` (Part B). Read it before building.

## Operating mode (short form of Part A)
- Work autonomously on routine tasks: create files, install project deps, run scripts/tests, commit on `dev`, run dev servers. Don't re-decide the stack. Use current stable package versions.
- Use GitHub / Neon / Vercel MCP or CLI when authenticated; if login is needed, give me the single command, then continue.
- Run phases continuously. Stop ONLY for: (1) opening questions; (2) secrets — name the variable and file, I paste the value, never print/commit one; (3) Step 0 CSV column mapping approval; (4) actions outside the project folder (sudo, global installs, shell profiles, deletes outside root); (5) irreversible/costly actions (force-push, history rewrite, dropping tables with data, merging to `main`, paid plans); (6) tests failing after 3 fix attempts.
- Keep chat output minimal: one line per action. Detail goes in HANDOFF.md.
- Update `HANDOFF.md` after EVERY completed task and commit `chore: checkpoint — <task>`; update it before any long step or `/compact`.

@HANDOFF.md

**Rule:** If the user types `continue`, run the Verify-state commands in HANDOFF.md, report in 3 lines whether saved state matches reality, fix HANDOFF.md if not, then continue from Next 3 actions.
