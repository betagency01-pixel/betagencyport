import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireStaff, requireOwner, hashPassword, verifyPassword, endAllSessions, isLocked, recordFailure, clearFailures } from '@/lib/auth';
import { ago } from '@/lib/fmt';

export const metadata = { title: 'Team' };
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

async function addMember(form) {
  'use server';
  await requireOwner();
  const name = String(form.get('name') || '').trim().slice(0, 80);
  const email = String(form.get('email') || '').trim().toLowerCase().slice(0, 160);
  const pw = String(form.get('password') || '');
  const role = form.get('role') === 'owner' ? 'owner' : 'staff';
  if (!name || !email.includes('@') || pw.length < 10) redirect('/team?e=add');
  try {
    await db().query(`insert into staff (email, name, password_hash, role) values ($1,$2,$3,$4)`, [email, name, hashPassword(pw), role]);
  } catch { redirect('/team?e=exists'); }
  redirect('/team?ok=added');
}
async function removeMember(form) {
  'use server';
  const me = await requireOwner();
  const id = String(form.get('id'));
  if (!UUID.test(id) || id === me.id) redirect('/team');
  // Access is switched off, not deleted, so it can be restored. Their sessions end immediately.
  await db().query(`update staff set disabled_at = now() where id = $1`, [id]);
  await endAllSessions(id);
  redirect('/team?ok=removed');
}
async function restoreMember(form) {
  'use server';
  await requireOwner();
  const id = String(form.get('id'));
  if (!UUID.test(id)) redirect('/team');
  await db().query(`update staff set disabled_at = null where id = $1`, [id]);
  redirect('/team?ok=restored');
}
async function resetPassword(form) {
  'use server';
  await requireOwner();
  const id = String(form.get('id')), pw = String(form.get('password') || '');
  if (!UUID.test(id) || pw.length < 10 || pw.length > 200) redirect('/team?e=pw');
  await db().query(`update staff set password_hash = $2 where id = $1`, [id, hashPassword(pw)]);
  await endAllSessions(id); // anyone signed in as them is signed out
  redirect('/team?ok=reset');
}
async function changeOwn(form) {
  'use server';
  const me = await requireStaff();
  const cur = String(form.get('current') || ''), pw = String(form.get('password') || '');
  const key = 'pwchange:' + me.id;
  if (await isLocked([key], 5)) redirect('/team?e=wait');
  const row = (await db().query(`select password_hash from staff where id = $1`, [me.id])).rows[0];
  if (!verifyPassword(cur, row.password_hash)) { await recordFailure([key]); redirect('/team?e=current'); }
  if (pw.length < 10 || pw.length > 200) redirect('/team?e=pw');
  await clearFailures([key]);
  await db().query(`update staff set password_hash = $2 where id = $1`, [me.id, hashPassword(pw)]);
  await endAllSessions(me.id, true); // other devices are signed out, this one stays in
  redirect('/team?ok=changed');
}

const MSG = {
  add: 'Add a name, a valid email and a password of 10+ characters.', exists: 'Someone already uses that email.',
  pw: 'Passwords need 10+ characters.', current: "Your current password isn't right.",
  added: 'Teammate added. Share their email and password with them privately.', removed: 'Access removed. They were signed out straight away. You can restore it below.',
  reset: 'Password reset. They have been signed out everywhere.', changed: 'Your password is updated. Your other devices are signed out.',
  restored: 'Access restored.', wait: 'Too many attempts. Try again in 15 minutes.',
};

export default async function Team({ searchParams }) {
  const me = await requireStaff();
  const { e, ok, confirm } = await searchParams;
  const owner = me.role === 'owner';
  const team = owner ? (await db().query(`select id, name, email, role, last_login_at, created_at, disabled_at from staff order by disabled_at nulls first, created_at`)).rows : [];

  return (
    <>
      <div className="top"><div><h1>{owner ? <>The <em>team</em></> : <>My <em>account</em></>}</h1>
        <p>{owner ? 'Everyone here can sign in to this dashboard. Clients never can.' : `Signed in as ${me.email}`}</p></div></div>
      {(e || ok) && <p className={e ? 'err' : 'okmsg'} style={{ marginBottom: 14 }}>{MSG[e || ok]}</p>}

      {owner && (
        <section className="grid two">
          <div className="card scroll"><h2>People with access</h2>
            <table className="table">
              <thead><tr><th>Name</th><th>Role</th><th>Last sign-in</th><th></th></tr></thead>
              <tbody>{team.map(s => (
                <tr key={s.id}>
                  <td><b>{s.name}</b><span className="sub">{s.email}</span></td>
                  <td>{s.disabled_at ? <span className="pill s-lost">Access removed</span> : s.role === 'owner' ? 'Owner' : 'Team'}</td>
                  <td style={{ color: 'var(--muted)' }}>{s.last_login_at ? ago(s.last_login_at) : 'Never'}</td>
                  <td>{s.id !== me.id && (s.disabled_at ? (
                    <form action={restoreMember}><input type="hidden" name="id" value={s.id} /><button className="btn ghost" type="submit" style={{ padding: '6px 12px' }}>Restore access</button></form>
                  ) : confirm === s.id ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <span style={{ fontSize: 13.5 }}>Remove {s.name}'s access? They'll be signed out now.</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <form action={removeMember}><input type="hidden" name="id" value={s.id} /><button className="btn danger" type="submit" style={{ padding: '6px 12px' }}>Yes, remove</button></form>
                        <a className="btn ghost" href="/team" style={{ padding: '6px 12px' }}>Cancel</a>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <form action={resetPassword} style={{ display: 'flex', gap: 6 }}>
                        <input type="hidden" name="id" value={s.id} />
                        <input name="password" type="password" placeholder="New password" minLength={10} required style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '6px 10px', width: 140 }} />
                        <button className="btn ghost" type="submit" style={{ padding: '6px 12px' }}>Reset</button>
                      </form>
                      <a className="btn danger" href={`/team?confirm=${s.id}`} style={{ padding: '6px 12px', justifySelf: 'start' }}>Remove access</a>
                    </div>
                  ))}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <form className="card grid" action={addMember} style={{ gap: 14, alignContent: 'start' }}>
            <h2 style={{ margin: 0 }}>Add a teammate</h2>
            <div className="field"><label htmlFor="n">Name</label><input id="n" name="name" required /></div>
            <div className="field"><label htmlFor="em">Work email</label><input id="em" name="email" type="email" required /></div>
            <div className="field"><label htmlFor="pw">Temporary password (10+ characters)</label><input id="pw" name="password" type="password" minLength={10} required /></div>
            <div className="field"><label htmlFor="ro">Role</label><select id="ro" name="role" defaultValue="staff"><option value="staff">Team (enquiries + stats)</option><option value="owner">Owner (also manages the team)</option></select></div>
            <div><button className="btn" type="submit">Add teammate</button></div>
          </form>
        </section>
      )}

      <form className="card grid" action={changeOwn} style={{ gap: 14, maxWidth: 460, marginTop: 16 }}>
        <h2 style={{ margin: 0 }}>Change my password</h2>
        <div className="field"><label htmlFor="cur">Current password</label><input id="cur" name="current" type="password" autoComplete="current-password" required /></div>
        <div className="field"><label htmlFor="np">New password (10+ characters)</label><input id="np" name="password" type="password" autoComplete="new-password" minLength={10} required /></div>
        <div><button className="btn" type="submit">Update password</button></div>
      </form>
    </>
  );
}
