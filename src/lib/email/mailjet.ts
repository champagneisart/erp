type MailjetConfig = {
  apiKey: string;
  secretKey: string;
  fromEmail: string;
  fromName?: string;
};

function getMailjetConfig(): MailjetConfig | null {
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  const fromEmail = process.env.MAILJET_FROM_EMAIL;
  if (!apiKey || !secretKey || !fromEmail) return null;
  return {
    apiKey,
    secretKey,
    fromEmail,
    fromName: process.env.MAILJET_FROM_NAME ?? "Champagne is Art Studio",
  };
}

export function isMailjetConfigured() {
  return getMailjetConfig() !== null;
}

export async function sendPasswordResetEmail(data: {
  toEmail: string;
  toName: string;
  resetUrl: string;
}) {
  const config = getMailjetConfig();
  if (!config) {
    return { ok: false as const, reason: "mailjet_not_configured" as const };
  }

  const auth = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString(
    "base64"
  );

  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Messages: [
        {
          From: {
            Email: config.fromEmail,
            Name: config.fromName,
          },
          To: [{ Email: data.toEmail, Name: data.toName }],
          Subject: "Wachtwoord resetten — Champagne is Art Studio",
          TextPart: `Hallo ${data.toName},\n\nKlik op deze link om je wachtwoord te resetten (geldig 1 uur):\n${data.resetUrl}\n\nAls je dit niet hebt aangevraagd, negeer deze mail.`,
          HTMLPart: `<p>Hallo ${data.toName},</p><p><a href="${data.resetUrl}">Klik hier om je wachtwoord te resetten</a> (geldig 1 uur).</p><p>Als je dit niet hebt aangevraagd, negeer deze mail.</p>`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ok: false as const, reason: "send_failed" as const, body };
  }

  return { ok: true as const };
}
