/* BeT Agency Co. — first-party analytics + cookie consent.
   No third-party trackers. Without consent we only count an anonymous visit (no cookie, no stored id).
   With consent a random visitor id cookie (bet_vid, 1 year) lets us recognise returning visitors. */
(function () {
  var ENDPOINT = '/api/track';
  var CK = 'bet_consent', VID = 'bet_vid';

  function getCookie(n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : null; }
  function setCookie(n, v, days) {
    var exp = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = n + '=' + encodeURIComponent(v) + '; expires=' + exp + '; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }
  function delCookie(n) { document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; }
  function rid() {
    var a = new Uint8Array(12); (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  var consent = getCookie(CK) === 'yes';
  var sid = null;
  try { sid = consent ? sessionStorage.getItem('bet_sid') : null; } catch (e) {}
  if (!sid) { sid = rid(); if (consent) try { sessionStorage.setItem('bet_sid', sid); } catch (e) {} }
  var vid = consent ? (getCookie(VID) || (function () { var v = rid(); setCookie(VID, v, 365); return v; })()) : null;

  function send(body) {
    body.sid = sid; body.consent = consent; if (vid) body.vid = vid;
    var s = JSON.stringify(body);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([s], { type: 'text/plain' }))) return;
    } catch (e) {}
    try { fetch(ENDPOINT, { method: 'POST', body: s, keepalive: true, headers: { 'Content-Type': 'text/plain' } }); } catch (e) {}
  }

  function pageview() {
    var q = new URLSearchParams(location.search);
    send({ t: 'pv', path: location.pathname, ref: document.referrer || '', us: q.get('utm_source'), um: q.get('utm_medium'), uc: q.get('utm_campaign'),
      scr: screen.width + 'x' + screen.height, lang: navigator.language });
  }

  var sent = {};
  window.betTrack = function (name, data, once) {
    var key = name + (data ? JSON.stringify(data) : '');
    if (once && sent[key]) return; sent[key] = 1;
    send({ t: 'ev', name: name, path: location.pathname, data: data || null });
  };
  window.betSession = function () { return sid; };

  // time on site: ping while the tab is visible
  var pings = 0, timer = setInterval(function () {
    if (document.visibilityState === 'visible' && ++pings <= 240) send({ t: 'ping' });
  }, 15000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send({ t: 'ping' }); });

  /* ---------- cookie banner ---------- */
  var css = '.ckb{position:fixed;left:calc(env(safe-area-inset-left,0px) + 20px);bottom:calc(env(safe-area-inset-bottom,0px) + 20px);z-index:80;width:min(380px,calc(100vw - 40px));background:#14111F;color:#F3F0FF;border-radius:22px;padding:20px 20px 18px;box-shadow:0 30px 60px -20px rgba(0,0,0,.6),0 0 0 1px rgba(243,240,255,.12);font:15px/1.5 "Instrument Sans",system-ui,sans-serif;transform:translateY(20px);opacity:0;transition:transform .5s cubic-bezier(.2,1.2,.3,1),opacity .3s}'
    + '.ckb.on{transform:none;opacity:1}.ckb b{display:block;font-family:"Playfair Display",Georgia,serif;font-weight:900;font-size:22px;letter-spacing:-.02em;margin-bottom:6px}'
    + '.ckb p{margin:0;color:rgba(243,240,255,.72);font-size:14px}.ckb a{color:#F3F0FF}.ckb .r{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}'
    + '.ckb button{font:inherit;font-weight:700;font-size:14px;border-radius:999px;padding:10px 18px;cursor:pointer;border:1.5px solid #F3F0FF}'
    + '.ckb .y{background:#FFE14A;color:#14111F;border-color:#FFE14A}.ckb .n{background:transparent;color:#F3F0FF}'
    + '@media (max-width:620px){.ckb{left:12px;right:12px;width:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 12px)}}';
  function banner() {
    if (document.querySelector('.ckb')) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var el = document.createElement('div'); el.className = 'ckb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Cookie choice');
    el.innerHTML = '<b>A few cookies?</b><p>We use our own cookies to see which pages people like and where they come from. No ads, and we never sell your data. <a href="/privacy">Privacy</a></p>'
      + '<div class="r"><button type="button" class="y">Accept</button><button type="button" class="n">Only essentials</button></div>';
    document.body.appendChild(el);
    document.documentElement.classList.add('ck-open');
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
    function choose(yes) {
      setCookie(CK, yes ? 'yes' : 'no', 180);
      if (!yes) { delCookie(VID); try { sessionStorage.removeItem('bet_sid'); } catch (e) {} }
      el.classList.remove('on'); document.documentElement.classList.remove('ck-open');
      setTimeout(function () { el.remove(); }, 400);
      if (yes && !consent) {
        consent = true; vid = getCookie(VID) || (function () { var v = rid(); setCookie(VID, v, 365); return v; })();
        try { sessionStorage.setItem('bet_sid', sid); } catch (e) {}
        send({ t: 'consent' });
      } else if (!yes) { consent = false; vid = null; }
    }
    el.querySelector('.y').addEventListener('click', function () { choose(true); });
    el.querySelector('.n').addEventListener('click', function () { choose(false); });
  }
  window.betCookieSettings = function () { banner(); };

  pageview();
  if (!getCookie(CK)) setTimeout(banner, 1200);
})();
