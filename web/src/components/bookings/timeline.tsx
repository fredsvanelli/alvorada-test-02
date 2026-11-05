import { Card } from "@/components/ui/card";
import { axis, formatInterval, position, type Preview, type Resource, type ShownBooking } from "@/lib/bookings";
import { cn } from "@/lib/utils";

export type TimelinePreview = {
  resource: string;
  start: number;
  end: number;
  tone: Preview["tone"];
  conflicts: string[];
};

const legend = [
  { label: "Active", swatch: "bg-bar-active" },
  { label: "Canceled", swatch: "bg-bar-canceled border border-dashed border-bar-canceled-border" },
  { label: "Preview: available", swatch: "border-2 border-dashed border-preview-available" },
  { label: "Preview: conflict", swatch: "border-2 border-dashed border-preview-conflict" },
];

export function Timeline({
  resources,
  bookings,
  preview,
}: {
  resources: Resource[];
  bookings: ShownBooking[];
  preview: TimelinePreview | null;
}) {
  const { max, ticks } = axis(bookings.map((b) => b.end));
  const showPreview = preview && (preview.tone === "available" || preview.tone === "conflict");

  return (
    <Card aria-labelledby="tl-title" className="gap-3.5 rounded-xl border border-border p-5 ring-0 text-[15px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="tl-title" className="text-[17px] font-semibold">
          Timeline
        </h2>
        <div className="flex flex-wrap gap-3.5 text-xs text-muted-foreground">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={cn("h-2.5 w-3.5 rounded-[3px]", l.swatch)} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[520px] flex-col pr-3">
          <div className="flex h-[22px] gap-3">
            <div className="flex-[0_0_132px]" />
            <div className="relative flex-auto">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute top-0 -translate-x-1/2 font-mono text-[11px] text-muted-foreground"
                  style={{ left: `${position(t, max)}%` }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {resources.map((r) => {
            const bars = bookings
              .filter((b) => b.resource.id === r.id)
              .sort((a, b) => (a.status === b.status ? 0 : a.status === "canceled" ? -1 : 1));
            const rowPreview = showPreview && preview.resource === r.id ? preview : null;
            return (
              <div key={r.id} className="flex items-center gap-3 border-t border-row-line py-2">
                <div className="flex-[0_0_132px] text-sm font-semibold">
                  <span className="font-mono">{r.id}</span> · {r.name}
                </div>
                <div className="relative h-11 flex-auto rounded-md bg-muted">
                  {ticks.map((t) => (
                    <span
                      key={t}
                      aria-hidden="true"
                      className="absolute inset-y-0 w-px bg-tick"
                      style={{ left: `${position(t, max)}%` }}
                    />
                  ))}
                  {bars.map((b) => {
                    const active = b.status === "active";
                    const ringed = active && rowPreview?.conflicts.includes(b.id);
                    return (
                      <div
                        key={`${b.pending ?? "row"}:${b.id}`}
                        title={`Booking ${b.id} · ${formatInterval(b.start, b.end)} · ${b.status}`}
                        className={cn(
                          "absolute top-1.5 flex h-8 items-center overflow-hidden rounded-md px-2 font-mono text-xs font-medium text-ellipsis whitespace-nowrap",
                          active
                            ? "border border-bar-active bg-bar-active text-white"
                            : "border border-dashed border-bar-canceled-border bg-bar-canceled text-muted-foreground line-through",
                          b.pending && "opacity-50",
                        )}
                        style={{
                          left: `${position(b.start, max)}%`,
                          width: `${position(b.end, max) - position(b.start, max)}%`,
                          boxShadow: ringed ? "0 0 0 2px #FFFFFF, 0 0 0 4px var(--color-preview-conflict)" : undefined,
                        }}
                      >
                        {b.id} {formatInterval(b.start, b.end)}
                      </div>
                    );
                  })}
                  {rowPreview && (
                    <div
                      aria-hidden="true"
                      className={cn(
                        "absolute top-0.5 h-10 rounded-lg border-2 border-dashed",
                        rowPreview.tone === "conflict"
                          ? "border-preview-conflict bg-preview-conflict-fill"
                          : "border-preview-available bg-preview-available-fill",
                      )}
                      style={{
                        left: `${position(rowPreview.start, max)}%`,
                        width: `${position(rowPreview.end, max) - position(rowPreview.start, max)}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
