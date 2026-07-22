/**
 * Canonical app URL for Auth.js redirects and password-reset links.
 * On Vercel without custom domain: set AUTH_URL to your *.vercel.app URL,
 * or omit AUTH_URL and rely on trustHost + VERCEL_URL fallback.
 */
export function getAppBaseUrl(): string {
  const authUrl = process.env.AUTH_URL?.trim().replace(/\/$/, "");
  if (authUrl) return authUrl;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

/** True when host is the Vercel deployment URL (before custom domains are connected). */
export function isVercelAppHost(host: string): boolean {
  return host.split(":")[0].toLowerCase().endsWith(".vercel.app");
}
