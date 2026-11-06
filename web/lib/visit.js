// Helpers that turn a request into visit details: location, device, traffic source.
// Location comes from the hosting platform's edge headers (Vercel, Cloudflare, Netlify).
// The visitor's IP address is never stored.

const dec = v => { try { return v ? decodeURIComponent(v) : null; } catch { return v || null; } };
const clip = (v, n = 200) => (v == null ? null : String(v).slice(0, n));

const COUNTRY = new Intl.DisplayNames(['en'], { type: 'region' });
export function countryName(code) {
  if (!code || code.length !== 2) return code || null;
  try { return COUNTRY.of(code.toUpperCase()); } catch { return code; }
}

export function geo(req) {
  const h = req.headers;
  let country = h.get('x-vercel-ip-country') || h.get('cf-ipcountry') || null;
  let region = dec(h.get('x-vercel-ip-country-region')) || dec(h.get('cf-region')) || null;
  let city = dec(h.get('x-vercel-ip-city')) || dec(h.get('cf-ipcity')) || null;
  const nf = h.get('x-nf-geo');
  if (!country && nf) {
    try { const j = JSON.parse(Buffer.from(nf, 'base64').toString()); country = j.country?.code; region = j.subdivision?.name; city = j.city; } catch {}
  }
  if (country === 'XX' || country === 'T1') country = null;
  return { country: country ? countryName(country) : null, region: clip(region, 80), city: clip(city, 80) };
}

export function device(ua = '') {
  const u = ua.toLowerCase();
  const isTablet = /ipad|tablet|(android(?!.*mobile))/.test(u);
  const isMobile = !isTablet && /mobi|iphone|android/.test(u);
  const browser = /edg\//.test(u) ? 'Edge' : /opr\/|opera/.test(u) ? 'Opera' : /samsungbrowser/.test(u) ? 'Samsung Internet'
    : /chrome|crios/.test(u) ? 'Chrome' : /firefox|fxios/.test(u) ? 'Firefox' : /safari/.test(u) ? 'Safari' : 'Other';
  const os = /windows/.test(u) ? 'Windows' : /iphone|ipad|ios/.test(u) ? 'iOS' : /android/.test(u) ? 'Android'
    : /mac os|macintosh/.test(u) ? 'macOS' : /linux/.test(u) ? 'Linux' : 'Other';
  return { device: isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop', browser, os };
}

export const isBot = (ua = '') => !ua || /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp|monitor|curl|wget|python|axios|node-fetch/i.test(ua);

const SOURCES = [
  [/(^|\.)google\./, 'Google'], [/(^|\.)bing\.com$/, 'Bing'], [/duckduckgo\.com$/, 'DuckDuckGo'], [/(^|\.)yahoo\./, 'Yahoo'],
  [/instagram\.com$/, 'Instagram'], [/(^|\.)facebook\.com$|^fb\.me$|^m\.facebook/, 'Facebook'], [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, 'X'],
  [/linkedin\.com$|^lnkd\.in$/, 'LinkedIn'], [/youtube\.com$|^youtu\.be$/, 'YouTube'], [/whatsapp\.com$|^wa\.me$/, 'WhatsApp'],
  [/chatgpt\.com$|openai\.com$/, 'ChatGPT'], [/perplexity\.ai$/, 'Perplexity'], [/claude\.ai$/, 'Claude'], [/gemini\.google\.com$/, 'Gemini'],
  [/reddit\.com$/, 'Reddit'], [/pinterest\./, 'Pinterest'], [/behance\.net$/, 'Behance'], [/dribbble\.com$/, 'Dribbble'], [/ebdcafe\.com$/, 'EBD Café site'],
];
export function trafficSource({ referrer, utmSource, utmMedium, utmCampaign, ownHost }) {
  let host = null;
  try { host = referrer ? new URL(referrer).hostname.replace(/^www\./, '') : null; } catch {}
  if (host && ownHost && host === ownHost.replace(/^www\./, '')) host = null;
  let source = null;
  if (utmSource) {
    const s = String(utmSource).toLowerCase();
    source = (SOURCES.find(([re]) => re.test(s + '.com')) || [])[1] || clip(utmSource, 60);
  } else if (host) source = (SOURCES.find(([re]) => re.test(host)) || [])[1] || host;
  else source = 'Direct';
  return { source, medium: clip(utmMedium, 60) || (host ? 'referral' : utmSource ? null : 'none'), campaign: clip(utmCampaign, 80), referrer: host };
}

export { clip };
