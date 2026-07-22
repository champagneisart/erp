import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { AuthHeader, AuthPanel, AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function loginAction(formData: FormData) {
  "use server";

  try {
    await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirectTo:
        (formData.get("role_hint") as string) === "artist"
          ? "/artist"
          : "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError && error.type === "CredentialsSignin") {
      redirect("/login?error=invalid");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell>
      <AuthPanel>
        <AuthHeader
          eyebrow="Administratie"
          title="Champagne is Art Studio"
          description="Log in voor admin, staff of kunstenaar"
        />

        {params.reset === "1" && (
          <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            Wachtwoord gewijzigd. Je kunt nu inloggen.
          </p>
        )}

        {params.error === "invalid" && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            Onjuiste e-mail of wachtwoord. Probeer het opnieuw.
          </p>
        )}

        <form action={loginAction} className="form-stack" autoComplete="on">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">E-mail</label>
            <Input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="admin@champagneisart.nl"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Wachtwoord</label>
            <Input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="mt-1 w-full rounded-full">
            Inloggen
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          <Link href="/forgot-password" className="hover:text-gold-bright">
            Wachtwoord vergeten?
          </Link>
        </p>
      </AuthPanel>
    </AuthShell>
  );
}
