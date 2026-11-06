import Link from 'next/link';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { ago, dur, place, num } from '@/lib/fmt';

export const metadata = { title: 'Visitors' };
export const dynamic = 'force-dynamic';

export default async function Visitors({ searchParams }) {
  await requireStaff();
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.p, 10) || 1), per = 50;
  const only = sp.f === 'live' ? `where s.last_seen_at > now() - interval '5 minutes'` : sp.f === 'returning' ? `where v.visits > 1` : '';
  const rows = (await db().query(
    `select s.*, v.visits, (select name from enquiries e where e.session_id = s.id limit 1) enquirer,
       (select count(*) from events ev where ev.session_id = s.id and ev.type = 'event')::int actions
     from sessions s left join visitors v on v.id = s.visitor_id ${only}
     order by s.started_at desc limit ${per + 1} offset ${(page - 1) * per}`)).rows;
  const more = rows.length > per; if (more) rows.pop();
  const [t] = (await db().query(`select count(*)::int visits, count(distinct coalesce(visitor_id, id))::int people,
      count(*) filter (where last_seen_at > now() - interval '5 minutes')::int live from sessions`)).rows;
  const tab = (f, l) => <Link href={f ? `/visitors?f=${f}` : '/visitors'} className={(sp.f || '') === f ? 'on' : ''}>{l}</Link>;

  return (
    <>
      <div className="top">
        <div><h1>Visitors <em>& visits</em></h1><p>{num(t.people)} people over {num(t.visits)} visits. Names appear once someone sends an enquiry.</p></div>
        <nav className="seg">{tab('', 'All visits')}{tab('live', `Live now ${t.live}`)}{tab('returning', 'Returning')}</nav>
      </div>
      <div className="card scroll" style={{ padding: 8 }}>
        {rows.length ? (
          <table className="table">
            <thead><tr><th>Who</th><th>Location</th><th>Came from</th><th>Device</th><th>Time on site</th><th>Actions</th><th>When</th></tr></thead>
            <tbody>{rows.map(s => (
              <tr key={s.id}>
                <td><Link className="row" href={`/visitors/${s.id}`}>{s.enquirer || (s.visits > 1 ? 'Returning visitor' : 'Visitor')}</Link>
                  <span className="sub">{s.visits > 1 ? `Visit ${s.visits}` : s.consent ? 'First visit' : 'Anonymous'}</span></td>
                <td>{place(s.city, s.country)}<span className="sub">{s.region || ''}</span></td>
                <td>{s.source}<span className="sub">{s.campaign || s.referrer || ''}</span></td>
                <td>{s.device}<span className="sub">{s.browser} · {s.os}</span></td>
                <td>{dur(s.duration_s)}</td>
                <td>{s.actions}</td>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{ago(s.started_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="empty">No visits here yet.</p>}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {page > 1 && <Link className="btn ghost" href={`/visitors?${new URLSearchParams({ ...(sp.f ? { f: sp.f } : {}), p: page - 1 })}`}>← Newer</Link>}
        {more && <Link className="btn ghost" href={`/visitors?${new URLSearchParams({ ...(sp.f ? { f: sp.f } : {}), p: page + 1 })}`}>Older →</Link>}
      </div>
    </>
  );
}
