"use client";

import { useCallback, useEffect, useOptimistic, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { API_URL, call } from "@/lib/api";
import {
  applyOptimistic,
  bookResult,
  cancelResult,
  describeCall,
  describeReply,
  isBookable,
  previewOf,
  type ApiReply,
  type Booking,
  type BookRequest,
  type OptimisticChange,
  type Resource,
  type ResultCard,
  type ShownBooking,
} from "@/lib/bookings";
import { BookingsTable } from "./bookings-table";
import { OperationLog, type LogEntry } from "./operation-log";
import { OperationPanel, type Form } from "./operation-panel";
import { Timeline } from "./timeline";

type Load = "loading" | "ready" | "failed";

const LOG_SIZE = 14;

// Both lists, or null when either call fails or answers outside the contract.
async function fetchAll(): Promise<{ resources: Resource[]; bookings: Booking[] } | null> {
  const [res, list] = await Promise.all([call("GET", "/resources"), call("GET", "/bookings")]);
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

  const apply = useCallback((data: Awaited<ReturnType<typeof fetchAll>>) => {
    if (!data) return setLoad("failed");
    setResources(data.resources);
    setBookings(data.bookings);
    setForm((f) => (f.resource ? f : { ...f, resource: data.resources[0]?.id ?? "" }));
    setLoad("ready");
  }, []);

  useEffect(() => {
    // Initial fetch from the browser; the API is the source of truth.
    void fetchAll().then(apply);
  }, [apply]);

  // Runs inside a transition: the optimistic entry shows until the API answers and the list is re-fetched.
  async function write(change: OptimisticChange, path: string, body: unknown, toCard: (reply: ApiReply) => ResultCard) {
    addOptimistic(change);
    const reply = await call("POST", path, body);
    const card = toCard(reply);
    const list = await call("GET", "/bookings");
    // Updates after an await are not part of the transition unless wrapped again (React 19).
    startTransition(() => {
      setResult(card);
      setLog((l) =>
        [{ n: (l[0]?.n ?? 0) + 1, call: describeCall("POST", path, body), reply: describeReply(reply), tone: card.tone }, ...l].slice(
          0,
          LOG_SIZE,
        ),
      );
      // A failed re-fetch keeps the last good list.
      if (list.status === 200 && Array.isArray(list.body)) setBookings(list.body as Booking[]);
      if (card.code === "created") setForm((f) => ({ ...f, id: "" }));
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
  const canBook = ready && form.resource !== "" && isBookable(form.start, form.end) && !shown.some((b) => b.pending === "add");
  const preview = previewOf(null, form.resource, Number(form.start), Number(form.end));

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
            <Card role="alert" className="gap-3 rounded-xl border border-error-border bg-error-bg p-5 text-error-fg ring-0 text-[15px]">
              <p>
                Can&apos;t reach the API at <span className="font-mono">{API_URL}</span>. Start it with{" "}
                <code className="font-mono">npm run dev:api</code>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoad("loading");
                  void fetchAll().then(apply);
                }}
                className="min-h-11 w-fit cursor-pointer rounded-lg border border-primary bg-white px-4 font-semibold text-primary"
              >
                Retry
              </button>
            </Card>
          ) : (
            <>
              <Timeline resources={resources} bookings={shown} preview={null} />
              <BookingsTable bookings={shown} onCancel={onCancel} />
            </>
          )}
          <OperationLog entries={log} />
        </div>
      </div>
    </main>
  );
}
