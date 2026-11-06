// The [start, end) booking rule, in one place. Pure: no Nest or TypeORM.
import { MAX_TIME } from 'config';

export type Interval = { start: number; end: number };

// Bookings stored before the bookable window never pass through here, so they
// can still end past MAX_TIME.

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
