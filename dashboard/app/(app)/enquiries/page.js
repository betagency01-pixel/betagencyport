import Link from 'next/link';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { STATUSES, statusLabel, ago, place, num } from '@/lib/fmt';

export const metadata = { title: 'Enquiries' };
export const dynamic = 'force-dynamic';

export default async function Enquiries({ searchParams }) {
  await requireStaff();
  const sp = await searchParams;
  const status = STATUSES.some(s => s[0] === sp.s) ? sp.s : '';
  const term = String(sp.q || '').trim().slice(0, 80);
  const where = [], p = [];
  if (status) { p.push(status); where.push(`e.status = $${p.length}`); }
  if (term) { p.push(`%${term}%`); where.push(`(e.name ilike $${p.length} or e.brand ilike $${p.length} or e.email ilike $${p.length} or e.phone ilike $${p.length})`); }
  const rows = (await db().query(
    `select e.*, s.name staff_name from enquiries e left join staff s on s.id = e.assigned_to
     ${where.length ? 'where ' + where.join(' and ') : ''} order by e.created_at desc limit 300`, p)).rows;
  const counts = Object.fromEntries((await db().query(`select status, count(*)::int n from enquiries group by 1`)).rows.map(r => [r.status, r.n]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const link = s => `/enquiries?${new URLSearchParams({ ...(s ? { s } : {}), ...(term ? { q: term } : {}) })}`;

  return (
    <>
      <div className="top">
        <div><h1>Enquiries <em>& leads</em></h1><p>Everyone who placed a bet through the website form.</p></div>
        <a className="btn ghost" href="/api/export">Download CSV</a>
      </div>
      <div className="filters">
        <nav className="seg">
          <Link href={link('')} className={!status ? 'on' : ''}>All {num(total)}</Link>
          {STATUSES.map(([k, l]) => <Link key={k} href={link(k)} className={status === k ? 'on' : ''}>{l} {num(counts[k] || 0)}</Link>)}
        </nav>
        <form>{status && <input type="hidden" name="s" value={status} />}<input name="q" defaultValue={term} placeholder="Search name, brand, email or phone" /></form>
      </div>
      <div className="card scroll" style={{ padding: 8 }}>
        {rows.length ? (
          <table className="table">
            <thead><tr><th>Person</th><th>Looking for</th><th>Budget · Timeline</th><th>From</th><th>Status</th><th>Received</th></tr></thead>
            <tbody>{rows.map(e => (
              <tr key={e.id}>
                <td><Link className="row" href={`/enquiries/${e.id}`}>{e.name}</Link><span className="sub">{e.brand || '—'}</span></td>
                <td>{(e.services || []).map(s => <span className="tag" key={s}>{s}</span>)}</td>
                <td>{e.budget || '—'}<span className="sub">{e.timeline}</span></td>
                <td>{place(e.city, e.country)}<span className="sub">{e.source || 'Unknown source'} · {e.device || ''}</span></td>
                <td><span className={`pill s-${e.status}`}>{statusLabel(e.status)}</span>{e.staff_name && <span className="sub">{e.staff_name}</span>}</td>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{ago(e.created_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="empty">{term || status ? 'No enquiries match that.' : 'No enquiries yet. They land here the moment someone places a bet.'}</p>}
      </div>
    </>
  );
}
