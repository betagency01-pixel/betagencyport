import { db } from '@/lib/db';
import { geo, device, isBot, trafficSource, clip } from '@/lib/visit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-zA-Z0-9_-]{8,64}$/;
const EVENTS = new Set(['faq_open', 
  'section_view', 'card_flip', 'coin_magic', 'vibe_change', 'chip_throw', 'testimonial_open', 'ebd_visit',
  'enquiry_open', 'enquiry_step', 'enquiry_submit', 'stack_pick', 'stack_lock', 'instagram_click', 'email_copy', 'cta_click',
]);
const ok = () => new Response(null, { status: 204 });

export async function POST(req) {
  const ua = req.headers.get('user-agent') || '';
  if (isBot(ua)) return ok();
  let b;
  try { const t = await req.text(); if (t.length > 4000) return ok(); b = JSON.parse(t); } catch { return ok(); }
  const sid = b && b.sid;
  if (!sid || !ID.test(sid)) return ok();
  const consent = b.consent === true;
  const vid = consent && b.vid && ID.test(b.vid) ? b.vid : null;
  const pool = db();

  try {
    if (b.t === 'pv') {
      const g = geo(req), d = device(ua);
      const src = trafficSource({ referrer: b.ref, utmSource: b.us, utmMedium: b.um, utmCampaign: b.uc, ownHost: req.headers.get('host') });
      if (vid) {
        await pool.query(
          `insert into visitors (id) values ($1)
           on conflict (id) do update set last_seen = now(),
             visits = visitors.visits + case when not exists (select 1 from sessions where id = $2) then 1 else 0 end`, [vid, sid]);
      }
      await pool.query(
        `insert into sessions (id, visitor_id, consent, country, region, city, referrer, source, medium, campaign, landing_path, device, browser, os, screen, language, pageviews)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1)
         on conflict (id) do update set pageviews = sessions.pageviews + 1, last_seen_at = now(),
           visitor_id = coalesce(sessions.visitor_id, excluded.visitor_id), consent = sessions.consent or excluded.consent`,
        [sid, vid, consent, g.country, g.region, g.city, clip(src.referrer, 200), src.source, src.medium, src.campaign,
          clip(b.path, 200) || '/', d.device, d.browser, d.os, clip(b.scr, 20), clip(b.lang, 20)]);
      await pool.query(`insert into events (session_id, type, path) values ($1, 'pageview', $2)`, [sid, clip(b.path, 200) || '/']);
    } else if (b.t === 'ev' && EVENTS.has(b.name)) {
      const data = b.data && typeof b.data === 'object' ? JSON.stringify(b.data).slice(0, 1000) : null;
      await pool.query(
        `insert into events (session_id, type, name, path, data) select $1, 'event', $2, $3, $4::jsonb where exists (select 1 from sessions where id = $1)`,
        [sid, b.name, clip(b.path, 200), data]);
      await pool.query(`update sessions set last_seen_at = now() where id = $1`, [sid]);
    } else if (b.t === 'consent' && vid) {
      await pool.query(`insert into visitors (id) values ($1) on conflict (id) do update set last_seen = now()`, [vid]);
      await pool.query(`update sessions set consent = true, visitor_id = coalesce(visitor_id, $2) where id = $1`, [sid, vid]);
    } else if (b.t === 'ping') {
      await pool.query(
        `update sessions set last_seen_at = now(),
           duration_s = least(greatest(duration_s, extract(epoch from now() - started_at)::int), 7200)
         where id = $1 and now() - last_seen_at < interval '30 minutes'`, [sid]);
    }
  } catch (e) {
    console.error('track failed', e.message);
  }
  return ok();
}
