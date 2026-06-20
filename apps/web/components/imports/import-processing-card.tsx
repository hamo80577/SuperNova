import { Clock3, FileSpreadsheet, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import type { ImportProcessingStatus } from "@/lib/api/import-polling";
import { cn } from "@/lib/utils";

export function ImportProcessingCard({
  batchId,
  fileName,
  status
}: {
  batchId: string;
  fileName: string;
  status: ImportProcessingStatus;
}) {
  const processing = status === "PROCESSING";

  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="rounded-2xl border border-[#FFD8BD] bg-[#FFF8F3] p-4 shadow-[0_1px_2px_rgba(65,21,23,0.04)] sm:p-5"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#FFE8D9] text-[color:var(--tlb-orange)]">
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[color:var(--sn-ink)]">
            {processing ? "Validating file" : "Queued for processing"}
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--sn-muted)]">
            {processing
              ? "Reading rows and checking mappings in the background."
              : "Your file is uploaded and waiting for an import worker."}
          </p>
        </div>
      </div>

      <div
        aria-label="Import processing progress"
        aria-valuetext={processing ? "Validating file" : "Waiting for worker"}
        className="mt-4 h-2 overflow-hidden rounded-full bg-[#FFD8BD]"
        role="progressbar"
      >
        <div className="h-full w-full animate-pulse rounded-full bg-[color:var(--tlb-orange)] motion-reduce:animate-none" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <ProcessingStep
          active={!processing}
          complete={processing}
          icon={<Clock3 className="h-4 w-4" />}
          label="Queued"
        />
        <ProcessingStep
          active={processing}
          complete={false}
          icon={<FileSpreadsheet className="h-4 w-4" />}
          label="Validate and preview"
        />
      </div>

      <p className="mt-3 truncate text-xs text-[color:var(--sn-faint)]">
        {fileName} · Batch {batchId.slice(0, 8)}
      </p>
    </section>
  );
}

function ProcessingStep({
  active,
  complete,
  icon,
  label
}: {
  active: boolean;
  complete: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold",
        active || complete
          ? "border-[#FFD8BD] bg-white text-[color:var(--sn-ink)]"
          : "border-[color:var(--sn-border)] bg-white/60 text-[color:var(--sn-muted)]"
      )}
    >
      <span
        className={
          complete ? "text-emerald-600" : "text-[color:var(--tlb-orange)]"
        }
      >
        {icon}
      </span>
      {label}
    </div>
  );
}
