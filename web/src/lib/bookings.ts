// Pure view logic for the bookings page. No imports, so `node --test` runs it directly.
// The booking rules themselves live in the API: nothing here computes overlaps or sorts ids.

export type Resource = { id: string; name: string };
export type BookingStatus = 'active' | 'canceled';
export type Booking = { id: string; resource: Resource; start: number; end: number; status: BookingStatus };
export type ShownBooking = Booking & { pending?: 'add' | 'cancel' };
export type ApiReply = { status: number; body: unknown; raw: string } | { status: null; error: string };
export type Tone = 'ok' | 'error' | 'warning';
export type ResultCard = { tone: Tone; title: string; detail: string; code: string };
export type Preview = { tone: 'idle' | 'available' | 'conflict' | 'failed'; text: string; conflicts: string[] };
export type OptimisticChange = { kind: 'add'; booking: Booking } | { kind: 'cancel'; id: string };
export type BookRequest = { id: string; resource: string; start: number; end: number };

const REJECTIONS = ['invalid_data', 'unknown_resource', 'id_taken', 'conflict'];

export function formatInterval(start: number, end: number): string {
  return `[${start},${end})`;
}

// The UI only offers whole times from 0 to 100; start >= end is left for the API to reject.
export function isBookable(start: string, end: string): boolean {
  return [start, end].every((v) => /^\d+$/.test(v) && Number(v) <= 100);
}

// ponytail: one huge booking (from curl or a test) squeezes the others into slivers; add zoom or clipping if that matters.
export function axis(ends: number[]): { max: number; ticks: number[] } {
  const max = Math.ceil(Math.max(100, ...ends) / 10) * 10;
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

export function bookResult(reply: ApiReply, req: BookRequest): ResultCard {
  if (reply.status === null) return failed(reply);
  const error = field(reply.body, 'error');
  if (reply.status === 201 && field(reply.body, 'id') === req.id) {
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

export function previewOf(reply: ApiReply | null, resource: string, start: number, end: number): Preview {
  if (reply === null) return { tone: 'idle', text: 'Pick a start and an end from 0 to 100', conflicts: [] };
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

export function describeCall(method: string, path: string, body?: unknown): string {
  return body === undefined ? `${method} ${path}` : `${method} ${path} ${JSON.stringify(body)}`;
}

export function describeReply(reply: ApiReply): string {
  return reply.status === null ? `request failed: ${reply.error}` : `${reply.status} ${reply.raw}`;
}
