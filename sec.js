// Security checks against the running dashboard (after e2e.js has created Odil (owner) and Allan (staff)).
const { chromium } = require('playwright');
const D = 'http://localhost:3001';
const out = [];
const check = (name, pass, extra = '') => out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);

async function login(b, email, pw, xff) {
  const c = await b.newContext({ extraHTTPHeaders: xff ? { 'x-forwarded-for': xff } : {} });
  const p = await c.newPage();
  await p.goto(D + '/login'); await p.fill('#email', email); await p.fill('#password', pw);
  await Promise.all([p.waitForLoadState('networkidle'), p.click('button[type=submit]')]);
  await p.waitForTimeout(300);
  return { c, p };
}
const signedIn = async c => { const r = await c.request.get(D + '/api/export', { maxRedirects: 0 }); return r.status() === 200; };

(async () => {
  const b = await chromium.launch();

  // 10. Log out really logs out: copy the cookie, sign out, replay the old cookie.
  const a = await login(b, 'allan@betagency.co', 'TeamMember12345', '10.0.0.1');
  check('staff can sign in', await signedIn(a.c));
  const stolen = (await a.c.cookies()).find(x => x.name === 'bet_staff');
  await a.p.goto(D + '/'); await Promise.all([a.p.waitForLoadState('networkidle'), a.p.click('.me button')]);
  const replay = await b.newContext(); await replay.addCookies([stolen]);
  check('10. old cookie is useless after sign out', !(await signedIn(replay)));
  check('    cookie is httpOnly', stolen.httpOnly === true);

  // 13. Removing a user cuts access immediately.
  const a2 = await login(b, 'allan@betagency.co', 'TeamMember12345', '10.0.0.2');
  const o = await login(b, 'odil@betagency.co', 'SuperSecret123', '10.0.0.3');
  check('owner can sign in', await signedIn(o.c));
  await o.p.goto(D + '/team');
  await o.p.click('a.btn.danger');                              // "Remove access" asks first
  await o.p.waitForLoadState('networkidle');
  check('17. removing asks for confirmation first', (await o.p.textContent('body')).includes('Yes, remove') && await signedIn(a2.c));
  await Promise.all([o.p.waitForURL(/ok=removed/), o.p.click('button:has-text("Yes, remove")')]);
  check('13. removed teammate is cut off on their very next click', !(await signedIn(a2.c)));
  const a3 = await login(b, 'allan@betagency.co', 'TeamMember12345', '10.0.0.4');
  check('13. removed teammate cannot sign back in', !(await signedIn(a3.c)));
  await o.p.goto(D + '/team');
  await Promise.all([o.p.waitForLoadState('networkidle'), o.p.click('button:has-text("Restore access")')]);
  const a4 = await login(b, 'allan@betagency.co', 'TeamMember12345', '10.0.0.5');
  check('17. removal can be undone (restore access)', await signedIn(a4.c));

  // Password reset by owner signs them out everywhere.
  await o.p.goto(D + '/team');
  await o.p.fill('input[name=password][placeholder="New password"]', 'BrandNewPass123');
  await Promise.all([o.p.waitForLoadState('networkidle'), o.p.click('button:has-text("Reset")')]);
  check('password reset signs that person out everywhere', !(await signedIn(a4.c)));

  // 18. Two people editing the same enquiry.
  await o.p.goto(D + '/enquiries'); await o.p.click('a.row >> nth=0'); await o.p.waitForLoadState('networkidle');
  const url = o.p.url().split('?')[0];
  const o2 = await login(b, 'odil@betagency.co', 'SuperSecret123', '10.4.0.1'); // second tab / second person
  await o2.p.goto(url);
  await o.p.selectOption('#status', 'in_talks'); await Promise.all([o.p.waitForLoadState('networkidle'), o.p.click('form:has(#status) button[type=submit]')]);
  await o2.p.selectOption('#status', 'lost'); await Promise.all([o2.p.waitForLoadState('networkidle'), o2.p.click('form:has(#status) button[type=submit]')]);
  const warned = (await o2.p.textContent('body')).includes('A teammate changed this');
  const stage = await o2.p.$eval('#status', s => s.value);
  check('18. second save is stopped with a warning, first change kept', warned && stage === 'in_talks', 'stage now ' + stage);

  // 14. Same message for unknown email and wrong password.
  const u = await login(b, 'nobody@nowhere.com', 'whatever123', '10.0.0.6');
  const msgUnknown = await u.p.textContent('.err');
  const w = await login(b, 'odil@betagency.co', 'wrongpassword', '10.0.0.7');
  const msgWrong = await w.p.textContent('.err');
  check('14. same error for unknown email and wrong password', msgUnknown === msgWrong, msgWrong);

  // 11. Many wrong passwords slow the attacker down (tested from different IPs, so it's per account).
  let locked = false;
  for (let i = 0; i < 9; i++) {
    const t = await login(b, 'odil@betagency.co', 'guess' + i, '10.1.0.' + i);
    if ((await t.p.textContent('body')).includes('Too many attempts')) { locked = true; await t.c.close(); break; }
    await t.c.close();
  }
  const right = await login(b, 'odil@betagency.co', 'SuperSecret123', '10.2.0.1');
  check('11. account locks after repeated wrong passwords, even with the right one', locked && !(await signedIn(right.c)));
  let lockedFake = false;
  for (let i = 0; i < 9; i++) {
    const t = await login(b, 'ghost@nowhere.com', 'guess' + i, '10.3.0.' + i);
    if ((await t.p.textContent('body')).includes('Too many attempts')) { lockedFake = true; await t.c.close(); break; }
    await t.c.close();
  }
  check('14. lockout also happens for emails with no account (no hint)', lockedFake);
  check('11. the owner session already open still works', await signedIn(o.c));

  // 9. One email can't make two accounts, whatever the capitals.
  await o.p.goto(D + '/team');
  await o.p.fill('#n', 'Allan Two'); await o.p.fill('#em', 'ALLAN@BetAgency.co'); await o.p.fill('#pw', 'AnotherPass123');
  await Promise.all([o.p.waitForLoadState('networkidle'), o.p.click('form:has(#n) button[type=submit]')]);
  check('9. same email in different capitals is refused', (await o.p.textContent('body')).includes('already uses that email'));

  // 6. Locked, not hidden: every dashboard page sends signed-out people to login.
  const anon = await b.newContext();
  for (const path of ['/', '/enquiries', '/visitors', '/team', url.replace(D, '')]) {
    const p = await anon.newPage(); await p.goto(D + path);
    check(`6. ${path} needs sign-in`, p.url().startsWith(D + '/login')); await p.close();
  }
  const setup = await anon.newPage(); await setup.goto(D + '/setup');
  check('6. /setup is closed once an owner exists', setup.url().startsWith(D + '/login'));

  // Headers
  const h = (await anon.request.get(D + '/login')).headers();
  check('7. HTTPS-only header on dashboard', !!h['strict-transport-security']);
  check('   dashboard hidden from Google', (h['x-robots-tag'] || '').includes('noindex'));
  const wh = (await anon.request.get('http://localhost:3000/')).headers();
  check('7. HTTPS-only header on website', !!wh['strict-transport-security']);

  // 2. No secret files served
  for (const f of ['/.env', '/.env.local', '/.env.example', '/package.json', '/next.config.mjs']) {
    const s1 = (await anon.request.get('http://localhost:3000' + f)).status(), s2 = (await anon.request.get(D + f)).status();
    check(`2. ${f} not served`, s1 === 404 && s2 === 404, `${s1}/${s2}`);
  }
  // 1. No keys in what the browser downloads
  const html = await (await anon.request.get('http://localhost:3000/')).text();
  const js = await (await anon.request.get('http://localhost:3000/bet.js')).text();
  check('1. no API keys or database address in website code', !/re_[A-Za-z0-9]{10,}|postgres(ql)?:\/\/|SESSION_SECRET|RESEND_API_KEY|sk_live|eyJhbGci/.test(html + js));

  // Enquiry API abuse limits
  const big = await anon.request.post('http://localhost:3000/api/enquiry', { data: { name: 'x'.repeat(30000) } });
  check('   oversized enquiry rejected', big.status() === 413, String(big.status()));
  let spam = 0;
  for (let i = 0; i < 5; i++) {
    const r = await anon.request.post('http://localhost:3000/api/enquiry', { headers: { 'x-forwarded-for': '10.9.0.' + i }, data: { name: 'Spam', email: 'spam@x.com', phone: '9999999999' } });
    if (r.status() === 429) spam++;
  }
  check('   repeat enquiries from one email are capped', spam >= 2, `${spam} of 5 refused`);

  console.log(out.join('\n'));
  console.log(out.filter(x => x.startsWith('FAIL')).length ? 'SOME FAILED' : 'ALL PASSED');
  await b.close();
})();
