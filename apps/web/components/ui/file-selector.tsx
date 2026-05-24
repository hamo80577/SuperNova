"use client";

import { FileUp, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FileSelectorProps {
  accept?: string;
  browseLabel?: string;
  className?: string;
  disabled?: boolean;
  error?: string | null;
  file: File | null;
  helperText?: string;
  id?: string;
  maxSizeLabel?: string;
  name?: string;
  onFileChange: (file: File | null) => void;
  supportedFormats?: string;
  title?: string;
}

export function FileSelector({
  accept,
  browseLabel = "Choose File",
  className,
  disabled = false,
  error,
  file,
  helperText,
  id,
  maxSizeLabel,
  name,
  onFileChange,
  supportedFormats,
  title = "Drag and drop file here"
}: FileSelectorProps) {
  const inputId = React.useId();
  const resolvedId = id ?? inputId;
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  function pickFile(files: FileList | null) {
    if (disabled) {
      return;
    }

    onFileChange(files?.[0] ?? null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    pickFile(event.dataTransfer.files);
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div
        className={cn(
          "group relative grid min-h-40 place-items-center rounded-lg border border-dashed bg-white px-4 py-6 text-center transition",
          isDragging
            ? "border-primary bg-brand-soft"
            : "border-slate-300 hover:border-primary/40 hover:bg-muted/20",
          disabled && "cursor-not-allowed opacity-60 hover:border-slate-300 hover:bg-white",
          error && "border-red-300 bg-red-50/40"
        )}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          accept={accept}
          className="sr-only"
          disabled={disabled}
          id={resolvedId}
          name={name}
          onChange={(event) => pickFile(event.target.files)}
          ref={inputRef}
          type="file"
        />

        <div className="grid justify-items-center gap-2">
          <FileUp
            aria-hidden="true"
            className={cn(
              "h-8 w-8 text-slate-300 transition group-hover:text-primary/70",
              isDragging && "text-primary",
              error && "text-red-400"
            )}
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {file ? file.name : title}
            </p>
            {supportedFormats ? (
              <p className="mt-1 text-xs text-slate-500">
                Files Supported: {supportedFormats}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              className="min-h-10"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              type="button"
              variant="outline"
            >
              {browseLabel}
            </Button>
            {file ? (
              <Button
                aria-label="Remove selected file"
                className="h-10 w-10 p-0"
                disabled={disabled}
                onClick={() => onFileChange(null)}
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          {maxSizeLabel ? (
            <p className="text-xs text-slate-500">{maxSizeLabel}</p>
          ) : null}
        </div>
      </div>

      {helperText ? (
        <p className="text-xs leading-5 text-muted-foreground">{helperText}</p>
      ) : null}
      {error ? <p className="text-xs leading-5 text-red-700">{error}</p> : null}
    </div>
  );
}
