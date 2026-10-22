// Dates are plain "YYYY-MM-DD" strings, handled in UTC. No timezone surprises.

const DAY = 86_400_000;

export const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromMs(toMs(d) + n * DAY);

/** Monday of the week containing d. */
export function mondayOf(d: string): string {
  const dow = (new Date(toMs(d)).getUTCDay() + 6) % 7; // Mon = 0
  return addDays(d, -dow);
}

/** Monday of the most recent complete (Mon-Sun) week before runDate. */
export function lastCompleteWeekStart(runDate: string): string {
  return addDays(mondayOf(runDate), -7);
}
