import { cn } from "@/lib/utils";

export function AuthShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="app-shell flex min-h-screen items-center justify-center overflow-x-hidden p-4 sm:p-6">
      <div className={cn("mx-auto w-full max-w-[26rem] shrink-0", className)}>{children}</div>
    </div>
  );
}

export function AuthPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "app-panel overflow-hidden p-6 shadow-[0_0_48px_rgba(201,162,39,0.14)] sm:p-8",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AuthHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6 space-y-2 border-b border-gold/15 pb-6">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      )}
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {description && <p className="text-sm text-muted">{description}</p>}
    </header>
  );
}
