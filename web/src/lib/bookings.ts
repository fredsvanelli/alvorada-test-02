import { MAX_TIME } from 'config';

// Pure view logic for the bookings page. Its one import is plain JavaScript, so `node --test` runs it directly.
// The booking rules themselves live in the API: nothing here computes overlaps or sorts ids.

export type Resource = { id: string; name: string };
export type BookingStatus = 'active' | 'canceled';
export type Booking = { id: string; resource: Resource; start: number; end: number; status: BookingStatus };
export type ShownBooking = Booking & { pending?: 'add' | 'cancel' };
export type ApiReply = { status: number; body: unknown; raw: string } | { status: null; error: string };
export type Tone = 'ok' | 'error' | 'warning';
export type ResultCard = { tone: Tone; title: string; detail: string; code: string };
export type Preview = { tone: 'idle' | 'available' | 'conflict' | 'taken' | 'failed'; text: string; conflicts: string[] };
export type OptimisticChange = { kind: 'add'; booking: Booking } | { kind: 'cancel'; id: string };
export type BookRequest = { id: string; resource: string; start: number; end: number };
export type LogEntry = { n: number; call: string; request?: string; reply: string; tone: Tone };
export type TimelinePreview = { resource: string; start: number; end: number; tone: Preview['tone']; conflicts: string[] };
// `basis` is the booking list the check ran against: a new list (after a write) makes the answer stale.
// `id` is the form's id, sent with the check when not empty ('' means none was sent).
export type Checked = { id: string; resource: string; start: number; end: number; basis: unknown; reply: ApiReply };

const LOG_SIZE = 30;

const REJECTIONS = ['invalid_data', 'unknown_resource', 'id_taken', 'conflict'];

export function formatInterval(start: number, end: number): string {
  return `[${start},${end})`;
}

// The UI only offers whole times from 0 to MAX_TIME; start >= end is left for the API to reject.
export function isBookable(start: string, end: string): boolean {
  return [start, end].every((v) => /^\d+$/.test(v) && Number(v) <= MAX_TIME);
}

// ponytail: one huge booking (from curl or a test) squeezes the others into slivers; add zoom or clipping if that matters.
export function axis(ends: number[]): { max: number; ticks: number[] } {
  const max = Math.ceil(Math.max(MAX_TIME, ...ends) / 10) * 10;
  const step = Math.max(5, Math.ceil(max / 6 / 5) * 5);
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += step) ticks.push(t);
  return { max, ticks };
}

export function position(x: number, max: number): number {
  return (x / max) * 100;
}

const field = (body: unknown, key: string): unknown =>
  body && typeof body === 'object' ? (body as Record<string, unknown>)[key] : undefined;

function failed(reply: ApiReply): ResultCard {
  if (reply.status === null) {
    return { tone: 'error', title: 'Request failed', detail: reply.error, code: 'network_error' };
  }
  return { tone: 'error', title: 'Request failed', detail: `HTTP ${reply.status}: ${reply.raw}`, code: String(reply.status) };
}

function isBooking(body: unknown, id: string): body is Booking {
  return (
    field(body, 'id') === id &&
    typeof field(field(body, 'resource'), 'id') === 'string' &&
    typeof field(body, 'start') === 'number' &&
    typeof field(body, 'end') === 'number'
  );
}

export function bookResult(reply: ApiReply, req: BookRequest): ResultCard {
  if (reply.status === null) return failed(reply);
  const error = field(reply.body, 'error');
  if (reply.status === 201 && isBooking(reply.body, req.id)) {
    const b = reply.body as Booking;
    return { tone: 'ok', title: `Booking ${b.id} created`, detail: `${b.resource.id} taken for ${formatInterval(b.start, b.end)}.`, code: 'created' };
  }
  if ([404, 409, 422].includes(reply.status) && typeof error === 'string' && REJECTIONS.includes(error)) {
    const conflicts = field(reply.body, 'conflicts');
    const extra = error === 'conflict' && Array.isArray(conflicts) ? ` Conflicts: ${conflicts.join(', ')}` : '';
    return { tone: 'error', title: 'Rejected: nothing was created', detail: `${String(field(reply.body, 'message') ?? '')}${extra}`, code: error };
  }
  return failed(reply);
}

export function cancelResult(reply: ApiReply, id: string): ResultCard {
  if (reply.status === null) return failed(reply);
  const result = field(reply.body, 'result');
  if (reply.status === 200 && result === 'canceled') {
    return { tone: 'ok', title: `Booking ${id} canceled`, detail: 'Its id stays taken.', code: 'canceled' };
  }
  if (reply.status === 200 && result === 'already_canceled') {
    return { tone: 'warning', title: `Booking ${id} was already canceled`, detail: 'Nothing changed.', code: 'already_canceled' };
  }
  if (reply.status === 404 && field(reply.body, 'error') === 'not_found') {
    return { tone: 'error', title: 'Booking not found', detail: String(field(reply.body, 'message') ?? ''), code: 'not_found' };
  }
  return failed(reply);
}

export function previewOf(reply: ApiReply | null, resource: string, start: number, end: number, id = ''): Preview {
  if (reply === null) return { tone: 'idle', text: `Pick a start and an end from 0 to ${MAX_TIME}`, conflicts: [] };
  if (reply.status === 409 && field(reply.body, 'error') === 'id_taken') {
    return { tone: 'taken', text: `Id ${id} was already used by another booking`, conflicts: [] };
  }
  const available = reply.status === 200 ? field(reply.body, 'available') : undefined;
  const conflicts = reply.status === 200 ? field(reply.body, 'conflicts') : undefined;
  if (typeof available !== 'boolean' || !Array.isArray(conflicts)) {
    return { tone: 'failed', text: "Couldn't check availability", conflicts: [] };
  }
  const where = `${resource} ${formatInterval(start, end)}`;
  return available
    ? { tone: 'available', text: `${where} is available`, conflicts: [] }
    : { tone: 'conflict', text: `${where} conflicts with ${conflicts.join(', ')}`, conflicts: conflicts as string[] };
}

export function applyOptimistic(list: ShownBooking[], change: OptimisticChange): ShownBooking[] {
  if (change.kind === 'add') return [...list, { ...change.booking, pending: 'add' }];
  return list.map((b) => (b.id === change.id && !b.pending ? { ...b, status: 'canceled', pending: 'cancel' } : b));
}

export function addLog(log: LogEntry[], entry: Omit<LogEntry, 'n'>): LogEntry[] {
  return [{ ...entry, n: (log[0]?.n ?? 0) + 1 }, ...log].slice(0, LOG_SIZE);
}

export function filterBookings<T extends Booking>(list: T[], filter: 'all' | BookingStatus) {
  const active = list.filter((b) => b.status === 'active').length;
  return {
    rows: list.filter((b) => filter === 'all' || b.status === filter),
    counts: { all: list.length, active, canceled: list.length - active },
  };
}

export function timelineRows<T extends Booking>(resources: Resource[], bookings: T[], preview: TimelinePreview | null) {
  const { max, ticks } = axis(bookings.map((b) => b.end));
  const span = (start: number, end: number) => ({ left: position(start, max), width: position(end, max) - position(start, max) });
  const rows = resources.map((resource) => {
    const here = preview && preview.resource === resource.id ? preview : null;
    const bars = bookings
      .filter((b) => b.resource.id === resource.id)
      .sort((a, b) => (a.status === b.status ? 0 : a.status === 'canceled' ? -1 : 1))
      .map((booking) => ({
        booking,
        ...span(booking.start, booking.end),
        ringed: booking.status === 'active' && !!here?.conflicts.includes(booking.id),
        // A hovered bar widens to fit its label; one past the middle widens left to stay inside the track.
        growsLeft: booking.start > max / 2,
        right: 100 - position(booking.end, max),
      }));
    const box = here && (here.tone === 'available' || here.tone === 'conflict') ? { ...span(here.start, here.end), tone: here.tone } : null;
    return { resource, bars, box };
  });
  return { max, ticks, rows };
}

// The preview shows an answer only for the current fields and booking list; otherwise it is still checking.
export function shownPreview(
  checked: Checked | null,
  now: Omit<Checked, 'reply'> | null,
): { preview: Preview; box: TimelinePreview | null } {
  if (!now) return { preview: previewOf(null, '', 0, 0), box: null };
  const current =
    checked &&
    checked.id === now.id &&
    checked.resource === now.resource &&
    checked.start === now.start &&
    checked.end === now.end &&
    checked.basis === now.basis;
  if (!current) {
    return { preview: { tone: 'idle', text: `Checking ${now.resource} ${formatInterval(now.start, now.end)}…`, conflicts: [] }, box: null };
  }
  const preview = previewOf(checked.reply, checked.resource, checked.start, checked.end, checked.id);
  const drawn = preview.tone === 'available' || preview.tone === 'conflict';
  return { preview, box: drawn ? { resource: now.resource, start: now.start, end: now.end, tone: preview.tone, conflicts: preview.conflicts } : null };
}

export function logEntry(method: string, path: string, body: unknown, reply: ApiReply, tone: Tone): Omit<LogEntry, 'n'> {
  const request = body === undefined ? undefined : JSON.stringify(body, null, 2);
  return { call: `${method} ${path}`, request, reply: describeReply(reply), tone };
}

// `body` is null when `raw` is not JSON (a literal `null` reply prints the same either way).
export function describeReply(reply: ApiReply): string {
  if (reply.status === null) return `request failed: ${reply.error}`;
  return `${reply.status}\n${reply.body === null ? reply.raw : JSON.stringify(reply.body, null, 2)}`;
}

export function replyTone(reply: ApiReply): Tone {
  return reply.status !== null && reply.status >= 200 && reply.status < 300 ? 'ok' : 'error';
}
