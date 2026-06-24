export type ParsedInquiry = {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  address: string | null;
  title: string | null;
  description: string | null;
  requests: string[];
  theme: string | null;
  bottleText: string | null;
  wantsQuote: boolean;
  wantsProofDesign: boolean;
  quantity: number | null;
  source: string;
};

const SIGNATURE_MARKERS = [
  /^met vriendelijke groet/i,
  /^kind regards/i,
  /^mvg\b/i,
  /^groet,/i,
  /^best regards/i,
  /^cheers,/i,
];

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function companyFromEmail(email: string): string | null {
  const domain = email.split("@")[1]?.split(".")[0];
  if (!domain || ["gmail", "hotmail", "outlook", "yahoo", "icloud", "live"].includes(domain)) {
    return null;
  }
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

function splitBodyAndSignature(text: string): { body: string; signature: string } {
  const lines = text.split(/\r?\n/);
  let splitAt = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (SIGNATURE_MARKERS.some((m) => m.test(line))) {
      splitAt = i;
      break;
    }
  }

  return {
    body: lines.slice(0, splitAt).join("\n").trim(),
    signature: lines.slice(splitAt).join("\n").trim(),
  };
}

function extractEmail(text: string): string | null {
  const labeled = text.match(/(?:E\.|E-mail:|Email:)\s*([\w.+-]+@[\w.-]+\.[a-z]{2,})/i);
  if (labeled) return labeled[1].toLowerCase();

  const emails = text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) ?? [];
  const filtered = emails.filter(
    (e) => !e.includes("champagneisart") && !e.includes("noreply")
  );
  return filtered[0]?.toLowerCase() ?? null;
}

function extractPhone(text: string): string | null {
  const labeled = text.match(
    /(?:T\.|Tel\.|Telefoon:?)\s*(\+?\d[\d\s().-]{7,}\d)/i
  );
  if (labeled) return normalizePhone(labeled[1]);

  const dutchMobile = text.match(/\+31\s*\(?0?\)?\s*6[\s\d]{7,}/i);
  if (dutchMobile) return normalizePhone(dutchMobile[0]);

  const generic = text.match(/(?:\+31|0)[\s(]*\d{1,4}[\s).-]*\d[\d\s.-]{6,}/);
  return generic ? normalizePhone(generic[0]) : null;
}

const JOB_TITLE_PATTERN =
  /executive|manager|director|account|sales|ceo|founder|officer|consultant|adviseur|specialist/i;

export function looksLikePersonName(line: string): boolean {
  if (JOB_TITLE_PATTERN.test(line)) return false;
  if (/\d|@|http|\.io|\.nl|afbeelding|book a|read more/i.test(line)) return false;
  if (line.length > 50) return false;

  // "Derk van Dijk", "Jan de Vries"
  if (
    /^[A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+(?:van|de|der|den|te)\s+[A-ZÀ-ÿ][a-zà-ÿ]+)+$/.test(line)
  ) {
    return true;
  }
  // "First Last" or "First Middle Last"
  if (/^[A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]+){1,2}$/.test(line)) {
    return true;
  }
  return false;
}

function extractNameNearContact(text: string, email: string | null): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const emailIdx = email
    ? lines.findIndex((l) => l.toLowerCase().includes(email.toLowerCase()))
    : -1;

  const searchFrom = emailIdx > 0 ? emailIdx - 1 : lines.length - 1;
  for (let i = searchFrom; i >= Math.max(0, searchFrom - 6); i--) {
    if (looksLikePersonName(lines[i])) return lines[i];
  }
  return null;
}

function extractNameFromSignature(signature: string): string | null {
  const lines = signature
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !SIGNATURE_MARKERS.some((m) => m.test(l)) &&
        !/^(afbeelding|image|logo|book a|read more|http|www\.|T\.|E\.|tel\.)/i.test(l)
    );

  for (const line of lines) {
    if (looksLikePersonName(line)) return line;
  }

  return null;
}

function extractJobTitle(signature: string, personName: string | null): string | null {
  const lines = signature.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!personName) return null;
  const nameIdx = lines.findIndex((l) => l === personName);
  if (nameIdx >= 0 && lines[nameIdx + 1]) {
    const next = lines[nameIdx + 1];
    if (!/^\d|@|http|afbeelding|\d{4}\s*[A-Z]{2}/i.test(next)) return next;
  }
  return null;
}

function extractAddress(signature: string): string | null {
  const lines = signature
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const postcodeIdx = lines.findIndex((l) => /^\d{4}\s*[A-Z]{2}\b/i.test(l));
  if (postcodeIdx < 0) return null;

  const postcode = lines[postcodeIdx];
  const streetLine = postcodeIdx > 0 ? lines[postcodeIdx - 1] : null;
  if (streetLine && /\d/.test(streetLine) && !JOB_TITLE_PATTERN.test(streetLine)) {
    return `${streetLine}, ${postcode}`;
  }
  return postcode;
}

function extractRequests(body: string): string[] {
  const requests: string[] = [];
  const lower = body.toLowerCase();

  if (/prijs(opgave|indicatie|voorstel)|offerte|quote/i.test(body)) {
    requests.push("prijsopgave");
  }
  if (/proefdesign|proef.?design|mock.?up|voorbeeld.?ontwerp/i.test(body)) {
    requests.push("proefdesign");
  }
  if (/logo/i.test(body)) requests.push("logo");
  if (/personalis|gepersonaliseerd|custom/i.test(body)) {
    requests.push("gepersonaliseerde fles");
  }
  if (/onboard/i.test(body)) requests.push("onboarding klanten");

  return requests;
}

function extractTitle(body: string, requests: string[]): string {
  const firstSentence = body.split(/[.!?\n]/).find((s) => s.trim().length > 15)?.trim();
  if (firstSentence && firstSentence.length < 120) return firstSentence;

  if (requests.length > 0) {
    return `Aanvraag: ${requests.join(", ")}`;
  }

  return "Nieuwe aanvraag";
}

function extractBottleText(body: string): string | null {
  const quoted = body.match(/"([^"]+)"/)?.[1];
  if (quoted) return quoted;

  const welkom = body.match(/welkom bij[^.\n]*/i)?.[0];
  return welkom ?? null;
}

function extractTheme(body: string): string | null {
  if (/premium/i.test(body)) return "Premium merk champagne";
  if (/jubileum/i.test(body)) return "Jubileum";
  if (/onboard/i.test(body)) return "Onboarding nieuwe klanten";
  if (/gepersonaliseerd|personalis/i.test(body)) return "Gepersonaliseerde fles";
  return null;
}

function extractQuantity(body: string): number | null {
  const m = body.match(/(\d+)\s*(?:stuks?|flessen|magnums?|st\b)/i);
  return m ? Number(m[1]) : null;
}

function cleanDescription(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parse volledige e-mails, formulieren en vrije tekst naar gestructureerde aanvraagdata. */
export function parseInquiryText(text: string): ParsedInquiry {
  const trimmed = text.trim();
  const { body, signature } = splitBodyAndSignature(trimmed);

  const email = extractEmail(trimmed);
  const phone = extractPhone(trimmed);
  const name =
    extractNameFromSignature(signature) ??
    extractNameFromSignature(trimmed) ??
    extractNameNearContact(trimmed, email);
  const company =
    companyFromEmail(email ?? "") ??
    (signature.match(/^([A-Z][A-Za-z0-9 &.-]{2,})$/m)?.[1] ?? null);
  const requests = extractRequests(body);
  const wantsQuote = requests.includes("prijsopgave");
  const wantsProofDesign = requests.includes("proefdesign");

  const title = extractTitle(body, requests);
  const description = cleanDescription(body);
  const theme = extractTheme(body);
  const bottleText = extractBottleText(body);
  const quantity = extractQuantity(body);
  const jobTitle = extractJobTitle(signature, name);
  const address = extractAddress(signature);

  const missing: string[] = [];
  if (!name) missing.push("naam");
  if (!email && !phone) missing.push("email of telefoon");

  return {
    name,
    company,
    email,
    phone,
    jobTitle,
    address,
    title,
    description,
    requests,
    theme,
    bottleText,
    wantsQuote,
    wantsProofDesign,
    quantity,
    source: trimmed.includes("@") || /E\.\s*\S+@/.test(trimmed) ? "email" : "manual",
  };
}

export function parsedToLeadFields(parsed: ParsedInquiry) {
  const missing: string[] = [];
  if (!parsed.name) missing.push("naam");
  if (!parsed.email && !parsed.phone) missing.push("email of telefoon");

  const extraNotes = [
    parsed.theme ? `Thema: ${parsed.theme}` : null,
    parsed.bottleText ? `Flestekst: ${parsed.bottleText}` : null,
    parsed.wantsQuote ? "Wil prijsopgave" : null,
    parsed.wantsProofDesign ? "Wil proefdesign" : null,
    parsed.quantity ? `Aantal: ${parsed.quantity}` : null,
    parsed.jobTitle ? `Functie: ${parsed.jobTitle}` : null,
    parsed.address ? `Adres: ${parsed.address}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const fullDescription = [parsed.description, extraNotes].filter(Boolean).join("\n\n");

  return {
    name: parsed.name,
    company: parsed.company,
    email: parsed.email,
    phone: parsed.phone,
    title: parsed.title,
    description: fullDescription,
    source: parsed.source,
    missing_fields: missing,
    theme: parsed.theme,
    bottleText: parsed.bottleText,
    requests: parsed.requests,
  };
}
