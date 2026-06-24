import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold-bright",
        className
      )}
    >
      {children}
    </span>
  );
}
