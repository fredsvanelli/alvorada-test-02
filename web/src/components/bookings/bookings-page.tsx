"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { API_URL, call } from "@/lib/api";
import type { Booking, Resource } from "@/lib/bookings";
import { BookingsTable } from "./bookings-table";
import { Timeline } from "./timeline";

type Load = "loading" | "ready" | "failed";

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

  const apply = useCallback((data: Awaited<ReturnType<typeof fetchAll>>) => {
    if (!data) return setLoad("failed");
    setResources(data.resources);
    setBookings(data.bookings);
    setLoad("ready");
  }, []);

  useEffect(() => {
    // Initial fetch from the browser; the API is the source of truth.
    void fetchAll().then(apply);
  }, [apply]);

  return (
    <main className="mx-auto box-border flex w-full max-w-[1240px] flex-col gap-6 px-5 pt-8 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[32px] leading-[1.15] font-bold tracking-[-0.01em]">Bookings</h1>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Operation" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4" />

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
              <Timeline resources={resources} bookings={bookings} preview={null} />
              <BookingsTable bookings={bookings} onCancel={() => {}} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
