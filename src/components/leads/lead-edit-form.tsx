"use client";

import { useState, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LeadEditSectionProps = {
  title: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCompany: string;
  onSave: (formData: FormData) => Promise<void>;
  children: ReactNode;
};

export function LeadEditSection({
  title,
  description,
  customerName,
  customerEmail,
  customerPhone,
  customerCompany,
  onSave,
  children,
}: LeadEditSectionProps) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {!editing && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditing(true)}
            aria-label="Aanvraag bewerken"
            className="h-9 w-9 shrink-0 p-0 text-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {editing && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Bewerken</CardTitle>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(false)}
              aria-label="Bewerken sluiten"
              className="h-9 w-9 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData) => {
                await onSave(formData);
                setEditing(false);
              }}
              className="form-stack sm:max-w-lg"
            >
              <Input name="title" placeholder="Titel / thema" defaultValue={title} />
              <Textarea
                name="description"
                placeholder="Omschrijving"
                defaultValue={description}
                className="min-h-24"
              />
              <p className="text-sm font-medium text-muted">Klantgegevens</p>
              <Input name="customerName" placeholder="Naam" defaultValue={customerName} />
              <Input name="customerEmail" placeholder="E-mail" defaultValue={customerEmail} />
              <Input name="customerPhone" placeholder="Telefoon" defaultValue={customerPhone} />
              <Input name="customerCompany" placeholder="Bedrijf" defaultValue={customerCompany} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Opslaan</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Annuleren
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}
