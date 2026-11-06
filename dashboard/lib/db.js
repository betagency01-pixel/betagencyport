import pg from 'pg';

// One pool per server instance (reused across requests and hot reloads).
const g = globalThis;
export function db() {
  if (!g.__betPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const local = /localhost|127\.0\.0\.1|host=\//.test(url);
    g.__betPool = new pg.Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10_000,
      ssl: local || process.env.DATABASE_SSL === 'off' ? false : { rejectUnauthorized: false },
    });
  }
  return g.__betPool;
}
