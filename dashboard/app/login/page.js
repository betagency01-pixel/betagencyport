import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { currentStaff, checkLogin, startSession, clientIp, isLocked, recordFailure, clearFailures, cleanupSessions } from '@/lib/auth';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

async function login(form) {
  'use server';
  const email = String(form.get('email') || '').trim().toLowerCase().slice(0, 160);
  const password = String(form.get('password') || '').slice(0, 200);
  const ip = await clientIp();
  const byEmail = 'login:' + email, byIp = 'ip:' + ip;
  // Same message whether or not the email exists, and the lock applies either way.
  if ((await isLocked([byEmail], 8)) || (await isLocked([byIp], 30))) redirect('/login?e=wait');
  const r = await db().query('select id, password_hash from staff where lower(email) = $1 and disabled_at is null', [email]);
  const s = r.rows[0];
  if (!checkLogin(password, s?.password_hash)) {
    await recordFailure([byEmail, byIp]);
    redirect('/login?e=1');
  }
  await clearFailures([byEmail]);
  await db().query('update staff set last_login_at = now() where id = $1', [s.id]);
  await cleanupSessions();
  await startSession(s.id);
  redirect('/');
}

export default async function Login({ searchParams }) {
  if (await currentStaff()) redirect('/');
  const { e } = await searchParams;
  const none = (await db().query('select count(*)::int n from staff')).rows[0].n === 0;
  return (
    <main className="auth">
      <form action={login}>
        <div className="brand"><b>BeT</b><span>AGENCY<br />CO.</span></div>
        <div>
          <h1>Team dashboard</h1>
          <p>For the BeT team only. Sign in with your work account.</p>
        </div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        {e === '1' && <p className="err">That email and password don't match.</p>}
        {e === 'wait' && <p className="err">Too many attempts. Try again in 15 minutes.</p>}
        <button className="btn" type="submit">Sign in</button>
        {none && <p>No accounts yet. The owner sets up the first one at <a href="/setup">/setup</a>.</p>}
      </form>
    </main>
  );
}
