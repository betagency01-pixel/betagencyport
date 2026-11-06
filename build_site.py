"""Builds web/public/index.html (production page) from the designed preview page.
Usage: python3 build_site.py <preview index.html> <out index.html>"""
import sys
src, out = sys.argv[1], sys.argv[2]
SITE = (sys.argv[3] if len(sys.argv) > 3 else 'https://betagency.co').rstrip('/')
import json, re, html as H
s = open(src, encoding='utf-8').read()

def rep(a, b):
    global s
    assert a in s, 'missing: ' + a[:90]
    s = s.replace(a, b, 1)

def between(a, b, new):
    global s
    i = s.index(a); j = s.index(b, i); s = s[:i] + new + s[j:]

# ---- head ----
style_i = s.index('<style>')
head_bits = s[:style_i]
style_j = s.index('</style>') + len('</style>')
style = s[style_i:style_j]
body = s[style_j:]

# ---- structured data (built from the page itself, so it always matches what visitors see) ----
faq = []
for q, a in re.findall(r'<summary><span class="n">\d+</span><span class="q">(.*?)</span>.*?<div class="ans"><p>(.*?)</p></div>', body, re.S):
    faq.append({"@type": "Question", "name": H.unescape(q), "acceptedAnswer": {"@type": "Answer", "text": H.unescape(re.sub('<[^>]+>', '', a))}})
assert len(faq) >= 5, 'FAQ not found'
SERVICES = [("Website development", "Premium websites and landing pages, designed and coded from scratch."),
            ("CRM development", "Custom CRMs that track every lead and customer."),
            ("Sanity CMS integration", "Edit your own site without touching code."),
            ("Business automation", "Follow-ups, notifications and workflows that run on their own."),
            ("Custom web apps", "Portals, booking systems and platforms.")]
ORG = SITE + '/#org'
graph = [
  {"@type": ["Organization", "ProfessionalService"], "@id": ORG, "name": "BeT Agency Co.", "alternateName": ["BET Agency", "BeT Agency"],
   "url": SITE + "/", "logo": SITE + "/favicon.svg", "image": SITE + "/ebdcafe-poster.jpg", "slogan": "You can always bet on us.",
   "description": "Premium digital solutions studio: websites, landing pages, custom CRM, Sanity CMS, business automation and custom web apps, crafted from scratch for brands that mean business.",
   "email": "bet.agency01@gmail.com", "areaServed": "IN", "sameAs": ["https://www.instagram.com/betagency.co/"],
   "knowsAbout": ["Website development", "Landing pages", "CRM development", "Sanity CMS", "Business automation", "Web applications"],
   "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Services", "itemListElement": [
       {"@type": "Offer", "itemOffered": {"@type": "Service", "name": n, "description": d, "provider": {"@id": ORG}}} for n, d in SERVICES]}},
  {"@type": "WebSite", "@id": SITE + "/#site", "url": SITE + "/", "name": "BeT Agency Co.", "publisher": {"@id": ORG}, "inLanguage": "en-IN"},
  {"@type": "FAQPage", "@id": SITE + "/#faq", "mainEntity": faq},
  {"@type": "CreativeWork", "name": "EBD Café landing page", "url": "https://ebdcafe.com", "creator": {"@id": ORG}},
]
LD = '<script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace('</', '<\\/') + '</script>'
head_bits = head_bits.replace('<title>BET Agency</title>', '<title>BeT Agency Co. | Websites, CRM, CMS and automation</title>')
head_bits = head_bits.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
''' + head_bits + '''<meta name="theme-color" content="#3B2BFF">
<meta property="og:type" content="website">
<meta property="og:site_name" content="BeT Agency Co.">
<meta property="og:title" content="BeT Agency Co. | You can always bet on us">
<meta property="og:description" content="Premium websites, custom CRMs, Sanity CMS and automation, crafted from scratch for brands that mean business.">
<meta property="og:image" content="''' + SITE + '''/ebdcafe-poster.jpg">
<meta property="og:url" content="''' + SITE + '''/">
<link rel="canonical" href="''' + SITE + '''/">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="twitter:title" content="BeT Agency Co. | You can always bet on us">
<meta name="twitter:description" content="Premium websites, custom CRMs, Sanity CMS and automation, crafted from scratch for brands that mean business.">
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
''' + LD + '''
''' + style + '''
<style>
[hidden]{display:none!important}
html.ck-open .fab{opacity:0;pointer-events:none}
.foot-bot button{background:none;border:0;padding:0;color:inherit;font:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.foot-bot a{color:inherit}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
</style>
<script src="/bet.js" defer></script>
</head>
<body>
'''
s = HEAD + body.lstrip('\n') + '\n</body>\n</html>\n'

# ---- enquiry: send to our own API ----
between("  /* runtime capabilities (null when not available, e.g. opened as a plain file) */", "  function mailFor(p){", r'''  const slipNo = $('#slipNo').textContent.replace('No. ', '');
  function collect(){
    return {
      name: val('e-name'), phone: val('e-phone') ? $('#e-cc').value + ' ' + val('e-phone') : '',
      services: data.services.slice(), about: $('#e-about').value.trim(), brand: val('e-brand'),
      email: val('e-email'), hasSite: data.has, site: data.has === 'Yes' ? val('e-site') : '',
      budget: data.budget, timeline: data.time, slip: slipNo, website: $('#e-hp').value
    };
  }
  async function saveEnquiry(p){
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ sid: window.betSession ? window.betSession() : null }, p)), signal: ctl.signal });
      clearTimeout(t);
      return r.ok;
    } catch (e){ return false; }
  }
''')
rep("    const ok = await saveEnquiry(p);", "    const ok = await saveEnquiry(p);\n    if (ok) track('enquiry_submit', { services: p.services.join(', '), budget: p.budget });")
rep("      $('#doneMsg').textContent = \"One last tap: we couldn't save it from this browser, so send your slip to us by email and it lands straight in our inbox.\";",
    "      $('#doneMsg').textContent = \"Our line dropped for a second. Tap below to send your slip by email and it lands straight in our inbox.\";")
# honeypot field
rep('<input id="e-name" autocomplete="given-name" placeholder="Your name" aria-label="Your name">',
    '<input id="e-name" autocomplete="given-name" placeholder="Your name" aria-label="Your name"><input id="e-hp" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">')

# ---- tracking hooks ----
rep("  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));",
    "  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));\n  const track = (n, d, once) => { try { window.betTrack && window.betTrack(n, d, once); } catch (_) {} };")
rep("$$('.pcard').forEach(card => $$('.face', card).forEach(f => f.addEventListener('click', () => card.classList.toggle('flipped'))));",
    "$$('.pcard').forEach(card => $$('.face', card).forEach(f => f.addEventListener('click', () => { const on = card.classList.toggle('flipped'); if (on) track('card_flip', { service: $('.front h3', card).textContent }, true); })));")
rep("  function magic(){", "  function magic(){\n    track('coin_magic', null, true);")
rep("  function setVibe(i){", "  function setVibe(i){\n    if (i !== vi) track('vibe_change', { vibe: vibes[i][0] }, true);")
rep("o.drag = true; o.el.classList.add('dragging');", "o.drag = true; o.el.classList.add('dragging'); track('chip_throw', null, true);")
rep("  function openEnq(){", "  function openEnq(){\n    track('enquiry_open', null, true);")
rep("  function show(n){", "  function show(n){\n    if (n > 1 && n < 8) track('enquiry_step', { step: n }, true);")
rep("  function openT(){", "  function openT(){ track('testimonial_open', null, true);")
rep("  $('#lockIn').addEventListener('click', () => {", "  $('#lockIn').addEventListener('click', () => {\n    track('stack_lock', { services: sbOpts.filter(o => o.getAttribute('aria-pressed') === 'true').map(o => o.dataset.v).join(', ') });")
rep("  $('#copyMail').addEventListener('click', e => {", r'''  $$('a[href^="https://ebdcafe.com"]').forEach(a => a.addEventListener('click', () => track('ebd_visit', null, true)));
  $$('a[href*="instagram.com"]').forEach(a => a.addEventListener('click', () => track('instagram_click', null, true)));
  $$('[data-enquire]').forEach(b => b.addEventListener('click', () => track('cta_click', { label: (b.getAttribute('aria-label') || b.textContent).replace(/[→↗]/g, '').trim().slice(0, 40) })));
  if ('IntersectionObserver' in window){
    const names = { hero:'Hero', services:'Services', work:'Work', mani:'What we build', about:'Conversation first', process:'Process', stack:'Stack builder', faq:'FAQ', enquire:'Enquiry band' };
    const sio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting){ track('section_view', { section: names[e.target.id] || e.target.id }, true); sio.unobserve(e.target); } }), { threshold: .35 });
    Object.keys(names).forEach(id => { const el = document.getElementById(id); if (el) sio.observe(el); });
  }
  $$('.qa details').forEach(d => d.addEventListener('toggle', () => { if (d.open) track('faq_open', { question: $('.q', d).textContent.slice(0, 80) }); }));
  $('#copyMail').addEventListener('click', e => {
    track('email_copy', null, true);''')

# ---- footer: privacy + cookie settings ----
rep('<div class="foot-bot"><span>© 2026 BeT Agency Co. All rights reserved.</span><span>Made with intent.</span></div>',
    '<div class="foot-bot"><span>© <span id="yr">2026</span> BeT Agency Co. All rights reserved.</span><span><a href="/privacy">Privacy</a> · <button type="button" onclick="window.betCookieSettings &amp;&amp; betCookieSettings()">Cookie settings</button></span></div>')
rep("  $('#copyMail').addEventListener", "  $('#yr').textContent = new Date().getFullYear();\n  $('#copyMail').addEventListener")

assert 'claude.use' not in s
open(out, 'w', encoding='utf-8').write(s)
print('ok', len(s))
