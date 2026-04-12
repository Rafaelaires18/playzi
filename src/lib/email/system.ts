type SendEmailInput = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

function escapeHtml(input: string) {
    return input
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function getPlayziEmailBaseUrl() {
    const explicitBaseUrl = (
        process.env.MODERATION_APP_BASE_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || process.env.NEXT_PUBLIC_SITE_URL
        || process.env.NEXT_PUBLIC_BASE_URL
        || ""
    ).trim();
    if (explicitBaseUrl) return explicitBaseUrl.replace(/\/+$/, "");

    const vercelProd = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
    if (vercelProd) {
        const withProtocol = /^https?:\/\//i.test(vercelProd) ? vercelProd : `https://${vercelProd}`;
        return withProtocol.replace(/\/+$/, "");
    }

    return "https://playzi-rosy.vercel.app";
}

export function buildPlayziSystemEmailHtml(input: {
    title: string;
    paragraphs: string[];
    ctaLabel?: string;
    ctaHref?: string;
    secondaryText?: string;
}) {
    const baseUrl = getPlayziEmailBaseUrl();
    const logoUrl = `${baseUrl}/playzi_logo_transparant.png`;
    const paragraphsHtml = input.paragraphs
        .map((p) => `<p style="margin:0 0 14px 0; color:#1f2937; font-size:16px; line-height:1.65;">${escapeHtml(p)}</p>`)
        .join("");

    const ctaHtml = input.ctaLabel && input.ctaHref
        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 16px 0;">
             <tr>
               <td style="border-radius:12px; background:#1f2937;">
                 <a href="${input.ctaHref}" style="display:inline-block; padding:13px 22px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none;">
                   ${escapeHtml(input.ctaLabel)}
                 </a>
               </td>
             </tr>
           </table>`
        : "";

    const secondaryHtml = input.secondaryText
        ? `<p style="margin:0 0 10px 0; color:#4b5563; font-size:14px; line-height:1.6;">${escapeHtml(input.secondaryText)}</p>`
        : "";

    return `<!doctype html>
<html lang="fr">
  <body style="margin:0; padding:0; background:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:20px 12px; background:#ffffff;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background:#ffffff;">
            <tr>
              <td style="padding:8px 24px 8px 24px;">
                <h1 style="margin:0 0 16px 0; color:#1f2937; font-size:24px; line-height:1.3;">${escapeHtml(input.title)}</h1>
                <p style="margin:0 0 14px 0; color:#1f2937; font-size:16px; line-height:1.65;">Bonjour,</p>
                ${paragraphsHtml}
                ${ctaHtml}
                ${secondaryHtml}
                <p style="margin:0 0 0 0; color:#1f2937; font-size:16px; line-height:1.65;">L’équipe Playzi</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 20px 20px 20px; border-top:1px solid #f0f2f4;">
                <img src="${logoUrl}" alt="Playzi" style="display:block; width:80px; max-width:52%; height:auto; margin:0 auto; background:transparent; border:0; outline:none;" />
                <p style="margin:10px 0 0 0; color:#1f2937; font-size:13px; font-weight:700;">Playzi.</p>
                <p style="margin:4px 0 0 0; color:#6b7280; font-size:12px;">@playzi</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendPlayziSystemEmail(input: SendEmailInput) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MODERATION_FROM_EMAIL || "Playzi <no-reply@playzi.app>";
    if (!apiKey) {
        return { sent: false, reason: "missing_resend_key" } as const;
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from,
            to: [input.to],
            subject: input.subject,
            text: input.text,
            html: input.html,
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        return { sent: false, reason: body || `http_${response.status}` } as const;
    }

    return { sent: true } as const;
}
