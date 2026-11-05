import type { ApiReply } from './bookings';

// Read directly so Next inlines it into the browser bundle.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Never throws: a network failure or a non-JSON body still comes back as an ApiReply.
export async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<ApiReply> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      // Bookings change under us: never answer from the HTTP cache (a 304 revalidation also breaks fixture recording).
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // keep null: the raw text is still shown
    }
    return { status: res.status, body: parsed, raw };
  } catch (e) {
    return { status: null, error: e instanceof Error ? e.message : String(e) };
  }
}
