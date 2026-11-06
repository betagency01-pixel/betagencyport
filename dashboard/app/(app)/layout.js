import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireStaff, endSession } from '@/lib/auth';
import NavLinks from './nav';

export const dynamic = 'force-dynamic';

async function signOut() {
  'use server';
  await endSession();
  redirect('/login');
}

export default async function AppLayout({ children }) {
  const me = await requireStaff();
  const fresh = (await db().query(`select count(*)::int n from enquiries where status = 'new'`)).rows[0].n;
  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="/"><b>BeT</b><span>AGENCY<br />CO.</span></a>
        <NavLinks fresh={fresh} owner={me.role === 'owner'} />
        <div className="me">
          <span><b>{me.name}</b>{me.role === 'owner' ? 'Owner' : 'Team'}</span>
          <form action={signOut}><button type="submit">Sign out</button></form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
