import type { LogEntry, Tone } from "@/lib/bookings";

const toneClass: Record<Tone, string> = {
  ok: "text-log-ok",
  error: "text-log-error",
  warning: "text-log-warning",
};

export function OperationLog({ entries }: { entries: LogEntry[] }) {
  return (
    <section aria-labelledby="lg-title" className="flex flex-col gap-3 rounded-xl bg-log-bg p-5 text-log-fg">
      <h2 id="lg-title" className="text-[17px] font-semibold text-white">
        Operation log
      </h2>
      <ol className="flex flex-col gap-2.5 font-mono text-[13px]">
        {entries.map((e) => (
          <li key={e.n} className="flex flex-col gap-0.5 border-b border-log-line pb-2.5">
            <div className="flex flex-wrap gap-2.5">
              <span className="text-log-muted">#{e.n}</span>
              <span className="text-white [overflow-wrap:anywhere]">{e.call}</span>
            </div>
            <div className={`pl-7 [overflow-wrap:anywhere] ${toneClass[e.tone]}`}>→ {e.reply}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
