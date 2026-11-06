import Link from 'next/link';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { RANGES, range, TZ, num, pct, dur, ago, place, statusLabel } from '@/lib/fmt';
import { BarList, TrafficChart, Delta } from '@/lib/ui';

export const metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

export default async function Overview({ searchParams }) {
  await requireStaff();
  const r = range((await searchParams).r);
  const iv = RANGES[r][1];
  const q = (sql, p = []) => db().query(sql, p).then(x => x.rows);
  const [b] = r === 'today'
    ? await q(`select date_trunc('day', now() at time zone $1) at time zone $1 s, (date_trunc('day', now() at time zone $1) - interval '1 day') at time zone $1 p`, [TZ])
    : await q(`select now() - $1::interval s, now() - 2 * $1::interval p`, [iv]);
  const S = b.s, PV = b.p;

  const stats = sql => `select count(distinct coalesce(visitor_id, id))::int visitors, count(*)::int sessions, coalesce(sum(pageviews),0)::int pageviews,
      coalesce(avg(nullif(duration_s,0)),0)::int avg_s from sessions where ${sql}`;
  const [cur] = await q(stats(`started_at >= $1`), [S]);
  const [prev] = await q(stats(`started_at >= $2 and started_at < $1`), [S, PV]);
  const [enq] = await q(`select count(*) filter (where created_at >= $1)::int now, count(*) filter (where created_at >= $2 and created_at < $1)::int before from enquiries`, [S, PV]);
  const [live] = await q(`select count(*)::int n from sessions where last_seen_at > now() - interval '5 minutes'`);

  const days = await q(
    `with d as (select generate_series(date_trunc('day', $1::timestamptz at time zone $2), date_trunc('day', now() at time zone $2), interval '1 day') as dd)
     select to_char(d.dd, 'DD Mon') label,
       (select count(distinct coalesce(visitor_id, id)) from sessions s where date_trunc('day', s.started_at at time zone $2) = d.dd)::int visitors,
       (select count(*) from enquiries e where date_trunc('day', e.created_at at time zone $2) = d.dd)::int enquiries
     from d order by d.dd`, [S, TZ]);

  const top = (col, extra = '') => q(`select ${col} label, count(*)::int n from sessions where started_at >= $1 ${extra} group by 1 order by 2 desc limit 8`, [S]);
  const [countries, cities, sources, devices, browsers] = await Promise.all([
    top('country'), top(`concat_ws(', ', city, country)`, `and city is not null`), top('source'), top('device'), top('browser'),
  ]);
  const sections = await q(`select data->>'section' label, count(distinct session_id)::int n from events e
      where e.name = 'section_view' and e.created_at >= $1 group by 1 order by 2 desc limit 8`, [S]);
  const interest = await q(`select label, sum(n)::int n from (
        select case data->>'service' when 'Website Development' then 'Website' when 'CRM Development' then 'CRM'
          when 'CMS Integration' then 'Sanity CMS' when 'Business Automation' then 'Automation' when 'Custom Digital Solutions' then 'Custom web app'
          else data->>'service' end label, count(distinct session_id) n from events where name = 'card_flip' and created_at >= $1 group by 1
        union all select unnest(services), count(*) from enquiries where created_at >= $1 group by 1) t
      where label is not null group by 1 order by 2 desc limit 8`, [S]);
  const [fun] = await q(`select
      (select count(*) from sessions where started_at >= $1)::int visits,
      (select count(distinct session_id) from events where name = 'section_view' and data->>'section' = 'Services' and created_at >= $1)::int services,
      (select count(distinct session_id) from events where name = 'enquiry_open' and created_at >= $1)::int opened,
      (select count(distinct session_id) from events where name = 'enquiry_step' and (data->>'step')::int >= 4 and created_at >= $1)::int halfway,
      (select count(*) from enquiries where created_at >= $1)::int sent`, [S]);
  const recentEnq = await q(`select id, name, brand, status, city, country, created_at from enquiries order by created_at desc limit 5`);
  const recentVisits = await q(`select s.id, s.city, s.country, s.source, s.device, s.started_at, s.duration_s, s.pageviews,
      (select name from enquiries e where e.session_id = s.id limit 1) enquirer
      from sessions s order by s.started_at desc limit 8`);

  const steps = [['Visited the site', fun.visits], ['Saw the services', fun.services], ['Opened the enquiry form', fun.opened], ['Got halfway', fun.halfway], ['Sent an enquiry', fun.sent]];
  return (
    <>
      <div className="top">
        <div><h1>Good to see you. <em>Here's the table.</em></h1><p>How people find the website, what they look at, and who's enquiring.</p></div>
        <nav className="seg">{Object.entries(RANGES).map(([k, [l]]) => <Link key={k} href={`/?r=${k}`} className={k === r ? 'on' : ''}>{l}</Link>)}</nav>
      </div>

      <section className="grid kpis">
        <div className="card kpi live"><p className="l">On the site now</p><p className="v"><i />{num(live.n)}</p><p className="d">Active in the last 5 minutes</p></div>
        <div className="card kpi"><p className="l">Visitors</p><p className="v">{num(cur.visitors)}</p><Delta now={cur.visitors} before={prev.visitors} /></div>
        <div className="card kpi"><p className="l">Visits</p><p className="v">{num(cur.sessions)}</p><Delta now={cur.sessions} before={prev.sessions} /></div>
        <div className="card kpi"><p className="l">Enquiries</p><p className="v">{num(enq.now)}</p><Delta now={enq.now} before={enq.before} /></div>
        <div className="card kpi"><p className="l">Visit to enquiry</p><p className="v">{pct(enq.now, cur.sessions)}%</p><p className="d">of visits sent an enquiry</p></div>
        <div className="card kpi"><p className="l">Avg. time on site</p><p className="v">{dur(cur.avg_s)}</p><p className="d">{num(cur.pageviews)} page views</p></div>
      </section>

      <section className="grid two" style={{ marginTop: 16 }}>
        <div className="card"><h2>Traffic <small>{RANGES[r][0]}</small></h2><TrafficChart days={days} /></div>
        <div className="card"><h2>Where they come from <small>visits</small></h2><BarList rows={sources} color="#E4E0FF" empty="No visits yet" /></div>
      </section>

      <section className="grid three" style={{ marginTop: 16 }}>
        <div className="card"><h2>Countries</h2><BarList rows={countries} color="#FFF1B8" /></div>
        <div className="card"><h2>Cities</h2><BarList rows={cities} color="#FFE3EE" /></div>
        <div className="card"><h2>Devices</h2><BarList rows={devices} color="#D8F8EB" /><h2 style={{ marginTop: 18 }}>Browsers</h2><BarList rows={browsers} color="#EEECF4" /></div>
      </section>

      <section className="grid three" style={{ marginTop: 16 }}>
        <div className="card"><h2>Enquiry funnel</h2>
          <div className="funnel">{steps.map(([l, n]) => (
            <div className="fstep" key={l}><span>{l}</span><span className="track"><i style={{ width: `${steps[0][1] ? (n / steps[0][1]) * 100 : 0}%` }} /></span><b>{num(n)}</b></div>
          ))}</div>
        </div>
        <div className="card"><h2>Service interest <small>card flips + enquiries</small></h2><BarList rows={interest} color="#FFE3EE" /></div>
        <div className="card"><h2>Sections people reach</h2><BarList rows={sections} color="#E4E0FF" /></div>
      </section>

      <section className="grid half" style={{ marginTop: 16 }}>
        <div className="card"><h2>Latest enquiries <Link href="/enquiries"><small>See all →</small></Link></h2>
          {recentEnq.length ? <table className="table"><tbody>{recentEnq.map(e => (
            <tr key={e.id}><td><Link className="row" href={`/enquiries/${e.id}`}>{e.name}</Link><span className="sub">{e.brand || '—'} · {place(e.city, e.country)}</span></td>
              <td><span className={`pill s-${e.status}`}>{statusLabel(e.status)}</span></td><td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{ago(e.created_at)}</td></tr>
          ))}</tbody></table> : <p className="empty">No enquiries yet. They land here the moment someone places a bet.</p>}
        </div>
        <div className="card"><h2>Latest visits <Link href="/visitors"><small>See all →</small></Link></h2>
          {recentVisits.length ? <table className="table"><tbody>{recentVisits.map(v => (
            <tr key={v.id}><td><Link className="row" href={`/visitors/${v.id}`}>{v.enquirer || place(v.city, v.country)}</Link><span className="sub">{v.enquirer ? place(v.city, v.country) + ' · ' : ''}{v.source} · {v.device}</span></td>
              <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{dur(v.duration_s)}</td><td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{ago(v.started_at)}</td></tr>
          ))}</tbody></table> : <p className="empty">No visits yet.</p>}
        </div>
      </section>
    </>
  );
}
