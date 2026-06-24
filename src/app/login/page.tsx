import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="app-shell flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md border-gold/30 shadow-[0_0_40px_rgba(201,162,39,0.12)]">
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
            className="space-y-4"
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
            Demo: admin@champagneisart.nl / admin123 — kunstenaar: artist@champagneisart.nl /
            artist123
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
