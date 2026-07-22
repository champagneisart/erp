import { AppPanel } from "@/components/layout/app-panel";
import { TopNav } from "@/components/layout/top-nav";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function StaffShell({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-40 border-b border-gold/15 bg-panel/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 py-2.5 md:px-8 md:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-gold sm:text-xs">
                Administratie
              </p>
              <h1 className="truncate text-lg font-bold text-foreground sm:text-2xl md:text-3xl">
                Champagne is Art Studio
              </h1>
              <p className="mt-0.5 truncate text-xs text-muted">
                {session?.user?.name}{" "}
                <span className="text-gold-dim">({session?.user?.role})</span>
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
              className="shrink-0 pt-0.5"
            >
              <Button
                type="submit"
                variant="ghost"
                className="h-8 rounded-full px-3 text-xs font-medium text-muted hover:text-foreground sm:h-9 sm:px-4 sm:text-sm"
              >
                Uitloggen
              </Button>
            </form>
          </div>
          <div className="mt-2 md:mt-4">
            <TopNav />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-[1600px] px-3 py-4 pb-8 sm:px-4 md:px-8 md:py-8">
        <AppPanel className="min-w-0">{children}</AppPanel>
      </main>
    </div>
  );
}
