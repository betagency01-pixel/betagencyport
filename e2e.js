// End-to-end check: visitors browse the site, one sends an enquiry, owner signs in to the dashboard.
const { chromium } = require('playwright');
const OUT = __dirname + '/shots/';
require('fs').mkdirSync(OUT, { recursive: true });
const visitors = [
  { geo: { 'x-vercel-ip-country': 'IN', 'x-vercel-ip-city': 'Chennai', 'x-vercel-ip-country-region': 'TN' }, ref: 'https://www.instagram.com/', mobile: true, accept: true, enquire: true },
  { geo: { 'x-vercel-ip-country': 'IN', 'x-vercel-ip-city': 'Bengaluru', 'x-vercel-ip-country-region': 'KA' }, ref: 'https://www.google.com/', accept: true },
  { geo: { 'x-vercel-ip-country': 'AE', 'x-vercel-ip-city': 'Dubai' }, ref: '', accept: false },
  { geo: { 'x-vercel-ip-country': 'IN', 'x-vercel-ip-city': 'Mumbai', 'x-vercel-ip-country-region': 'MH' }, ref: 'https://chatgpt.com/', accept: true },
];
(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const [i, v] of visitors.entries()) {
    const ctx = await b.newContext({
      extraHTTPHeaders: v.ref ? { ...v.geo, referer: v.ref } : v.geo,
      viewport: v.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      userAgent: v.mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`visitor${i}: ${e.message}`));
    await p.goto('http://localhost:3000/', { waitUntil: 'load' });
    await p.waitForSelector('.ckb.on', { timeout: 5000 });
    if (i === 0) await p.screenshot({ path: OUT + 'site-cookie-banner.png' });
    await p.click(v.accept ? '.ckb .y' : '.ckb .n');
    await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById('services').scrollIntoView());
    await p.waitForTimeout(700);
    await p.click('.pcard:nth-child(2) .front', { force: true });
    await p.evaluate(() => document.getElementById('work').scrollIntoView());
    await p.waitForTimeout(500);
    await p.evaluate(() => document.getElementById('faq').scrollIntoView());
    await p.waitForTimeout(500);
    await p.click('.qa details:nth-child(3) summary');
    if (i === 1) await p.screenshot({ path: OUT + 'site-faq.png' });
    await p.waitForTimeout(700);
    if (v.enquire) {
      await p.click('#fab');
      await p.waitForTimeout(500);
      await p.fill('#e-name', 'Arjun Mehta'); await p.click('#go');
      await p.fill('#e-phone', '9876543210'); await p.click('#go');
      await p.click('#e-svc .choice[data-v="Website"]'); await p.click('#e-svc .choice[data-v="CRM"]'); await p.click('#go');
      await p.fill('#e-about', 'We run a premium bike detailing studio in Chennai and want a site that brings in high-end clients.'); await p.click('#go');
      await p.fill('#e-brand', 'Gloss Garage'); await p.click('#go');
      await p.fill('#e-email', 'arjun@glossgarage.in'); await p.click('#e-has .choice[data-v="No"]'); await p.click('#go');
      await p.click('#e-budget .choice >> nth=2'); await p.click('#e-time .choice >> nth=1'); await p.click('#go');
      await p.waitForSelector('.pane[data-step="8"].active', { timeout: 10000 });
      const msg = await p.textContent('#doneMsg');
      console.log('enquiry done message:', msg.trim().slice(0, 60), '| mail fallback hidden:', await p.$eval('#doneMail', e => e.hidden));
      await p.screenshot({ path: OUT + 'site-enquiry-done.png' });
    }
    await p.waitForTimeout(16000 * (i === 0 ? 1 : 0) + 500);
    await ctx.close();
  }

  // dashboard
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('dash: ' + e.message));
  await p.goto('http://localhost:3001/');
  console.log('dashboard unauth ->', p.url());
  await p.goto('http://localhost:3001/setup');
  await p.screenshot({ path: OUT + 'dash-setup.png' });
  await p.fill('#key', 'wrong'); await p.fill('#name', 'Odil'); await p.fill('#email', 'odil@betagency.co'); await p.fill('#password', 'SuperSecret123');
  await p.click('button[type=submit]'); await p.waitForLoadState('networkidle');
  console.log('wrong key ->', p.url());
  await p.fill('#key', 'test-setup-key'); await p.fill('#name', 'Odil'); await p.fill('#email', 'odil@betagency.co'); await p.fill('#password', 'SuperSecret123');
  await p.click('button[type=submit]'); await p.waitForURL('http://localhost:3001/');
  await p.goto('http://localhost:3001/?r=7d'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + 'dash-overview.png', fullPage: true });
  await p.goto('http://localhost:3001/enquiries');
  await p.screenshot({ path: OUT + 'dash-enquiries.png' });
  await p.click('a.row >> nth=0'); await p.waitForLoadState('networkidle');
  await p.selectOption('#status', 'contacted'); await p.click('form:has(#status) button[type=submit]'); await p.waitForLoadState('networkidle');
  await p.fill('textarea[name=body]', 'Called Arjun, sending a proposal on Friday.'); await p.click('form:has(textarea) button[type=submit]'); await p.waitForLoadState('networkidle');
  await p.screenshot({ path: OUT + 'dash-enquiry.png', fullPage: true });
  await p.goto('http://localhost:3001/visitors');
  await p.screenshot({ path: OUT + 'dash-visitors.png' });
  await p.goto('http://localhost:3001/team');
  await p.fill('#n', 'Allan'); await p.fill('#em', 'allan@betagency.co'); await p.fill('#pw', 'TeamMember12345');
  await p.click('form:has(#n) button[type=submit]'); await p.waitForLoadState('networkidle');
  await p.screenshot({ path: OUT + 'dash-team.png' });
  const csv = await p.evaluate(() => fetch('/api/export').then(r => r.text()));
  console.log('csv lines:', csv.trim().split('\n').length);
  // staff (non-owner) cannot manage team
  const c2 = await b.newContext(); const s2 = await c2.newPage();
  await s2.goto('http://localhost:3001/login'); await s2.fill('#email', 'allan@betagency.co'); await s2.fill('#password', 'TeamMember12345');
  await s2.click('button[type=submit]'); await s2.waitForURL('http://localhost:3001/');
  await s2.goto('http://localhost:3001/team');
  console.log('staff sees add form:', !!(await s2.$('#n')));
  const anon = await (await b.newContext()).request.get('http://localhost:3001/api/export');
  console.log('export without login:', anon.status());
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto('http://localhost:3001/'); await p.screenshot({ path: OUT + 'dash-mobile.png' });
  console.log('errors:', errors);
  await b.close();
})();
