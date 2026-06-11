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
<body style="margin:0;padding:0;background:#0f1623;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1623;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12);">
        <!-- Header -->
        <tr>
          <td style="padding:36px 40px 28px;text-align:center;border-bottom:1px solid #eef1f5;">
            <span style="font-size:24px;font-weight:700;color:#0f1623;letter-spacing:-0.5px;">Pharma<span style="color:#2563eb;">Track</span></span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 44px 40px;">
            <!-- Green confirmation indicator -->
            <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:40px;height:40px;background:#dcfce7;border-radius:50%;text-align:center;vertical-align:middle;">
                        <span style="font-size:20px;line-height:40px;color:#16a34a;">&#10003;</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top:14px;">
                  <p style="margin:0;font-size:14px;font-weight:600;color:#16a34a;letter-spacing:0.3px;">Enquiry received</p>
                </td>
              </tr>
            </table>
            <!-- Greeting and body (left-aligned) -->
            <p style="margin:0 0 20px;font-size:16px;color:#0f1623;font-weight:500;">Hi ${firstName},</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#1e293b;">Thanks for your interest in joining the PharmaTrack founding pilot.</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#1e293b;">PharmaTrack is being opened to a small group of community pharmacies that want clearer delivery operations, better customer communication, and stronger care-team updates without adding more admin.</p>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#1e293b;">I've received your details and will come back to you personally to learn a bit more about your pharmacy, answer any questions, and talk through whether the pilot is a good fit.</p>
            <!-- Pilot benefits section -->
            <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;background:#f8fafc;border-radius:10px;border:1px solid #e8edf3;">
              <tr>
                <td style="padding:22px 26px 18px;">
                  <p style="margin:0 0 16px;font-size:14px;font-weight:700;color:#0f1623;letter-spacing:0.2px;">The founding pilot includes:</p>
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.5;color:#1e293b;">
                        <span style="color:#16a34a;font-weight:600;margin-right:8px;">&#10003;</span> Free pilot access
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.5;color:#1e293b;">
                        <span style="color:#16a34a;font-weight:600;margin-right:8px;">&#10003;</span> Early access to new features
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.5;color:#1e293b;">
                        <span style="color:#16a34a;font-weight:600;margin-right:8px;">&#10003;</span> Direct setup and support
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;line-height:1.5;color:#1e293b;">
                        <span style="color:#16a34a;font-weight:600;margin-right:8px;">&#10003;</span> A chance to shape PharmaTrack around real pharmacy workflow
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <!-- Sign-off -->
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#1e293b;">Thanks again,</p>
            <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#0f1623;">Brad</p>
            <p style="margin:0 0 2px;font-size:13px;color:#64748b;">Founder &amp; Product Lead</p>
            <p style="margin:0;font-size:13px;color:#64748b;font-weight:500;">Pharma<span style="color:#2563eb;">Track</span></p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:22px 44px;background:#f8fafc;border-top:1px solid #eef1f5;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">You're receiving this because you submitted your details on the PharmaTrack pilot page.</p>
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
      'Thanks for your interest in joining the PharmaTrack founding pilot.',
      '',
      'PharmaTrack is being opened to a small group of community pharmacies that want clearer delivery operations, better customer communication, and stronger care-team updates without adding more admin.',
      '',
      "I've received your details and will come back to you personally to learn a bit more about your pharmacy, answer any questions, and talk through whether the pilot is a good fit.",
      '',
      'The founding pilot includes:',
      '',
      '- Free pilot access',
      '- Early access to new features',
      '- Direct setup and support',
      '- A chance to shape PharmaTrack around real pharmacy workflow',
      '',
      'Thanks again,',
      '',
      'Brad',
      'Founder & Product Lead',
      'PharmaTrack',
      '',
      '---',
      "You're receiving this because you submitted your details on the PharmaTrack pilot page.",
    ].join('\n');

    emails.push(
      resend.emails.send({
        from:    process.env.FROM_EMAIL,
        to:      clean.contact,
        subject: 'Thanks for your PharmaTrack founding pilot enquiry',
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
