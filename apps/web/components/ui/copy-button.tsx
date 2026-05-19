"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type CopyState = "idle" | "copied" | "error";

export function CopyButton({
  "aria-label": ariaLabel,
  className,
  iconOnly = false,
  label,
  size = "md",
  text
}: {
  "aria-label"?: string;
  className?: string;
  iconOnly?: boolean;
  label?: string;
  size?: "sm" | "md";
  text: string;
}) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") {
      return;
    }

    const timer = window.setTimeout(() => setState("idle"), 1500);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copyText() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) {
          throw new Error("Clipboard unavailable.");
        }
      }
      setState("copied");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      aria-label={ariaLabel ?? label ?? "Copy"}
      aria-live="polite"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition duration-200 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:scale-[0.96]",
        iconOnly
          ? size === "sm"
            ? "h-8 w-8 p-0"
            : "h-10 w-10 p-0"
          : size === "sm"
            ? "min-h-8 px-2.5"
            : "min-h-10 px-3",
        state === "copied" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        state === "error" && "border-red-200 bg-red-50 text-red-700",
        className
      )}
      onClick={copyText}
      type="button"
    >
      {state === "copied" ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {label && !iconOnly ? (
        <span>
          {state === "copied" ? "Copied" : state === "error" ? "Copy failed" : label}
        </span>
      ) : null}
    </button>
  );
}
