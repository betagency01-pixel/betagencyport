import { siteUrl, text } from '@/lib/site';
export const dynamic = 'force-dynamic';

// Search engines and AI answer engines are welcome; the API is not for crawling.
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot'];

export function GET(req) {
  const site = siteUrl(req);
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /api/', ''];
  for (const b of AI_BOTS) lines.push(`User-agent: ${b}`, 'Allow: /', 'Disallow: /api/', '');
  lines.push(`Sitemap: ${site}/sitemap.xml`, '');
  return text(lines.join('\n'), 'text/plain');
}
