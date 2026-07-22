import { approveDraft, regenerateMailDraftForLead } from "@/lib/actions/inbox";
import { Button } from "@/components/ui/button";
import { parseDraftDeliberation } from "@/lib/ai/customer-contact-agent";

export function MailDraftPanel({
  emailBody,
  internalNotes,
  approved,
  draftId,
  leadId,
  regenerateContext,
}: {
  emailBody: string;
  internalNotes?: string | null;
  approved?: boolean;
  draftId?: number;
  leadId?: number;
  regenerateContext?: {
    customerName?: string;
    customerEmail?: string;
    leadTitle?: string;
  };
}) {
  const deliberation = parseDraftDeliberation(internalNotes);
  const usedFallback = deliberation.some(
    (d) => d.agent === "Systeem" && /fallback|OpenAI niet/i.test(d.note)
  );

  return (
    <div className="space-y-3 rounded-md border border-gold/25 bg-gold/5 p-4">
      <p className="font-medium text-gold-bright">Klantcontact Agent — mailopzet</p>

      {usedFallback && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          Dit is een basis-template (OpenAI niet actief of mislukt). Gebruik
          &quot;Opnieuw genereren&quot; na het instellen van uw API-sleutel, of schrijf
          handmatig bij.
        </p>
      )}

      {deliberation.length > 0 && (
        <details className="rounded-lg border border-gold/15 bg-black/20 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-gold">
            Intern conclaaf ({deliberation.length})
          </summary>
          <ul className="mt-2 space-y-2 text-muted">
            {deliberation.map((d, i) => (
              <li key={i}>
                <strong className="text-gold-dim">{d.agent}:</strong> {d.note}
              </li>
            ))}
          </ul>
        </details>
      )}

      <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">{emailBody}</pre>

      <div className="flex flex-wrap gap-2">
        {leadId && regenerateContext && (
          <form
            action={async () => {
              "use server";
              await regenerateMailDraftForLead(leadId, regenerateContext);
            }}
          >
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              Opnieuw genereren
            </Button>
          </form>
        )}

        {draftId && !approved && (
          <form
            action={async () => {
              "use server";
              await approveDraft(draftId);
            }}
          >
            <Button type="submit" variant="secondary" className="w-full sm:w-auto">
              Markeer als goedgekeurd
            </Button>
          </form>
        )}
      </div>

      {draftId && !approved && (
        <p className="text-xs text-muted">
          Goedkeuren stuurt niets automatisch — het markeert dit concept intern als klaar
          om te kopiëren naar uw mailprogramma.
        </p>
      )}
    </div>
  );
}
