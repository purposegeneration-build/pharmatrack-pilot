const { createClient } = require('@supabase/supabase-js');
const { Resend }       = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { name = '', pharmacy = '', contact = '' } = req.body ?? {};

  const missing = ['name', 'pharmacy', 'contact'].filter(
    k => !String({ name, pharmacy, contact }[k]).trim()
  );
  if (missing.length) {
    return res.status(400).json({ error: 'Missing required fields.', fields: missing });
  }

  const clean = {
    name:     name.trim(),
    pharmacy: pharmacy.trim(),
    contact:  contact.trim(),
  };

  // Store the lead — success depends on this, nothing else
  const { error: dbError } = await supabase
    .from('pilot_leads')
    .insert(clean);

  if (dbError) {
    console.error('[pilot-interest] Supabase insert failed:', dbError.message);
    return res.status(500).json({ error: 'Could not save your details. Please try again.' });
  }

  // Notification to Brad
  const emails = [
    resend.emails.send({
      from:    process.env.FROM_EMAIL,
      to:      process.env.NOTIFY_EMAIL,
      subject: `New pilot lead: ${clean.pharmacy}`,
      text:    [
        'New pilot interest received.',
        '',
        `Name:     ${clean.name}`,
        `Pharmacy: ${clean.pharmacy}`,
        `Contact:  ${clean.contact}`,
      ].join('\n'),
    }),
  ];

  // Auto-reply only when contact is a valid email address
  if (EMAIL_RE.test(clean.contact)) {
    const firstName = clean.name.split(' ')[0];

    const autoReplyHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #f0f0f0;">
            <span style="font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.5px;">Pharma<span style="color:#2563eb;">Track</span></span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="width:36px;height:36px;background:#dcfce7;border-radius:50%;text-align:center;vertical-align:middle;">
                  <span style="font-size:20px;line-height:36px;color:#16a34a;">&#10003;</span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${firstName},</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">Thanks for your interest in becoming a PharmaTrack founding pilot pharmacy.</p>
            <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#374151;">I've received your details and will be in touch soon to learn more about your pharmacy, answer any questions, and talk through the next steps.</p>
            <p style="margin:0 0 4px;font-size:15px;color:#374151;">Appreciated,</p>
            <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#111827;">Brad</p>
            <p style="margin:0 0 2px;font-size:13px;color:#6b7280;">Founder &amp; Product Lead</p>
            <p style="margin:0;font-size:13px;color:#6b7280;font-weight:500;">Pharma<span style="color:#2563eb;">Track</span></p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">You're receiving this because you submitted your details on the PharmaTrack pilot page.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const autoReplyText = [
      `Hi ${firstName},`,
      '',
      'Thanks for your interest in becoming a PharmaTrack founding pilot pharmacy.',
      '',
      "I've received your details and will be in touch soon to learn more about your pharmacy, answer any questions, and talk through the next steps.",
      '',
      'Appreciated,',
      '',
      'Brad',
      'Founder & Product Lead',
      'PharmaTrack',
    ].join('\n');

    emails.push(
      resend.emails.send({
        from:    process.env.FROM_EMAIL,
        to:      clean.contact,
        subject: 'Thanks for your interest in PharmaTrack',
        html:    autoReplyHtml,
        text:    autoReplyText,
      })
    );
  }

  // Emails are best-effort — a sending failure does not undo a saved lead
  const results = await Promise.allSettled(emails);
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[pilot-interest] Email ${i} failed:`, r.reason);
    }
  });

  return res.status(200).json({ ok: true });
};
