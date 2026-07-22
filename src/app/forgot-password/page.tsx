import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/users";
import { isMailjetConfigured } from "@/lib/email/mailjet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; noMail?: string }>;
}) {
  return (
    <div className="app-shell flex min-h-screen items-center justify-center p-6">
      <ForgotPasswordForm searchParams={searchParams} />
    </div>
  );
}

async function ForgotPasswordForm({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; noMail?: string }>;
}) {
  const params = await searchParams;
  const mailjetReady = isMailjetConfigured();

  return (
    <Card className="w-full max-w-md border-gold/30">
      <CardHeader>
        <CardTitle>Wachtwoord vergeten</CardTitle>
        <p className="text-sm text-muted">
          {mailjetReady
            ? "We sturen je een reset-link per e-mail."
            : "Mailjet is nog niet gekoppeld — vraag je admin om je wachtwoord te resetten."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {params.sent === "1" && (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Als dit e-mailadres bij ons bekend is, ontvang je een reset-link.
          </p>
        )}
        {params.noMail === "1" && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Mailjet is niet ingesteld. Neem contact op met je admin voor een nieuw wachtwoord.
          </p>
        )}
        <form
          action={async (fd) => {
            "use server";
            const email = fd.get("email") as string;
            const result = await requestPasswordReset(email);
            if (!result.mailjet) {
              const { redirect } = await import("next/navigation");
              redirect("/forgot-password?noMail=1");
            }
            const { redirect } = await import("next/navigation");
            redirect("/forgot-password?sent=1");
          }}
          className="space-y-3"
        >
          <Input name="email" type="email" required placeholder="jouw@email.nl" />
          <Button type="submit" className="w-full" disabled={!mailjetReady}>
            Reset-link versturen
          </Button>
        </form>
        <Link href="/login" className="block text-center text-sm text-muted hover:text-gold-bright">
          ← Terug naar login
        </Link>
      </CardContent>
    </Card>
  );
}
