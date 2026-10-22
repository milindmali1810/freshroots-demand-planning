# Skill: change an engine rule or threshold safely

**Purpose:** change a threshold or rule without silently changing what Raghav's recommendations mean.

**Where things live:** thresholds in `src/config/engine.ts`; logic in `src/lib/engine/index.ts` (pure TypeScript, no database); tests in `src/lib/engine/engine.test.ts`. Every Run saves a snapshot of the config it used (`Run.configSnapshot`), so old runs stay explainable.

**Steps**
1. Write down the business reason and who approved it (Raghav for cover/surge rules, Deepa for guardrail and kill metrics).
2. Run `npm test` first. All tests must pass before you touch anything.
3. Change the value in `src/config/engine.ts` only. Do not hard-code numbers in the engine.
4. If the change alters behaviour, add or update a test that shows it. The four required examples (Ex1–Ex4) must keep passing with case pack = 1; if one has to change, stop and ask.
5. Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
6. Run the engine on the current data in a dev environment and compare flag counts with the previous run. Explain any large shift.
7. Note the change in `HANDOFF.md` (Decisions made) and the README assumptions list.

**Example prompts**
- "Raghav wants perishable max cover at 5 weeks instead of 4. Change it safely and show how today's flags move."
- "Change the festival window from 4 weeks to 6 weeks. Update tests and explain what breaks."
- "Lower the large-order exception to ₹3 lakh once unit prices are loaded."
