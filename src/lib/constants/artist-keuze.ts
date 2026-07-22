export type ArtistKeuzeDecoded = {
  raw: string;
  artist: string;
  bottle: string;
  priceLabel: string;
  summary: string;
};

/** Bekende formulierwaarden (artist_slug + prijscode) */
const EXACT_MAP: Record<string, Omit<ArtistKeuzeDecoded, "raw" | "summary">> = {
  darrin500: {
    artist: "Darrin",
    bottle: "René Schloesser Brut Magnum 1,5L",
    priceLabel: "€350 incl. btw",
  },
  darrin250: {
    artist: "Darrin",
    bottle: "René Schloesser Brut 0,75L",
    priceLabel: "€250 incl. btw",
  },
  darrin350: {
    artist: "Darrin",
    bottle: "René Schloesser Brut Magnum 1,5L",
    priceLabel: "€350 incl. btw",
  },
  darrin450: {
    artist: "Darrin",
    bottle: "Dom Pérignon 0,75L",
    priceLabel: "€450 incl. btw",
  },
  teo1500: {
    artist: "Teo Kaykay",
    bottle: "Gepersonaliseerde fles hoogwaardige champagne",
    priceLabel: "€1.500 incl. btw",
  },
  labrie2000: {
    artist: "Labrie Was Here",
    bottle: "Gepersonaliseerde fles hoogwaardige champagne",
    priceLabel: "€2.000 incl. btw",
  },
  loes4000: {
    artist: "Loes van Delft",
    bottle: "Gepersonaliseerde fles hoogwaardige champagne",
    priceLabel: "€4.000 incl. btw",
  },
};

const ARTIST_SLUGS: Record<string, string> = {
  darrin: "Darrin",
  teo: "Teo Kaykay",
  labrie: "Labrie Was Here",
  loes: "Loes van Delft",
};

const BOTTLE_BY_PRICE_CODE: Record<string, { bottle: string; priceLabel: string }> = {
  "250": {
    bottle: "René Schloesser Brut 0,75L",
    priceLabel: "€250 incl. btw",
  },
  "350": {
    bottle: "René Schloesser Brut Magnum 1,5L",
    priceLabel: "€350 incl. btw",
  },
  "450": {
    bottle: "Dom Pérignon 0,75L",
    priceLabel: "€450 incl. btw",
  },
  "500": {
    bottle: "Gepersonaliseerde fles hoogwaardige champagne 1,5L",
    priceLabel: "€500 incl. btw",
  },
  "1500": {
    bottle: "Gepersonaliseerde fles hoogwaardige champagne",
    priceLabel: "€1.500 incl. btw",
  },
  "2000": {
    bottle: "Gepersonaliseerde fles hoogwaardige champagne",
    priceLabel: "€2.000 incl. btw",
  },
  "4000": {
    bottle: "Gepersonaliseerde fles hoogwaardige champagne",
    priceLabel: "€4.000 incl. btw",
  },
};

function buildSummary(
  artist: string,
  bottle: string,
  priceLabel: string
): string {
  return `${artist} — ${bottle} (${priceLabel})`;
}

/** Decodeert waarden zoals `darrin500` naar kunstenaar, fles en prijs. */
export function decodeArtistKeuze(raw: string): ArtistKeuzeDecoded | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;

  const exact = EXACT_MAP[key];
  if (exact) {
    return {
      raw,
      ...exact,
      summary: buildSummary(exact.artist, exact.bottle, exact.priceLabel),
    };
  }

  const match = key.match(/^([a-z]+)(\d+)$/);
  if (!match) return null;

  const [, artistSlug, priceCode] = match;
  const artist = ARTIST_SLUGS[artistSlug] ?? artistSlug.replace(/\b\w/g, (c) => c.toUpperCase());
  const product = BOTTLE_BY_PRICE_CODE[priceCode];
  if (!product) return null;

  return {
    raw,
    artist,
    bottle: product.bottle,
    priceLabel: product.priceLabel,
    summary: buildSummary(artist, product.bottle, product.priceLabel),
  };
}

export function formatArtistKeuze(raw: string): string {
  return decodeArtistKeuze(raw)?.summary ?? raw;
}
