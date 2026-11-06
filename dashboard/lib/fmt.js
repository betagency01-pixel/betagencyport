export const TZ = process.env.DASHBOARD_TZ || 'Asia/Kolkata';

export const STATUSES = [
  ['new', 'New'], ['contacted', 'Contacted'], ['in_talks', 'In talks'], ['won', 'Won'], ['lost', 'Lost'],
];
export const statusLabel = s => (STATUSES.find(x => x[0] === s) || [s, s])[1];

export const RANGES = { today: ['Today', '1 day'], '7d': ['7 days', '7 days'], '30d': ['30 days', '30 days'], '90d': ['90 days', '90 days'] };
export const range = r => (RANGES[r] ? r : '30d');

export const num = n => Number(n || 0).toLocaleString('en-IN');
export const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

export function dur(s) {
  s = Math.round(Number(s) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function when(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
export function ago(d) {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return when(d);
}
export const place = (city, country) => [city, country].filter(Boolean).join(', ') || 'Unknown';

const EVENT_LABELS = {
  pageview: 'Opened the site', section_view: 'Viewed section', card_flip: 'Flipped service card', coin_magic: 'Tapped the coin',
  vibe_change: 'Changed colour vibe', chip_throw: 'Threw a chip', testimonial_open: "Opened EBD Café owner's message",
  ebd_visit: 'Clicked through to ebdcafe.com', enquiry_open: 'Opened the enquiry form', enquiry_step: 'Reached enquiry step',
  enquiry_submit: 'Sent an enquiry', stack_pick: 'Picked a chip in stack builder', stack_lock: 'Locked in a stack',
  instagram_click: 'Clicked Instagram', email_copy: 'Copied email address', cta_click: 'Clicked', faq_open: 'Opened a question',
};
export function eventLabel(e) {
  const base = EVENT_LABELS[e.name || e.type] || e.name || e.type;
  const d = e.data || {};
  const extra = d.section || d.service || d.vibe || d.label || d.question || (d.step ? `${d.step} of 7` : '') || d.services || '';
  return extra ? `${base}: ${extra}` : base;
}
