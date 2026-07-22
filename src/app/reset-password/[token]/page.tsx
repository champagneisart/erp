import Link from "next/link";
import { resetPasswordWithToken } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="app-shell flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md border-gold/30">
        <CardHeader>
          <CardTitle>Nieuw wachtwoord</CardTitle>
          <p className="text-sm text-muted">Kies een nieuw wachtwoord (min. 8 tekens).</p>
        </CardHeader>
        <CardContent>
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
            className="space-y-3"
          >
            <Input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Nieuw wachtwoord"
            />
            <Input
              name="password_confirm"
              type="password"
              required
              minLength={8}
              placeholder="Herhaal wachtwoord"
            />
            <Button type="submit" className="w-full">
              Wachtwoord opslaan
            </Button>
          </form>
          <Link
            href="/login"
            className="mt-4 block text-center text-sm text-muted hover:text-gold-bright"
          >
            ← Naar login
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
