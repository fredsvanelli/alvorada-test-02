"use client";

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { API_URL, call } from "@/lib/api";
import {
  addLog,
  applyOptimistic,
  bookResult,
  cancelResult,
  isBookable,
  logEntry,
  replyTone,
  shownPreview,
  type ApiReply,
  type Booking,
  type BookRequest,
  type Checked,
  type LogEntry,
  type OptimisticChange,
  type Resource,
  type ResultCard,
  type ShownBooking,
  type Tone,
} from "@/lib/bookings";
import { BookingsTable } from "./bookings-table";
import { OperationLog } from "./operation-log";
import { OperationPanel, type Form } from "./operation-panel";
import { Timeline } from "./timeline";

type Load = "loading" | "ready" | "failed";
type LogCall = (method: string, path: string, body: unknown, reply: ApiReply, tone: Tone) => void;

// Both lists, or null when either call fails or answers outside the contract.
async function fetchAll(record: LogCall): Promise<{ resources: Resource[]; bookings: Booking[] } | null> {
  const [res, list] = await Promise.all([call("GET", "/resources"), call("GET", "/bookings")]);
  // Logged once both answer, in a fixed order, so the log reads the same on every load.
  record("GET", "/resources", undefined, res, replyTone(res));
  record("GET", "/bookings", undefined, list, replyTone(list));
  if (res.status === 200 && Array.isArray(res.body) && list.status === 200 && Array.isArray(list.body)) {
    return { resources: res.body as Resource[], bookings: list.body as Booking[] };
  }
  return null;
}

export function BookingsPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [load, setLoad] = useState<Load>("loading");
  const [form, setForm] = useState<Form>({ id: "", resource: "", start: "", end: "" });
  const [result, setResult] = useState<ResultCard | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [shown, addOptimistic] = useOptimistic<ShownBooking[], OptimisticChange>(bookings, applyOptimistic);
  const [, startTransition] = useTransition();
  const [checked, setChecked] = useState<Checked | null>(null);
  const previewSeq = useRef(0);
  const loaded = useRef(false);

  const record = useCallback<LogCall>((method, path, body, reply, tone) => {
    setLog((l) => addLog(l, logEntry(method, path, body, reply, tone)));
  }, []);

  // Every API call of the page goes through here, so the Operation log shows it when it answers.
  const logged = useCallback(
    async (method: "GET" | "POST", path: string, body?: unknown, toneOf: (reply: ApiReply) => Tone = replyTone) => {
      const reply = await call(method, path, body);
      record(method, path, body, reply, toneOf(reply));
      return reply;
    },
    [record],
  );

  const apply = useCallback((data: Awaited<ReturnType<typeof fetchAll>>) => {
    if (!data) return setLoad("failed");
    setResources(data.resources);
    setBookings(data.bookings);
    setForm((f) => (f.resource ? f : { ...f, resource: data.resources[0]?.id ?? "" }));
    setLoad("ready");
  }, []);

  useEffect(() => {
    // Initial fetch from the browser; the API is the source of truth.
    // Once only: StrictMode runs effects twice in dev, and each load would show in the log.
    if (loaded.current) return;
    loaded.current = true;
    void fetchAll(record).then(apply);
  }, [apply, record]);

  // Runs inside a transition: the optimistic entry shows until the API answers and the list is re-fetched.
  async function write(change: OptimisticChange, path: string, body: unknown, toCard: (reply: ApiReply) => ResultCard) {
    addOptimistic(change);
    // A Book or Cancel entry keeps the tone of its result card (amber for already_canceled).
    const reply = await logged("POST", path, body, (r) => toCard(r).tone);
    const card = toCard(reply);
    const list = await logged("GET", "/bookings");
    // Updates after an await are not part of the transition unless wrapped again (React 19).
    startTransition(() => {
      setResult(card);
      // A failed re-fetch keeps the last good list.
      if (list.status === 200 && Array.isArray(list.body)) setBookings(list.body as Booking[]);
      // Clearing the times too: re-checking them against the new list would report the new booking as a conflict.
      if (card.code === "created") setForm((f) => ({ ...f, id: "", start: "", end: "" }));
    });
  }

  function onBook() {
    const req: BookRequest = { id: form.id, resource: form.resource, start: Number(form.start), end: Number(form.end) };
    const resource = resources.find((r) => r.id === req.resource) ?? { id: req.resource, name: "" };
    const booking: Booking = { id: req.id, resource, start: req.start, end: req.end, status: "active" };
    startTransition(() => write({ kind: "add", booking }, "/bookings", req, (reply) => bookResult(reply, req)));
  }

  function onCancel(id: string) {
    const path = `/bookings/${encodeURIComponent(id)}/cancel`;
    startTransition(() => write({ kind: "cancel", id }, path, undefined, (reply) => cancelResult(reply, id)));
  }

  const ready = load === "ready";
  const checkable = ready && form.resource !== "" && isBookable(form.start, form.end);

  // Live availability check: debounced, and only the latest answer counts. Re-runs after each write's re-fetch.
  useEffect(() => {
    const n = ++previewSeq.current;
    if (!checkable) return;
    const q = { id: form.id, resource: form.resource, start: Number(form.start), end: Number(form.end), basis: bookings };
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ resource: q.resource, start: String(q.start), end: String(q.end) });
      // The API also answers id_taken for a used id, so Book is never offered for one.
      if (q.id !== "") params.set("id", q.id);
      // Logged even when a newer check replaces it: the log shows every request sent.
      void logged("GET", `/availability?${params}`).then((reply) => {
        if (n === previewSeq.current) setChecked({ ...q, reply });
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [checkable, form.id, form.resource, form.start, form.end, bookings, logged]);

  const { preview, box } = shownPreview(
    checked,
    checkable ? { id: form.id, resource: form.resource, start: Number(form.start), end: Number(form.end), basis: bookings } : null,
  );
  // Book only an interval the current check found available.
  const canBook = preview.tone === "available" && !shown.some((b) => b.pending === "add");

  return (
    <main className="mx-auto box-border flex w-full max-w-[1240px] flex-col gap-6 px-5 pt-8 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[32px] leading-[1.15] font-bold tracking-[-0.01em]">Bookings</h1>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Operation" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <OperationPanel
            resources={resources}
            form={form}
            onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
            disabled={!ready}
            canBook={canBook}
            onBook={onBook}
            preview={preview}
            result={result}
          />
        </section>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          {load === "failed" ? (
            <Card role="alert" className="gap-3 border-error-border bg-error-bg text-error-fg">
              <p>
                Can&apos;t reach the API at <span className="font-mono">{API_URL}</span>. Start it with{" "}
                <code className="font-mono">npm run dev:api</code>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoad("loading");
                  void fetchAll(record).then(apply);
                }}
                className="min-h-11 w-fit cursor-pointer rounded-lg border border-primary bg-white px-4 font-semibold text-primary"
              >
                Retry
              </button>
            </Card>
          ) : load === "loading" ? (
            <Card role="status" aria-live="polite">
              <p className="text-muted-foreground">Loading resources and bookings…</p>
            </Card>
          ) : (
            <>
              <Timeline resources={resources} bookings={shown} preview={box} />
              <BookingsTable bookings={shown} onCancel={onCancel} />
            </>
          )}
          <OperationLog entries={log} />
        </div>
      </div>
    </main>
  );
}
