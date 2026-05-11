import { AppLoadingOverlay } from "@/components/ui/app-loading-overlay";

export default function Loading() {
  return <AppLoadingOverlay fixed={false} label="Loading page" />;
}
