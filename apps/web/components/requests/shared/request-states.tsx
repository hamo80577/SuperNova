import { AlertCircle } from "lucide-react";

import { DetailPanelSkeleton } from "@/components/ui/skeleton";

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />
      {message}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return <DetailPanelSkeleton className="min-h-48" label={label} />;
}
