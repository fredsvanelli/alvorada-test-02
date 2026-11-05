import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Preview, Resource, ResultCard } from "@/lib/bookings";
import { cn } from "@/lib/utils";

export type Form = { id: string; resource: string; start: string; end: string };

const labelClass = "text-[13px] font-medium text-label";
const controlClass =
  "h-11 rounded-lg border border-input bg-white px-3 font-mono text-[15px] text-foreground md:text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-0";

const previewClass: Record<Preview["tone"], string> = {
  idle: "bg-preview-idle-bg text-preview-idle-fg",
  failed: "bg-preview-idle-bg text-preview-idle-fg",
  available: "bg-preview-available-bg text-preview-available-fg",
  conflict: "bg-preview-conflict-bg text-preview-conflict-fg",
};

const resultClass: Record<ResultCard["tone"], { card: string; chip: string }> = {
  ok: { card: "border-ok-border bg-ok-bg text-ok-fg", chip: "bg-ok-chip" },
  error: { card: "border-error-border bg-error-bg text-error-fg", chip: "bg-error-chip" },
  warning: { card: "border-warning-border bg-warning-bg text-warning-fg", chip: "bg-warning-chip" },
};

export function OperationPanel({
  resources,
  form,
  onChange,
  disabled,
  canBook,
  onBook,
  preview,
  result,
}: {
  resources: Resource[];
  form: Form;
  onChange: (field: keyof Form, value: string) => void;
  disabled: boolean;
  canBook: boolean;
  onBook: () => void;
  preview: Preview;
  result: ResultCard | null;
}) {
  const time = (field: "start" | "end", label: string) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`f-${field}`} className={labelClass}>
        {label}
      </label>
      <Input
        id={`f-${field}`}
        type="number"
        min={0}
        max={100}
        step={1}
        inputMode="numeric"
        value={form[field]}
        disabled={disabled}
        onChange={(e) => onChange(field, e.target.value)}
        className={controlClass}
      />
    </div>
  );

  return (
    <Card aria-labelledby="op-title" className="gap-4 rounded-xl border border-border p-5 ring-0 text-[15px]">
      <h2 id="op-title" className="text-[17px] font-semibold">
        Operation
      </h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="f-id" className={labelClass}>
          Id
        </label>
        <Input
          id="f-id"
          type="text"
          autoComplete="off"
          value={form.id}
          disabled={disabled}
          onChange={(e) => onChange("id", e.target.value)}
          className={controlClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="f-resource" className={labelClass}>
          Resource
        </label>
        <select
          id="f-resource"
          value={form.resource}
          disabled={disabled}
          onChange={(e) => onChange("resource", e.target.value)}
          className={cn(controlClass, "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50")}
        >
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id} · {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {time("start", "Start")}
        {time("end", "End")}
      </div>

      <div className={cn("rounded-lg px-2.5 py-2 text-[13px]", previewClass[preview.tone])}>{preview.text}</div>

      <button
        type="button"
        onClick={onBook}
        disabled={disabled || !canBook}
        className="min-h-11 w-full cursor-pointer rounded-lg border border-primary bg-primary px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        Book
      </button>

      {result && (
        <div role="status" className={cn("flex flex-col gap-1 rounded-lg border px-3 py-2.5", resultClass[result.tone].card)}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 font-mono text-xs font-semibold text-white", resultClass[result.tone].chip)}>
              {result.code}
            </span>
            <span className="font-semibold">{result.title}</span>
          </div>
          <p className="text-sm [overflow-wrap:anywhere]">{result.detail}</p>
        </div>
      )}
    </Card>
  );
}
