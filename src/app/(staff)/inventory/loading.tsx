export default function InventoryLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-40 rounded bg-border" />
        <div className="h-4 w-72 rounded bg-border" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-48 rounded-xl bg-border/60" />
        <div className="h-48 rounded-xl bg-border/60" />
      </div>
      <div className="h-64 rounded-xl bg-border/60" />
    </div>
  );
}
