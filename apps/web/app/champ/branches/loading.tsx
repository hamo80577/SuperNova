export default function ChampBranchesLoading() {
  return (
    <main className="min-h-dvh bg-background p-5 text-foreground">
      <div className="grid gap-3">
        <div className="h-28 animate-pulse rounded-lg border bg-muted/40" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-32 animate-pulse rounded-lg border bg-muted/40" />
          <div className="h-32 animate-pulse rounded-lg border bg-muted/40" />
          <div className="h-32 animate-pulse rounded-lg border bg-muted/40" />
        </div>
      </div>
    </main>
  );
}
