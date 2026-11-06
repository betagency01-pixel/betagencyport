import { siteUrl, text } from '@/lib/site';
export const dynamic = 'force-dynamic';

const PAGES = [
  { path: '/', freq: 'weekly', priority: '1.0' },
  { path: '/privacy', freq: 'yearly', priority: '0.3' },
];

export function GET(req) {
  const site = siteUrl(req);
  const today = new Date().toISOString().slice(0, 10);
  const urls = PAGES.map(p => `  <url><loc>${site}${p.path}</loc><lastmod>${today}</lastmod><changefreq>${p.freq}</changefreq><priority>${p.priority}</priority></url>`).join('\n');
  return text(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, 'application/xml');
}
