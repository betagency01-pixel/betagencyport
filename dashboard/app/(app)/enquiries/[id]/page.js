import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { STATUSES, statusLabel, when, ago, place, dur, eventLabel, TZ } from '@/lib/fmt';

export const metadata = { title: 'Enquiry' };
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

async function update(form) {
  'use server';
  await requireStaff();
  const id = String(form.get('id'));
  if (!UUID.test(id)) return;
  const status = String(form.get('status'));
  const assigned = String(form.get('assigned') || '');
  const version = parseInt(form.get('v'), 10);
  if (!STATUSES.some(s => s[0] === status) || !Number.isInteger(version)) return;
  // Only saves if nobody else changed it since this page was opened.
  const r = await db().query(`update enquiries set status = $2, assigned_to = $3, updated_at = now(), version = version + 1 where id = $1 and version = $4`,
    [id, status, UUID.test(assigned) ? assigned : null, version]);
  revalidatePath(`/enquiries/${id}`);
  redirect(`/enquiries/${id}?${r.rowCount ? 'saved=1' : 'conflict=1'}`);
}
async function addNote(form) {
  'use server';
  const me = await requireStaff();
  const id = String(form.get('id'));
  const body = String(form.get('body') || '').trim().slice(0, 4000);
  if (!UUID.test(id) || !body) return;
  await db().query(`insert into enquiry_notes (enquiry_id, staff_id, body) values ($1,$2,$3)`, [id, me.id, body]);
  await db().query(`update enquiries set updated_at = now() where id = $1`, [id]);
  revalidatePath(`/enquiries/${id}`);
  redirect(`/enquiries/${id}`);
}

export default async function Enquiry({ params, searchParams }) {
  await requireStaff();
  const { id } = await params;
  const { saved, conflict } = await searchParams;
  if (!UUID.test(id)) notFound();
  const e = (await db().query(`select * from enquiries where id = $1`, [id])).rows[0];
  if (!e) notFound();
  const [notes, staff, visit, events, others] = await Promise.all([
    db().query(`select n.*, s.name from enquiry_notes n left join staff s on s.id = n.staff_id where enquiry_id = $1 order by n.created_at`, [id]).then(r => r.rows),
    db().query(`select id, name from staff where disabled_at is null or id = $1 order by name`, [e.assigned_to]).then(r => r.rows),
    e.session_id ? db().query(`select * from sessions where id = $1`, [e.session_id]).then(r => r.rows[0]) : null,
    e.session_id ? db().query(`select * from events where session_id = $1 order by created_at limit 200`, [e.session_id]).then(r => r.rows) : [],
    db().query(`select id, created_at, status from enquiries where id <> $1 and (lower(email) = lower($2) or phone = $3) order by created_at desc`, [id, e.email, e.phone]).then(r => r.rows),
  ]);
  const phone = (e.phone || '').replace(/[^\d+]/g, '');
  const t = d => new Date(d).toLocaleTimeString('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

  return (
    <>
      <Link className="back" href="/enquiries">← All enquiries</Link>
      <div className="top">
        <div><h1>{e.name} <em>{e.brand ? `· ${e.brand}` : ''}</em></h1><p>Received {when(e.created_at)} · Slip {e.slip || '—'} · {place(e.city, e.country)}</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {phone && <a className="btn lemon" href={`https://wa.me/${phone.replace('+', '')}`} target="_blank" rel="noopener">WhatsApp</a>}
          {phone && <a className="btn ghost" href={`tel:${phone}`}>Call</a>}
          {e.email && <a className="btn ghost" href={`mailto:${e.email}?subject=${encodeURIComponent('Your enquiry with BeT Agency Co.')}`}>Email</a>}
        </div>
      </div>

      <section className="grid two">
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h2>What they told us</h2>
            <dl className="dl">
              <dt>Phone</dt><dd>{e.phone || '—'}</dd>
              <dt>Email</dt><dd>{e.email || '—'}</dd>
              <dt>Brand</dt><dd>{e.brand || '—'}</dd>
              <dt>Looking for</dt><dd>{(e.services || []).map(s => <span className="tag" key={s}>{s}</span>)}</dd>
              <dt>Their business</dt><dd>{e.about || '—'}</dd>
              <dt>Current website</dt><dd>{e.has_site || '—'}{e.site ? ` · ${e.site}` : ''}</dd>
              <dt>Budget</dt><dd>{e.budget || '—'}</dd>
              <dt>Timeline</dt><dd>{e.timeline || '—'}</dd>
            </dl>
            {others.length > 0 && <p className="sub" style={{ marginTop: 14, color: 'var(--muted)' }}>They've enquired before: {others.map(o => <Link key={o.id} href={`/enquiries/${o.id}`} style={{ marginRight: 8 }}>{when(o.created_at)}</Link>)}</p>}
          </div>
          <div className="card">
            <h2>Team notes</h2>
            <div className="grid" style={{ gap: 10 }}>
              {notes.length ? notes.map(n => <div className="note" key={n.id}><small>{n.name || 'Former teammate'} · {ago(n.created_at)}</small>{n.body}</div>) : <p className="empty" style={{ padding: 0, textAlign: 'left' }}>No notes yet.</p>}
              <form action={addNote} className="grid" style={{ gap: 10 }}>
                <input type="hidden" name="id" value={e.id} />
                <div className="field"><textarea name="body" rows={3} placeholder="Called them, sending a proposal on Friday…" required /></div>
                <div><button className="btn" type="submit">Add note</button></div>
              </form>
            </div>
          </div>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <form className="card grid" action={update} style={{ gap: 14 }}>
            <h2 style={{ margin: 0 }}>Status <span className={`pill s-${e.status}`}>{statusLabel(e.status)}</span></h2>
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="v" value={e.version} />
            {conflict && <p className="err">A teammate changed this while you had it open. This is the latest version. Make your change again if it still applies.</p>}
            <div className="field"><label htmlFor="status">Stage</label>
              <select id="status" name="status" defaultValue={e.status}>{STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div className="field"><label htmlFor="assigned">Who's handling it</label>
              <select id="assigned" name="assigned" defaultValue={e.assigned_to || ''}><option value="">Nobody yet</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><button className="btn" type="submit">Save</button>{saved && <span className="okmsg">Saved</span>}</div>
          </form>
          <div className="card">
            <h2>Their visit</h2>
            {visit ? (
              <>
                <dl className="dl" style={{ marginBottom: 16 }}>
                  <dt>Location</dt><dd>{[visit.city, visit.region, visit.country].filter(Boolean).join(', ') || 'Unknown'}</dd>
                  <dt>Came from</dt><dd>{visit.source}{visit.campaign ? ` · ${visit.campaign}` : ''}</dd>
                  <dt>Device</dt><dd>{visit.device} · {visit.browser} · {visit.os}</dd>
                  <dt>Time on site</dt><dd>{dur(visit.duration_s)}</dd>
                </dl>
                <div className="timeline">{events.map(ev => <div key={ev.id}><time>{t(ev.created_at)}</time><span>{eventLabel(ev)}</span></div>)}</div>
              </>
            ) : <p className="empty" style={{ textAlign: 'left' }}>No visit details for this enquiry.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
