import {
  DetailPanelSkeleton,
  PageHeaderSkeleton
} from "@/components/ui/skeleton";

export default function RequestsLoading() {
  return (
    <main className="min-h-dvh bg-[#f6f6f4] p-4 pt-20 text-foreground sm:p-5 sm:pt-24 lg:p-6 lg:pt-24">
      <div className="mx-auto grid max-w-6xl gap-4">
        <PageHeaderSkeleton />
        <DetailPanelSkeleton />
        <DetailPanelSkeleton />
      </div>
    </main>
  );
}
