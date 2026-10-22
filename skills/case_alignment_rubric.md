# Rubric: case alignment (MESA Case 01, Deepa's 90-day mandate)

Check these after every meaningful change. If any answer is "no", fix it or flag it to Deepa.

1. **The buying decision stays human.** The engine only recommends. Nothing places an order; every quantity needs an Approve, Override or Reject from a person with a reason code.
2. **Exceptions route to Raghav.** Any E1–E7 hit becomes an EXCEPTION with no automatic quantity, and shows on `/exceptions` with a plain-English reason.
3. **The guardrail works.** A run whose total exceeds 1.5× the all-SKUs-at-standard-order total is HALTED, saves no recommendations, and shows the "manual planning" banner. (Known weakness: as specified it can only trigger through case-pack rounding. Raise with Deepa.)
4. **The pre-placement check works.** Approved orders are re-checked for latest-week swing (≥20%), top-10 distributor cuts (≥30%, needs distributor sales) and new event flags; a HOLD needs a named owner's decision.
5. **Kill metrics are visible.** Dashboard shows override rate (warns above 30%), exception rate against the expected 15–20%, and the ₹34 lakh quarterly-loss kill rule. Reporting only; Deepa decides.
6. **It is rules, not ML.** Forecasts come from AVG4/AVG12, the festival factor and the surge test. No model training.
7. **Honest about limits.** On-order, price, lead time, case pack and distributor-level sales are missing; outputs say "on-order unavailable" and skipped checks are listed.
8. **Planner can use it on Monday morning** without help: run, read the reason, decide, check before placing.
