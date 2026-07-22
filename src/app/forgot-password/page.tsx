import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/users";
import { isMailjetConfigured } from "@/lib/email/mailjet";
import { AuthHeader, AuthPanel, AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; noMail?: string }>;
}) {
  return (
    <AuthShell>
      <ForgotPasswordForm searchParams={searchParams} />
    </AuthShell>
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
    <AuthPanel>
      <AuthHeader
        title="Wachtwoord vergeten"
        description={
          mailjetReady
            ? "We sturen je een reset-link per e-mail."
            : "Mailjet is nog niet gekoppeld — vraag je admin om je wachtwoord te resetten."
        }
      />

      {params.sent === "1" && (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Als dit e-mailadres bij ons bekend is, ontvang je een reset-link.
        </p>
      )}
      {params.noMail === "1" && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
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
        className="form-stack"
      >
        <Input name="email" type="email" required placeholder="jouw@email.nl" />
        <Button type="submit" className="w-full rounded-full" disabled={!mailjetReady}>
          Reset-link versturen
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        <Link href="/login" className="hover:text-gold-bright">
          ← Terug naar login
        </Link>
      </p>
    </AuthPanel>
  );
}
