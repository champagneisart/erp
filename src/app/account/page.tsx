import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  changeOwnPassword,
  getCurrentUser,
  updateOwnProfile,
} from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const backHref = user.role === "artist" ? "/artist" : "/dashboard";

  return (
    <div className="app-shell min-h-screen overflow-x-hidden p-4 sm:p-6">
      <div className="page-content mx-auto max-w-lg space-y-6">
        <div>
          <Link href={backHref} className="text-sm text-muted hover:text-gold-bright">
            ← Terug
          </Link>
          <h1 className="mt-2 text-xl font-semibold sm:text-2xl">Mijn account</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profiel</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (fd) => {
                "use server";
                await updateOwnProfile({
                  name: fd.get("name") as string,
                  email: fd.get("email") as string,
                });
              }}
              className="form-stack"
            >
              <Input name="name" defaultValue={user.name} required />
              <Input name="email" type="email" defaultValue={user.email} required />
              <p className="text-xs text-muted">Rol: {user.role}</p>
              <Button type="submit" variant="outline">
                Opslaan
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wachtwoord wijzigen</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (fd) => {
                "use server";
                await changeOwnPassword({
                  currentPassword: fd.get("currentPassword") as string,
                  newPassword: fd.get("newPassword") as string,
                });
              }}
              className="form-stack"
            >
              <Input
                name="currentPassword"
                type="password"
                placeholder="Huidig wachtwoord"
                required
              />
              <Input
                name="newPassword"
                type="password"
                minLength={8}
                placeholder="Nieuw wachtwoord"
                required
              />
              <Button type="submit">Wachtwoord wijzigen</Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted">
          <Link href="/forgot-password" className="hover:text-gold-bright">
            Wachtwoord vergeten?
          </Link>
        </p>
      </div>
    </div>
  );
}
