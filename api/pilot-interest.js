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
    emails.push(
      resend.emails.send({
        from:    process.env.FROM_EMAIL,
        to:      clean.contact,
        subject: 'Thanks for your interest in the PharmaTrack pilot',
        text:    [
          `Hi ${clean.name},`,
          '',
          'Thanks for getting in touch about the PharmaTrack pilot.',
          '',
          "I'll be in touch soon for a quick chat to learn more about you and your pharmacy, answer any questions, and talk through the next steps.",
          '',
          'Appreciated,',
          'Brad',
          'Founder & Product Lead',
          'PharmaTrack',
        ].join('\n'),
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
