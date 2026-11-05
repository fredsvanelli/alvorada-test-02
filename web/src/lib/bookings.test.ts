import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOptimistic,
  axis,
  bookResult,
  cancelResult,
  describeCall,
  describeReply,
  formatInterval,
  isBookable,
  position,
  previewOf,
  type ApiReply,
  type Booking,
} from './bookings.ts';
import { API_URL, call } from './api.ts';

const json = (status: number, body: unknown): ApiReply => ({ status, body, raw: JSON.stringify(body) });
const r1 = { id: 'R1', name: 'Agora Room' };
const booking = (id: string, status: Booking['status'] = 'active'): Booking => ({ id, resource: r1, start: 10, end: 20, status });
const req = { id: 'D', resource: 'R1', start: 19, end: 21 };

describe('formatInterval', () => {
  it('writes a half-open interval', () => assert.equal(formatInterval(10, 20), '[10,20)'));
});

describe('isBookable', () => {
  it('accepts whole numbers from 0 to 100, in any order', () => {
    assert.ok(isBookable('0', '100'));
    assert.ok(isBookable('20', '20'));
    assert.ok(isBookable('20', '10'));
  });
  it('rejects empty, out of range and non-whole values', () => {
    for (const [s, e] of [['', '5'], ['5', '101'], ['2.5', '5'], ['1e2', '5'], ['-1', '5']]) {
      assert.equal(isBookable(s, e), false, `${s}/${e}`);
    }
  });
});

describe('axis', () => {
  it('spans 0 to 100 with 6 ticks when nothing ends later', () => {
    assert.deepEqual(axis([]), { max: 100, ticks: [0, 20, 40, 60, 80, 100] });
  });
  it('grows to the largest end, rounded up to 10', () => {
    const a = axis([30, 145]);
    assert.equal(a.max, 150);
    assert.deepEqual(a.ticks.slice(0, 2), [0, 25]);
  });
  it('handles a huge end', () => assert.equal(axis([2_000_000_000]).max, 2_000_000_000));
  it('positions as a percent of max', () => assert.equal(position(25, 100), 25));
});

describe('bookResult', () => {
  it('reports a created booking', () => {
    const body = { id: 'D', resource: r1, start: 19, end: 21, status: 'active' };
    assert.deepEqual(bookResult(json(201, body), req), {
      tone: 'ok', title: 'Booking D created', detail: 'R1 taken for [19,21).', code: 'created',
    });
  });
  it('reports a conflict with its ids', () => {
    const message = 'The interval overlaps active bookings of this resource.';
    const card = bookResult(json(409, { error: 'conflict', message, conflicts: ['A', 'B'] }), req);
    assert.equal(card.tone, 'error');
    assert.equal(card.title, 'Rejected: nothing was created');
    assert.ok(card.detail.includes(message));
    assert.ok(card.detail.includes('Conflicts: A, B'));
    assert.equal(card.code, 'conflict');
  });
  it('reports each other rejection with its code and message', () => {
    for (const [status, error] of [[409, 'id_taken'], [422, 'invalid_data'], [404, 'unknown_resource']] as const) {
      const card = bookResult(json(status, { error, message: `msg ${error}` }), req);
      assert.equal(card.code, error);
      assert.equal(card.title, 'Rejected: nothing was created');
      assert.ok(card.detail.includes(`msg ${error}`));
    }
  });
  it('treats a 201 without the booking shape as a failed request', () => {
    const card = bookResult(json(201, { id: 'D' }), req);
    assert.equal(card.title, 'Request failed');
    assert.equal(card.code, '201');
  });
  it('treats a non-JSON 500 as a failed request', () => {
    const card = bookResult({ status: 500, body: null, raw: '<html>oops</html>' }, req);
    assert.equal(card.tone, 'error');
    assert.equal(card.title, 'Request failed');
    assert.equal(card.code, '500');
    assert.ok(card.detail.includes('<html>oops</html>'));
  });
  it('treats a network error as a failed request', () => {
    const card = bookResult({ status: null, error: 'Failed to fetch' }, req);
    assert.equal(card.title, 'Request failed');
    assert.equal(card.code, 'network_error');
  });
});

describe('cancelResult', () => {
  it('reports canceled', () => {
    assert.deepEqual(cancelResult(json(200, { result: 'canceled', booking: booking('A', 'canceled') }), 'A'), {
      tone: 'ok', title: 'Booking A canceled', detail: 'Its id stays taken.', code: 'canceled',
    });
  });
  it('reports already canceled as a warning', () => {
    assert.deepEqual(cancelResult(json(200, { result: 'already_canceled', booking: booking('A', 'canceled') }), 'A'), {
      tone: 'warning', title: 'Booking A was already canceled', detail: 'Nothing changed.', code: 'already_canceled',
    });
  });
  it('reports not found', () => {
    const card = cancelResult(json(404, { error: 'not_found', message: 'No booking has this id.' }), 'Z');
    assert.equal(card.tone, 'error');
    assert.equal(card.title, 'Booking not found');
    assert.equal(card.code, 'not_found');
  });
  it('treats a 200 outside the contract as a failed request', () => {
    assert.equal(cancelResult(json(200, {}), 'A').title, 'Request failed');
  });
});

describe('previewOf', () => {
  it('asks for an interval before any call', () => {
    assert.deepEqual(previewOf(null, 'R1', 0, 0), { tone: 'idle', text: 'Pick a start and an end from 0 to 100', conflicts: [] });
  });
  it('says available', () => {
    const p = previewOf(json(200, { available: true, conflicts: [] }), 'R1', 19, 21);
    assert.equal(p.tone, 'available');
    assert.equal(p.text, 'R1 [19,21) is available');
  });
  it('lists conflicts in API order', () => {
    const p = previewOf(json(200, { available: false, conflicts: ['B', 'A'] }), 'R1', 19, 21);
    assert.equal(p.tone, 'conflict');
    assert.equal(p.text, 'R1 [19,21) conflicts with B, A');
    assert.deepEqual(p.conflicts, ['B', 'A']);
  });
  it('fails neutrally on a 422 or a network error', () => {
    for (const reply of [json(422, { error: 'invalid_data', message: 'x' }), { status: null, error: 'down' } as ApiReply]) {
      const p = previewOf(reply, 'R1', 20, 20);
      assert.equal(p.tone, 'failed');
      assert.equal(p.text, "Couldn't check availability");
    }
  });
});

describe('applyOptimistic', () => {
  it('appends a pending booking and keeps a same-id one', () => {
    const list = [booking('A')];
    const out = applyOptimistic(list, { kind: 'add', booking: booking('A') });
    assert.equal(out.length, 2);
    assert.deepEqual(out[0], list[0]);
    assert.equal(out[1].pending, 'add');
  });
  it('marks a canceled booking pending and leaves the rest', () => {
    const out = applyOptimistic([booking('A'), booking('B')], { kind: 'cancel', id: 'A' });
    assert.equal(out[0].status, 'canceled');
    assert.equal(out[0].pending, 'cancel');
    assert.deepEqual(out[1], booking('B'));
  });
});

describe('log text', () => {
  it('describes a call with and without a body', () => {
    assert.equal(describeCall('POST', '/bookings', { id: 'C' }), 'POST /bookings {"id":"C"}');
    assert.equal(describeCall('POST', '/bookings/A/cancel'), 'POST /bookings/A/cancel');
  });
  it('describes a reply', () => {
    assert.equal(describeReply({ status: 409, body: null, raw: '{"error":"conflict"}' }), '409 {"error":"conflict"}');
    assert.equal(describeReply({ status: null, error: 'Failed to fetch' }), 'request failed: Failed to fetch');
  });
});

describe('call', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  const stub = (impl: (url: string, init: RequestInit) => Promise<Response>) => {
    const seen: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return impl(url, init);
    }) as typeof fetch;
    return seen;
  };

  it('parses a JSON reply and sends a JSON body', async () => {
    const seen = stub(async () => new Response('{"id":"A"}', { status: 201 }));
    assert.deepEqual(await call('POST', '/bookings', { id: 'A' }), { status: 201, body: { id: 'A' }, raw: '{"id":"A"}' });
    assert.equal(seen[0].url, `${API_URL}/bookings`);
    assert.equal(seen[0].init.method, 'POST');
    assert.equal(new Headers(seen[0].init.headers).get('content-type'), 'application/json');
    assert.equal(seen[0].init.body, '{"id":"A"}');
  });
  it('never reuses a cached answer', async () => {
    const seen = stub(async () => new Response('[]', { status: 200 }));
    await call('GET', '/bookings');
    assert.equal(seen[0].init.cache, 'no-store');
  });
  it('sends no body or content type without one', async () => {
    const seen = stub(async () => new Response('[]', { status: 200 }));
    await call('GET', '/bookings');
    assert.equal(seen[0].init.body, undefined);
    assert.equal(new Headers(seen[0].init.headers).get('content-type'), null);
  });
  it('keeps the raw text of a non-JSON reply', async () => {
    stub(async () => new Response('<html>oops</html>', { status: 500 }));
    assert.deepEqual(await call('GET', '/bookings'), { status: 500, body: null, raw: '<html>oops</html>' });
  });
  it('turns a rejected fetch into a network error', async () => {
    stub(async () => { throw new TypeError('Failed to fetch'); });
    assert.deepEqual(await call('GET', '/bookings'), { status: null, error: 'Failed to fetch' });
  });
});
