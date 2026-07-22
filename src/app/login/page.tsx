import Link from "next/link";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="app-shell flex min-h-screen items-center justify-center overflow-x-hidden p-4 sm:p-6">
      <Card className="w-full max-w-md min-w-0 border-gold/30 shadow-[0_0_40px_rgba(201,162,39,0.12)]">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Administratie
          </p>
          <CardTitle className="text-2xl">Champagne is Art Studio</CardTitle>
          <p className="text-sm text-muted">Log in voor admin, staff of kunstenaar</p>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              "use server";
              await signIn("credentials", {
                email: formData.get("email") as string,
                password: formData.get("password") as string,
                redirectTo:
                  (formData.get("role_hint") as string) === "artist"
                    ? "/artist"
                    : "/dashboard",
              });
            }}
            className="form-stack"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">E-mail</label>
              <Input name="email" type="email" required placeholder="admin@champagneisart.nl" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Wachtwoord</label>
              <Input name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full rounded-full">
              Inloggen
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted">
            <Link href="/forgot-password" className="hover:text-gold-bright">
              Wachtwoord vergeten?
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
