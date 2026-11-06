import { Card } from "@/components/ui/card";
import { formatInterval, position, timelineRows, type Resource, type ShownBooking, type TimelinePreview } from "@/lib/bookings";
import { cn } from "@/lib/utils";

const legend = [
  { label: "Active", swatch: "bg-bar-active" },
  { label: "Canceled", swatch: "bg-bar-canceled border border-dashed border-bar-canceled-border" },
  { label: "Preview: available", swatch: "border-2 border-dashed border-preview-available" },
  { label: "Preview: conflict", swatch: "border-2 border-dashed border-preview-conflict" },
];

const RING = "0 0 0 2px var(--color-card), 0 0 0 4px var(--color-preview-conflict)";

export function Timeline({
  resources,
  bookings,
  preview,
}: {
  resources: Resource[];
  bookings: ShownBooking[];
  preview: TimelinePreview | null;
}) {
  const { max, ticks, rows } = timelineRows(resources, bookings, preview);

  return (
    <Card aria-labelledby="tl-title" className="gap-3.5">
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

          {rows.map(({ resource, bars, box }) => (
            <div key={resource.id} className="flex items-center gap-3 border-t border-row-line py-2">
              <div className="flex-[0_0_132px] text-sm font-semibold">
                <span className="font-mono">{resource.id}</span> · {resource.name}
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
                {bars.map(({ booking: b, left, width, right, ringed, growsLeft }) => (
                  <div
                    key={`${b.pending ?? "row"}:${b.id}`}
                    title={`Booking ${b.id} · ${formatInterval(b.start, b.end)} · ${b.status}`}
                    className={cn(
                      "absolute top-1.5 flex h-8 items-center overflow-hidden rounded-md px-2 font-mono text-xs font-medium hover:z-10 hover:min-w-max",
                      b.status === "active"
                        ? "border border-bar-active bg-bar-active text-white"
                        : "border border-dashed border-bar-canceled-border bg-bar-canceled text-muted-foreground line-through",
                      b.pending && "opacity-50",
                    )}
                    style={{
                      ...(growsLeft ? { right: `${right}%` } : { left: `${left}%` }),
                      width: `${width}%`,
                      boxShadow: ringed ? RING : undefined,
                    }}
                  >
                    {/* text-overflow needs a block box; on the flex bar itself it cuts the text with no ellipsis. */}
                    <span className="truncate">
                      {b.id} {formatInterval(b.start, b.end)}
                    </span>
                  </div>
                ))}
                {box && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute top-0.5 h-10 rounded-lg border-2 border-dashed",
                      box.tone === "conflict"
                        ? "border-preview-conflict bg-preview-conflict-fill"
                        : "border-preview-available bg-preview-available-fill",
                    )}
                    style={{ left: `${box.left}%`, width: `${box.width}%` }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
