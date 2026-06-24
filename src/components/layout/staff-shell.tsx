import { AppPanel } from "@/components/layout/app-panel";
import { TopNav } from "@/components/layout/top-nav";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function StaffShell({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="app-shell">
      <header className="border-b border-gold/15 bg-panel/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Administratie
              </p>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                Champagne is Art Studio
              </h1>
              <p className="mt-1 text-sm text-muted">
                Ingelogd als <span className="text-foreground">{session?.user?.name}</span>{" "}
                <span className="text-gold-dim">({session?.user?.role})</span>
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" className="rounded-full px-6">
                Uitloggen
              </Button>
            </form>
          </div>
          <div className="mt-5 overflow-x-auto pb-1">
            <TopNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
        <AppPanel>{children}</AppPanel>
      </main>
    </div>
  );
}
