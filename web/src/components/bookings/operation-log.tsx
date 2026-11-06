import type { LogEntry, Tone } from "@/lib/bookings";

const toneClass: Record<Tone, string> = {
  ok: "text-log-ok",
  error: "text-log-error",
  warning: "text-log-warning",
};

// Bodies print on indented lines: keep the line breaks and spaces, and break long values anywhere.
const block = "pl-7 whitespace-pre-wrap [overflow-wrap:anywhere]";

export function OperationLog({ entries }: { entries: LogEntry[] }) {
  return (
    <section aria-labelledby="lg-title" className="flex max-h-[640px] flex-col gap-3 rounded-xl bg-log-bg p-5 text-log-fg">
      <h2 id="lg-title" className="text-[17px] font-semibold text-white">
        Operation log
      </h2>
      {/* Only the entries scroll, past 640px; focusable so the keyboard can scroll them too. */}
      <ol tabIndex={0} aria-labelledby="lg-title" className="flex min-h-0 flex-col gap-2.5 overflow-y-auto font-mono text-[13px]">
        {entries.map((e) => (
          <li key={e.n} className="flex flex-col gap-0.5 border-b border-log-line pb-2.5">
            <div className="flex flex-wrap gap-2.5">
              <span className="text-log-muted">#{e.n}</span>
              <span className="text-white [overflow-wrap:anywhere]">{e.call}</span>
            </div>
            {e.request !== undefined && <div className={`${block} text-white`}>{e.request}</div>}
            <div className={`${block} ${toneClass[e.tone]}`}>→ {e.reply}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
