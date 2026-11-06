import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { when, dur, eventLabel, ago, place, TZ } from '@/lib/fmt';

export const metadata = { title: 'Visit' };
export const dynamic = 'force-dynamic';

export default async function Visit({ params }) {
  await requireStaff();
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) notFound();
  const s = (await db().query(`select s.*, v.visits, v.first_seen from sessions s left join visitors v on v.id = s.visitor_id where s.id = $1`, [id])).rows[0];
  if (!s) notFound();
  const [events, enquiry, past] = await Promise.all([
    db().query(`select * from events where session_id = $1 order by created_at limit 300`, [id]).then(r => r.rows),
    db().query(`select id, name, brand from enquiries where session_id = $1 limit 1`, [id]).then(r => r.rows[0]),
    s.visitor_id ? db().query(`select id, started_at, duration_s, source from sessions where visitor_id = $1 and id <> $2 order by started_at desc limit 20`, [s.visitor_id, id]).then(r => r.rows) : [],
  ]);
  const t = d => new Date(d).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit' });

  return (
    <>
      <Link className="back" href="/visitors">← All visits</Link>
      <div className="top">
        <div><h1>{enquiry ? enquiry.name : 'A visit'} <em>from {place(s.city, s.country)}</em></h1><p>{when(s.started_at)} · {dur(s.duration_s)} on site</p></div>
        {enquiry && <Link className="btn lemon" href={`/enquiries/${enquiry.id}`}>Open their enquiry</Link>}
      </div>
      <section className="grid two">
        <div className="card"><h2>What they did</h2>
          {events.length ? <div className="timeline">{events.map(ev => <div key={ev.id}><time>{t(ev.created_at)}</time><span>{eventLabel(ev)}</span></div>)}</div> : <p className="empty">Nothing recorded.</p>}
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card"><h2>Details</h2>
            <dl className="dl">
              <dt>Location</dt><dd>{[s.city, s.region, s.country].filter(Boolean).join(', ') || 'Unknown'}</dd>
              <dt>Came from</dt><dd>{s.source}{s.referrer && s.referrer !== s.source ? ` (${s.referrer})` : ''}</dd>
              {s.campaign && <><dt>Campaign</dt><dd>{s.campaign}{s.medium ? ` · ${s.medium}` : ''}</dd></>}
              <dt>Device</dt><dd>{s.device} · {s.browser} · {s.os}</dd>
              <dt>Screen</dt><dd>{s.screen || '—'}</dd>
              <dt>Language</dt><dd>{s.language || '—'}</dd>
              <dt>Cookies</dt><dd>{s.consent ? 'Accepted' : 'Not accepted (anonymous visit)'}</dd>
            </dl>
          </div>
          {s.visitor_id && <div className="card"><h2>Their other visits <small>first seen {when(s.first_seen)}</small></h2>
            {past.length ? <table className="table"><tbody>{past.map(p => (
              <tr key={p.id}><td><Link className="row" href={`/visitors/${p.id}`}>{when(p.started_at)}</Link></td><td>{p.source}</td><td>{dur(p.duration_s)}</td></tr>
            ))}</tbody></table> : <p className="empty">This was their first visit.</p>}
          </div>}
        </div>
      </section>
    </>
  );
}
