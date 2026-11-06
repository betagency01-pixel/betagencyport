import { db } from '@/lib/db';
import { currentStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await currentStaff())) return new Response('Not signed in', { status: 401 });
  const rows = (await db().query(`select created_at, status, name, brand, phone, email, services, about, has_site, site, budget, timeline, city, region, country, source, device, slip from enquiries order by created_at desc`)).rows;
  const cols = ['created_at', 'status', 'name', 'brand', 'phone', 'email', 'services', 'about', 'has_site', 'site', 'budget', 'timeline', 'city', 'region', 'country', 'source', 'device', 'slip'];
  const cell = v => {
    let s = v == null ? '' : Array.isArray(v) ? v.join('; ') : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheet formulas
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n');
  return new Response(csv, { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="bet-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
  } });
}
