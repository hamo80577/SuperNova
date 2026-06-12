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
        "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[color:var(--sn-border)] bg-white text-sm font-semibold text-[color:var(--sn-body)] transition duration-200 hover:border-[#FFD8BD] hover:bg-[#FFE8D9] hover:text-[color:var(--tlb-orange-900)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tlb-orange)] active:scale-[0.96]",
        iconOnly
          ? size === "sm"
            ? "h-8 w-8 p-0"
            : "h-10 w-10 p-0"
          : size === "sm"
            ? "min-h-8 px-2.5"
            : "min-h-10 px-3",
        state === "copied" &&
          "border-[oklch(0.85_0.06_150)] bg-[oklch(0.95_0.045_150)] text-[oklch(0.58_0.13_150)]",
        state === "error" &&
          "border-[oklch(0.85_0.06_27)] bg-[oklch(0.95_0.035_27)] text-[oklch(0.55_0.19_27)]",
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
