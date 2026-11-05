// The [start, end) booking rule, in one place. Pure: no Nest or TypeORM.

export type Interval = { start: number; end: number };

// Upper bound of the Postgres `integer` columns, so a bigger value is
// invalid_data instead of a database error.
const MAX_TIME = 2_147_483_647;

// A time is a non-negative integer, given as a number or a digit-only string.
function toTime(value: unknown): number | null {
  const n =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_TIME
    ? n
    : null;
}

// Returns the interval as numbers, or null when it is invalid_data.
export function parseInterval(start: unknown, end: unknown): Interval | null {
  const s = toTime(start);
  const e = toTime(end);
  return s !== null && e !== null && s < e ? { start: s, end: e } : null;
}

// Half-open intervals: [10,20) and [20,30) do not overlap. Expects valid intervals.
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}
