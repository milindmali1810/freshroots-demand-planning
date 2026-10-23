# Freshroots Demand Planning: One-Pager

*23 October 2026*

A weekly planning app that tells Raghav what to reorder and why; he approves or overrides, and procurement places the order. It is live today, and the engine only recommends: a person always decides.

## The problem

Planning errors cost Freshroots ₹28 to 34 lakh a quarter (stockouts plus overstock write-offs). Raghav spends about 2 days a month moving SAP data into Excel, so forecasts are 3 to 4 weeks old when procurement acts. His written rules cover 80 to 85% of decisions; the rest need his judgment.

## The solution

1. **Run weekly.** One click turns the latest sales and stock files into a recommendation for every SKU.
2. **Rules, not machine learning.** Four-week and twelve-week average sales, a festival uplift of 1.25, a surge test, and cover limits (6 to 14 weeks, perishable 3 to 4) decide each flag and order quantity.
3. **Plain-English reason on every row,** with current stock, weekly sales and a cover bar beside it.
4. **Exceptions go to Raghav,** with no automatic quantity: new SKUs, data problems, market events and others.
5. **Safety nets:** a guardrail that halts an oversized run, a pre-placement check before an approved order goes out, and override and exception rates shown for Deepa.

## What it shows today

For the week of 19 October 2026, of 15 SKUs: 5 are at stockout risk, 2 are overstocked and 8 are fine. The dashboard shows 9,130 units on hand and lists the SKUs that need action first.

## Links

| What | Link | Access |
| --- | --- | --- |
| Team app (production) | [freshroots-demand-planning-beta.vercel.app](https://freshroots-demand-planning-beta.vercel.app) | Login required |
| Preview (latest build) | [dev preview](https://freshroots-demand-planning-git-dev-milindmali1810s-projects.vercel.app) | Vercel sign-in, then login |

## What is left

- Raghav and Deepa to settle six rule choices, including a tighter guardrail and whether Ganesh Chaturthi counts as a festival.
- Data gaps to close: on-order stock, unit prices, lead times, case packs and sales by distributor. Until then three exception checks stay off.
