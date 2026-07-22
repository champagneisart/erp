import { cn } from "@/lib/utils";

/** Horizontaal scrollbare tabel-wrapper voor small/medium schermen. */
export function TableScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("table-scroll", className)}>{children}</div>;
}
