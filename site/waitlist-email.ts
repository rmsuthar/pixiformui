/**
 * Emails sent after a Pro & Cloud waitlist sign-up (site/worker.ts): a confirmation to the person and
 * a notification to the owner. Sent with Resend when RESEND_API_KEY is set on this Worker; otherwise
 * skipped (the sign-up is still stored).
 */

export interface WaitlistRecord {
  email: string;
  name?: string;
  company?: string;
  website?: string;
  teamSize?: string | null;
  useCase?: string | null;
  volume?: string | null;
  current?: string | null;
  timeline?: string | null;
  interests: string[];
  message?: string;
  source?: string;
}

export interface MailEnv {
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  OWNER_EMAIL?: string;
  CLOUD_URL?: string;
}

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const LABELS: Record<string, string> = {
  cloud: 'PixiForm Cloud (hosted, encrypted backend)',
  'card-field': 'Secure card field',
  'pro-controls': 'Pro controls',
  enterprise: 'Enterprise support and compliance',
};

/** One email layout: brand, title, paragraphs, an optional button, an optional details table. */
function layout(title: string, paragraphs: string[], opts: { button?: { label: string; url: string }; rows?: [string, string][]; footer: string }): string {
  const p = (t: string) => `<p style="margin:0 0 16px;font:15px/1.6 ${FONT};color:#111827">${esc(t)}</p>`;
  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px"><tr><td style="border-radius:10px;background:#4f46e5"><a href="${esc(opts.button.url)}" style="display:inline-block;padding:12px 22px;font:600 15px/1 ${FONT};color:#fff;text-decoration:none;border-radius:10px">${esc(opts.button.label)}</a></td></tr></table>`
    : '';
  const rows = opts.rows?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 18px;border:1px solid #e3e7ee;border-radius:10px;border-collapse:separate">${opts.rows
        .map(([k, v], i) => `<tr><td style="padding:9px 14px;font:13px/1.5 ${FONT};color:#5b6577;width:38%;vertical-align:top;${i ? 'border-top:1px solid #e3e7ee;' : ''}">${esc(k)}</td><td style="padding:9px 14px;font:14px/1.5 ${FONT};color:#111827;white-space:pre-wrap;word-break:break-word;${i ? 'border-top:1px solid #e3e7ee;' : ''}">${esc(v)}</td></tr>`)
        .join('')}</table>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f5f9"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f9"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 4px 14px;font:700 16px/1 ${FONT};color:#111827">PixiForm<span style="color:#4f46e5">UI</span></td></tr>
<tr><td style="background:#fff;border:1px solid #e3e7ee;border-radius:14px;padding:28px 28px 12px">
<h1 style="margin:0 0 16px;font:700 22px/1.3 ${FONT};color:#111827">${esc(title)}</h1>
${paragraphs.map(p).join('\n')}${button}${rows}
</td></tr>
<tr><td style="padding:16px 6px;font:12.5px/1.6 ${FONT};color:#5b6577">${esc(opts.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

const rowsOf = (r: WaitlistRecord): [string, string][] =>
  (
    [
      ['Email', r.email],
      ['Name', r.name],
      ['Company', r.company],
      ['Website', r.website],
      ['Team size', r.teamSize],
      ['Form for', r.useCase],
      ['Submissions a month', r.volume],
      ['Uses today', r.current],
      ['Needs it', r.timeline],
      ['Interested in', r.interests.map((i) => LABELS[i] ?? i).join(', ')],
      ['What would make it worth paying for', r.message],
      ['Came from', r.source],
    ] as [string, string | null | undefined][]
  ).filter((x): x is [string, string] => !!x[1]);

export function confirmationEmail(r: WaitlistRecord, cloudUrl: string, owner: string): Mail {
  const name = r.name ? `Hi ${r.name.split(/\s+/)[0]}, thanks` : 'Thanks';
  const paras = [
    `${name} for joining the PixiFormUI Pro & Cloud waitlist. You'll get early access, and early-access pricing, as soon as paid plans open.`,
    'You don’t have to wait to start: PixiForm Cloud is already live with a free plan. Create an end-to-end encrypted form for your website in about five minutes, with no server to run.',
  ];
  const after = ['Questions, or something you’d like us to build first? Just reply to this email: it comes straight to us.'];
  const html = layout('You’re on the list', [...paras], { button: { label: 'Start free on PixiForm Cloud', url: cloudUrl }, footer: 'You received this because you joined the waitlist at pixiformui.lets.gen.in/pro/. We only email you about PixiFormUI Pro and Cloud; reply “remove” to be taken off the list.' }).replace(
    '</td></tr>\n<tr><td style="padding:16px 6px',
    `<p style="margin:0 0 16px;font:15px/1.6 ${FONT};color:#111827">${esc(after[0])}</p></td></tr>\n<tr><td style="padding:16px 6px`,
  );
  const text = `You're on the list\n\n${paras.join('\n\n')}\n\nStart free on PixiForm Cloud: ${cloudUrl}\n\n${after[0]}\n\n--\nYou received this because you joined the waitlist at pixiformui.lets.gen.in/pro/. Reply "remove" to be taken off the list.\n`;
  return { to: r.email, subject: 'You’re on the PixiFormUI Pro & Cloud waitlist', text, html, replyTo: owner };
}

export function ownerEmail(r: WaitlistRecord, owner: string, updated: boolean): Mail {
  const rows = rowsOf(r);
  const title = updated ? 'Waitlist sign-up updated' : 'New waitlist sign-up';
  const html = layout(title, [updated ? `${r.email} updated their details.` : `${r.email} joined the Pro & Cloud waitlist. Reply to this email to answer them directly.`], { rows, footer: 'From the waitlist form at pixiformui.lets.gen.in/pro/ · Export everything with npm run waitlist.' });
  const text = `${title}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n`;
  return { to: owner, subject: `${title}: ${r.company || r.name || r.email}`, text, html, replyTo: r.email };
}

export async function sendMail(env: MailEnv, mail: Mail): Promise<void> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return; // not configured: the sign-up is still stored
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html, ...(mail.replyTo ? { reply_to: mail.replyTo } : {}) }),
  });
  if (!res.ok) throw new Error(`Email provider error ${res.status}`);
}
