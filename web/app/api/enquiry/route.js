import { db } from '@/lib/db';
import { geo, device, clip } from '@/lib/visit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (o, status = 200) => Response.json(o, { status });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID = /^[a-zA-Z0-9_-]{8,64}$/;

// Light protection against spam bursts (per server instance).
const hits = new Map();
function limited(key) {
  const now = Date.now(), list = (hits.get(key) || []).filter(t => now - t < 10 * 60_000);
  list.push(now); hits.set(key, list);
  return list.length > 5;
}

export async function POST(req) {
  let b;
  try { const t = await req.text(); if (t.length > 20000) return json({ ok: false, error: 'Too large' }, 413); b = JSON.parse(t); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'Bad request' }, 400);
  if (b.website) return json({ ok: true }); // honeypot: bots fill hidden fields

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  if (limited(ip)) return json({ ok: false, error: 'Too many enquiries. Please email us instead.' }, 429);

  const name = clip((b.name || '').trim(), 80);
  const email = clip((b.email || '').trim(), 160);
  const phone = clip((b.phone || '').trim(), 30);
  const about = clip((b.about || '').trim(), 2000);
  const services = Array.isArray(b.services) ? b.services.map(s => clip(String(s), 40)).slice(0, 10) : [];
  if (!name) return json({ ok: false, error: 'Name is required' }, 400);
  if (!EMAIL.test(email || '')) return json({ ok: false, error: 'A valid email is required' }, 400);
  if (!phone || phone.replace(/\D/g, '').length < 6) return json({ ok: false, error: 'A valid phone number is required' }, 400);

  const pool = db();
  // Across all servers: no more than 3 enquiries an hour from the same email.
  const recent = await pool.query(`select count(*)::int n from enquiries where lower(email) = lower($1) and created_at > now() - interval '1 hour'`, [email]);
  if (recent.rows[0].n >= 3) return json({ ok: false, error: 'We already have your enquiry. We will be in touch soon.' }, 429);
  const sid = b.sid && ID.test(b.sid) ? b.sid : null;
  let visit = null;
  if (sid) {
    const r = await pool.query('select id, country, region, city, source, device from sessions where id = $1', [sid]);
    visit = r.rows[0] || null;
  }
  const g = visit || geo(req);
  const dev = visit?.device || device(req.headers.get('user-agent') || '').device;

  try {
    const r = await pool.query(
      `insert into enquiries (slip, name, phone, email, brand, about, services, has_site, site, budget, timeline, session_id, country, region, city, source, device)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id`,
      [clip(b.slip, 12), name, phone, email, clip((b.brand || '').trim(), 120), about, services, clip(b.hasSite, 10), clip(b.site, 200),
        clip(b.budget, 40), clip(b.timeline, 40), visit ? sid : null, g.country, g.region, g.city, visit?.source || null, dev]);
    notify({ name, email, phone, brand: b.brand, services, budget: b.budget, timeline: b.timeline, about, where: [g.city, g.country].filter(Boolean).join(', ') })
      .catch(e => console.error('notify failed', e.message));
    return json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error('enquiry insert failed', e.message);
    return json({ ok: false, error: 'Could not save right now' }, 500);
  }
}

// Optional email alert for every new enquiry (set RESEND_API_KEY and NOTIFY_EMAIL).
async function notify(e) {
  const key = process.env.RESEND_API_KEY, to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return;
  const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const rows = [['Name', e.name], ['Brand', e.brand], ['Phone', e.phone], ['Email', e.email], ['Looking for', (e.services || []).join(', ')],
    ['Budget', e.budget], ['Timeline', e.timeline], ['From', e.where], ['About', e.about]];
  const dash = process.env.DASHBOARD_URL ? `<p><a href="${esc(process.env.DASHBOARD_URL)}/enquiries">Open the dashboard</a></p>` : '';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || 'BeT Website <onboarding@resend.dev>',
      to: to.split(',').map(s => s.trim()),
      reply_to: e.email,
      subject: `New enquiry: ${e.brand || e.name}`,
      html: `<h2>New enquiry from ${esc(e.name)}</h2><table>${rows.filter(r => r[1]).map(r => `<tr><td><b>${r[0]}</b></td><td>${esc(r[1])}</td></tr>`).join('')}</table>${dash}`,
    }),
  });
}
