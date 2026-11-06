import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { hashPassword, startSession, clientIp, isLocked, recordFailure } from '@/lib/auth';

export const metadata = { title: 'First-time setup' };
export const dynamic = 'force-dynamic';

const noStaff = async () => (await db().query('select count(*)::int n from staff')).rows[0].n === 0;
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

async function setup(form) {
  'use server';
  if (!(await noStaff())) redirect('/login');
  const key = process.env.SETUP_KEY;
  const byIp = 'setup:' + (await clientIp());
  if (await isLocked([byIp], 5)) redirect('/setup?e=wait');
  if (!key || !same(form.get('key') || '', key)) { await recordFailure([byIp]); redirect('/setup?e=key'); }
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const pw = String(form.get('password') || '');
  if (!name || !email.includes('@')) redirect('/setup?e=fields');
  if (pw.length < 10) redirect('/setup?e=pw');
  // Only ever creates an owner while the staff table is empty, even if two people submit at once.
  const c = await db().connect();
  let id;
  try {
    await c.query('begin');
    await c.query('lock table staff in exclusive mode');
    const r = await c.query(
      `insert into staff (email, name, password_hash, role) select $1,$2,$3,'owner' where not exists (select 1 from staff) returning id`,
      [email.slice(0, 160), name.slice(0, 80), hashPassword(pw)]);
    await c.query('commit');
    id = r.rows[0]?.id;
  } catch (err) { await c.query('rollback'); throw err; } finally { c.release(); }
  if (!id) redirect('/login');
  await startSession(id);
  redirect('/');
}

export default async function Setup({ searchParams }) {
  if (!(await noStaff())) redirect('/login');
  const { e } = await searchParams;
  return (
    <main className="auth">
      <form action={setup}>
        <div className="brand"><b>BeT</b><span>AGENCY<br />CO.</span></div>
        <div><h1>Create the owner account</h1><p>This page only works once, while there are no accounts yet. You'll need the SETUP_KEY from your hosting settings.</p></div>
        <div className="field"><label htmlFor="key">Setup key</label><input id="key" name="key" type="password" required /></div>
        <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" required /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div>
        <div className="field"><label htmlFor="password">Password (10+ characters)</label><input id="password" name="password" type="password" minLength={10} required /></div>
        {e === 'key' && <p className="err">That setup key isn't right.</p>}
        {e === 'wait' && <p className="err">Too many attempts. Try again in 15 minutes.</p>}
        {e === 'fields' && <p className="err">Add your name and a valid email.</p>}
        {e === 'pw' && <p className="err">Use at least 10 characters for the password.</p>}
        <button className="btn" type="submit">Create account</button>
      </form>
    </main>
  );
}
