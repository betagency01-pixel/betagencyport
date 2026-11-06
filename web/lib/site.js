/** The public address of the site. Set SITE_URL in Vercel once your domain is live; until then the request's own address is used. */
export function siteUrl(req) {
  const env = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  if (env) return env;
  try { return new URL(req.url).origin; } catch { return 'https://betagency.co'; }
}
export const text = (body, type) => new Response(body, {
  headers: { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'public, max-age=3600' },
});
