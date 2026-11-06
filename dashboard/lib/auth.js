import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';

/*
 * Sign-in sessions live in the database (staff_sessions), not just in the browser.
 * The cookie holds a random token; the database stores only a keyed hash of it.
 * So signing out, removing a teammate or changing a password cuts access immediately,
 * and a leaked database copy cannot be used to sign in.
 */
const COOKIE = 'bet_staff';
const MAX_DAYS = 7;          // a session never lasts longer than this
const IDLE_HOURS = 48;       // unused for this long and it ends

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ random characters)');
  return s;
}
const tokenId = t => crypto.createHmac('sha256', secret()).update(t).digest('base64url');

// ---------- passwords ----------
const SCRYPT = { N: 16384, r: 8, p: 1 };
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export function verifyPassword(pw, stored) {
  try {
    const [alg, s, h] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const want = Buffer.from(h, 'base64');
    const got = crypto.scryptSync(String(pw), Buffer.from(s, 'base64'), want.length, SCRYPT);
    return crypto.timingSafeEqual(want, got);
  } catch { return false; }
}
// Used when the email doesn't exist, so a wrong email takes as long as a wrong password.
const DUMMY = hashPassword(crypto.randomBytes(12).toString('hex'));
export function checkLogin(pw, stored) { return verifyPassword(pw, stored || DUMMY) && !!stored; }

// ---------- sessions ----------
export async function startSession(staffId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const ua = ((await headers()).get('user-agent') || '').slice(0, 200);
  await db().query(
    `insert into staff_sessions (id, staff_id, expires_at, user_agent) values ($1, $2, now() + make_interval(days => $3), $4)`,
    [tokenId(token), staffId, MAX_DAYS, ua]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production', maxAge: MAX_DAYS * 86400,
  });
}

async function currentToken() {
  const t = (await cookies()).get(COOKIE)?.value;
  return t && /^[A-Za-z0-9_-]{40,60}$/.test(t) ? t : null;
}

export async function currentStaff() {
  const t = await currentToken();
  if (!t) return null;
  const id = tokenId(t);
  const r = await db().query(
    `select s.id, s.email, s.name, s.role, ss.last_seen_at
       from staff_sessions ss join staff s on s.id = ss.staff_id
      where ss.id = $1 and ss.expires_at > now() and ss.last_seen_at > now() - make_interval(hours => $2)
        and s.disabled_at is null`, [id, IDLE_HOURS]);
  const me = r.rows[0];
  if (!me) return null;
  if (Date.now() - new Date(me.last_seen_at).getTime() > 5 * 60_000) {
    await db().query(`update staff_sessions set last_seen_at = now() where id = $1`, [id]);
  }
  delete me.last_seen_at;
  return me;
}

export async function endSession() {
  const t = await currentToken();
  if (t) await db().query(`delete from staff_sessions where id = $1`, [tokenId(t)]);
  (await cookies()).delete(COOKIE);
}

/** Sign a person out everywhere (optionally keeping the session making this request). */
export async function endAllSessions(staffId, keepCurrent = false) {
  const t = keepCurrent ? await currentToken() : null;
  await db().query(`delete from staff_sessions where staff_id = $1 and id <> $2`, [staffId, t ? tokenId(t) : '']);
}

export async function requireStaff() {
  const s = await currentStaff();
  if (!s) redirect('/login');
  return s;
}
export async function requireOwner() {
  const s = await requireStaff();
  if (s.role !== 'owner') redirect('/');
  return s;
}

// ---------- slowing down guessing (stored in the database, so it holds across all servers) ----------
export async function clientIp() {
  return ((await headers()).get('x-forwarded-for') || 'local').split(',')[0].trim().slice(0, 64);
}
const hashKey = k => crypto.createHash('sha256').update(k).digest('base64url'); // never store raw IPs or emails here

/** True when any of the keys has had more than `limit` failures in the last 15 minutes. */
export async function isLocked(keys, limit) {
  const r = await db().query(
    `select count(*)::int n from login_attempts where key = any($1) and created_at > now() - interval '15 minutes' group by key order by 1 desc limit 1`,
    [keys.map(hashKey)]);
  return (r.rows[0]?.n || 0) >= limit;
}
export async function recordFailure(keys) {
  await db().query(`insert into login_attempts (key) select unnest($1::text[])`, [keys.map(hashKey)]);
  if (Math.random() < 0.05) await db().query(`delete from login_attempts where created_at < now() - interval '1 day'`);
}
export async function clearFailures(keys) {
  await db().query(`delete from login_attempts where key = any($1)`, [keys.map(hashKey)]);
}
export async function cleanupSessions() {
  await db().query(`delete from staff_sessions where expires_at < now() or last_seen_at < now() - make_interval(hours => $1)`, [IDLE_HOURS]);
}
