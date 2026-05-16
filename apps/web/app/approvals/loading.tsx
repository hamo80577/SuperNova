import {
  DetailPanelSkeleton,
  PageHeaderSkeleton,
  StatsCardSkeleton
} from "@/components/ui/skeleton";

export default function ApprovalsLoading() {
  return (
    <main className="min-h-dvh bg-[#f6f6f4] p-4 pt-20 text-foreground sm:p-5 sm:pt-24 lg:p-6 lg:pt-24">
      <div className="mx-auto grid max-w-6xl gap-4">
        <PageHeaderSkeleton />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
        <DetailPanelSkeleton />
        <DetailPanelSkeleton />
      </div>
    </main>
  );
}
