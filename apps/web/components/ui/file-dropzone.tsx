"use client";

import { FileSpreadsheet, UploadCloud, X } from "lucide-react";
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent
} from "react";

import { cn } from "@/lib/utils";

export function FileDropzone({
  accept,
  className,
  disabled,
  file,
  hint,
  onFileChange
}: {
  accept?: string;
  className?: string;
  disabled?: boolean;
  file: File | null;
  hint?: string;
  onFileChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const inputId = useId();

  function openPicker() {
    if (disabled) {
      return;
    }

    inputRef.current?.click();
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    onFileChange(event.target.files?.[0] ?? null);
    // Reset so re-selecting the same file still fires a change event.
    event.target.value = "";
  }

  // Drag handlers live on the always-rendered outer container so drag-and-drop
  // works in both the empty and the selected (chip) states. A depth counter
  // avoids flicker as the cursor crosses nested child elements.
  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) {
      return;
    }

    const dropped = event.dataTransfer.files?.[0] ?? null;
    if (dropped) {
      onFileChange(dropped);
    }
  }

  return (
    <div
      className={cn("min-w-0", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        accept={accept}
        className="sr-only"
        disabled={disabled}
        id={inputId}
        onChange={handleInputChange}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />

      {file ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border bg-[color:var(--sn-sunken)] p-3 transition",
            dragging
              ? "border-[color:var(--tlb-orange)] bg-[#FFE8D9]/60"
              : "border-[color:var(--sn-border)]"
          )}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#FFE8D9] text-[color:var(--tlb-orange)]">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[color:var(--sn-ink)]">
              {file.name}
            </p>
            <p className="mt-0.5 text-xs text-[color:var(--sn-muted)]">
              {formatFileSize(file.size)}
            </p>
          </div>
          <button
            className="h-9 shrink-0 rounded-lg border border-[color:var(--sn-border)] bg-white px-3 text-xs font-medium text-[color:var(--sn-body)] transition hover:bg-[color:var(--sn-sunken)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            onClick={openPicker}
            type="button"
          >
            Replace
          </button>
          <button
            aria-label="Remove file"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--sn-border)] bg-white text-[color:var(--sn-muted)] transition hover:bg-[color:var(--sn-sunken)] hover:text-[color:var(--sn-ink)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            onClick={() => onFileChange(null)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60",
            dragging
              ? "border-[color:var(--tlb-orange)] bg-[#FFE8D9]/60"
              : "border-[color:var(--sn-border)] bg-[color:var(--sn-sunken)] hover:border-[color:var(--tlb-orange)]/60 hover:bg-[color:var(--sn-sunken)]/70"
          )}
          disabled={disabled}
          onClick={openPicker}
          type="button"
        >
          <span
            className={cn(
              "grid h-11 w-11 place-items-center rounded-full transition",
              dragging
                ? "bg-white text-[color:var(--tlb-orange)]"
                : "bg-[#FFE8D9] text-[color:var(--tlb-orange)]"
            )}
          >
            <UploadCloud className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium text-[color:var(--sn-ink)]">
            {dragging ? (
              "Drop the file to upload"
            ) : (
              <>
                <span className="text-[color:var(--tlb-orange)]">
                  Click to browse
                </span>{" "}
                or drag &amp; drop
              </>
            )}
          </span>
          {hint ? (
            <span className="text-xs text-[color:var(--sn-muted)]">{hint}</span>
          ) : null}
        </button>
      )}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KB`;
  }

  return `${(kib / 1024).toFixed(1)} MB`;
}
