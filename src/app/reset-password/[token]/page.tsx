import Link from "next/link";
import { resetPasswordWithToken } from "@/lib/actions/users";
import { AuthHeader, AuthPanel, AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <AuthShell>
      <AuthPanel>
        <AuthHeader
          title="Nieuw wachtwoord"
          description="Kies een nieuw wachtwoord (min. 8 tekens)."
        />

        <form
          action={async (fd) => {
            "use server";
            const password = fd.get("password") as string;
            const confirm = fd.get("password_confirm") as string;
            if (password !== confirm) {
              throw new Error("Wachtwoorden komen niet overeen");
            }
            await resetPasswordWithToken(token, password);
            const { redirect } = await import("next/navigation");
            redirect("/login?reset=1");
          }}
          className="form-stack"
        >
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Nieuw wachtwoord"
            autoComplete="new-password"
          />
          <Input
            name="password_confirm"
            type="password"
            required
            minLength={8}
            placeholder="Herhaal wachtwoord"
            autoComplete="new-password"
          />
          <Button type="submit" className="w-full rounded-full">
            Wachtwoord opslaan
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          <Link href="/login" className="hover:text-gold-bright">
            ← Naar login
          </Link>
        </p>
      </AuthPanel>
    </AuthShell>
  );
}
