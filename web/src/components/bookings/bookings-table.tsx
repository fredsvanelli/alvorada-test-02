"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInterval, type BookingStatus, type ShownBooking } from "@/lib/bookings";
import { cn } from "@/lib/utils";

type Filter = "all" | BookingStatus;

const headClass = "h-auto px-2.5 py-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase";
const cellClass = "border-b border-cell-line p-2.5";

export function BookingsTable({ bookings, onCancel }: { bookings: ShownBooking[]; onCancel: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const active = bookings.filter((b) => b.status === "active").length;
  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: bookings.length },
    { id: "active", label: "Active", count: active },
    { id: "canceled", label: "Canceled", count: bookings.length - active },
  ];
  const rows = bookings.filter((b) => filter === "all" || b.status === filter);

  return (
    <Card aria-labelledby="tb-title" className="gap-3.5 rounded-xl border border-border p-5 ring-0 text-[15px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tb-title" className="text-[17px] font-semibold">
          Bookings
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filter === c.id}
              onClick={() => setFilter(c.id)}
              className={cn(
                "min-h-9 cursor-pointer rounded-full border px-3 text-[13px] font-medium",
                filter === c.id ? "border-foreground bg-foreground text-white" : "border-input bg-white text-foreground",
              )}
            >
              {c.label} ({c.count})
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[520px] text-sm">
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className={headClass}>ID</TableHead>
              <TableHead className={headClass}>Resource</TableHead>
              <TableHead className={headClass}>Interval</TableHead>
              <TableHead className={headClass}>Status</TableHead>
              <TableHead className={cn(headClass, "text-right")}>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => {
              const isActive = b.status === "active";
              return (
                <TableRow
                  key={`${b.pending ?? "row"}:${b.id}`}
                  className={cn("border-0 hover:bg-transparent", b.pending && "opacity-50")}
                >
                  <TableCell className={cn(cellClass, "font-mono font-semibold")}>{b.id}</TableCell>
                  <TableCell className={cellClass}>
                    <span className="font-mono">{b.resource.id}</span> · {b.resource.name}
                  </TableCell>
                  <TableCell className={cn(cellClass, "font-mono")}>{formatInterval(b.start, b.end)}</TableCell>
                  <TableCell className={cellClass}>
                    <Badge
                      className={cn(
                        "h-auto rounded-full border-0 px-2.5 py-0.5 text-xs font-semibold",
                        isActive ? "bg-chip-active-bg text-chip-active-fg" : "bg-chip-canceled-bg text-chip-canceled-fg",
                      )}
                    >
                      {isActive ? "Active" : "Canceled"}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn(cellClass, "py-1.5 text-right")}>
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => onCancel(b.id)}
                        disabled={b.pending !== undefined}
                        aria-label={`Cancel booking ${b.id}`}
                        className="min-h-9 cursor-pointer rounded-lg border border-input bg-white px-3 text-[13px] text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {rows.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No bookings in this filter.</p>}
      </div>
    </Card>
  );
}
