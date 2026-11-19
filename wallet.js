/* ──────────────────────────────────────────────────────────────
   wallet.js — 金幣 HUD ＋ 倒數（時間卷商店已移到 🛒 星星商店）
   ──────────────────────────────────────────────────────────────
   後端合約（GAS-V2-Code.gs）：
   · myStatus(user_id) → { coins, today_minutes, today_cap,
                            session:{ mode:'free'|'study', expire_ms, remaining_sec } }
   · redeem(user_id, minutes, request_id) → 扣金幣、開 session（即換即計時）
   規則：
   · 只有「真實登入」（User_ID 是數字）才有錢包；示範帳號不顯示。
   · 倒數以伺服器 now_ms 為基準做本機 tick，換裝置/刷新都正確。
   · 面額 15/30/60 分鐘 = 75/150/300 金幣（匯率 5 金幣 = 1 分鐘）。
   · 兌換入口在「星星商店 → ⏱ 時間卷」那一頁。
   ────────────────────────────────────────────────────────────── */
(function () {
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbydbycnfQsKkirktxFhKOB9p847SlW3e7Jd8oudLykEgkh_zp4ATPde4XIc476JcWNl/exec';
  var FACE = [15, 30, 60];
  var COIN_PER_MIN = 5;

  var mountedRefresh = null;   // mount() 之後由它更新 HUD

  function cfg() {
    var o = {};
    try { o = JSON.parse(localStorage.getItem('dsh_qa') || '{}') || {}; } catch (e) {}
    return { url: o.url || GAS_URL };
  }

  function post(body, cb) {
    var c = cfg();
    fetch(c.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).then(function (r) { return r.json(); }).then(function (d) {
      cb(null, d);
    }).catch(function (e) { cb(e, null); });
  }

  function uid() {
    var b = (window.Player && Player.bound) ? Player.bound() : null;
    return b && b.id ? String(b.id) : '';
  }

  function isReal() {
    var b = (window.Player && Player.bound) ? Player.bound() : null;
    return !!(b && b.id && /^\d+$/.test(String(b.id)));
  }

  function status(cb) {
    var u = uid();
    if (!u) return cb('未登入');
    post({ action: 'myStatus', user_id: u }, function (err, d) {
      if (err) return cb(err);
      if (!d || !d.ok) return cb((d && d.error) || '連不上');
      cb(null, d);
    });
  }

  function redeem(minutes, cb) {
    var u = uid();
    if (!u) return cb('未登入');
    var rid = 'w' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    post({ action: 'redeem', user_id: u, minutes: minutes, request_id: rid }, function (err, d) {
      if (err) return cb(err);
      cb(null, d);
    });
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var mm = (h > 0 ? String(h) + ':' : '') + String(m).padStart(h > 0 ? 2 : 1, '0') + ':' + String(s).padStart(2, '0');
    return mm;
  }

  /* 兌換成功後，請 HUD 立刻同步（商店那頁也會自己更新） */
  function refresh(cb) {
    if (mountedRefresh) mountedRefresh(cb);
    else if (cb) cb(null, null);
  }

  /* ── HUD（金幣＋倒數）────────────────────────────────────── */
  function mount(host) {
    if (!host || document.getElementById('walletChip')) return null;
    if (!isReal()) return null;   // 示範帳號不顯示錢包

    var wrap = document.createElement('div');
    wrap.id = 'walletChip';
    wrap.className = 'walletChip';
    wrap.innerHTML =
      '<span class="wCoin" id="wCoin">💰 <b>—</b></span>' +
      '<span class="wClock" id="wClock">⏱ —</span>';
    host.appendChild(wrap);

    installStyles();

    var coinEl = document.getElementById('wCoin').querySelector('b');
    var clockEl = document.getElementById('wClock');

    var serverOffset = 0;   // 伺服器 now_ms - 本機 now
    var expireMs = 0;
    var tickTimer = null;

    function paintClock() {
      if (expireMs <= 0) {
        clockEl.textContent = '🔒 學習模式';
        clockEl.className = 'wClock study';
        return;
      }
      var now = Date.now() + serverOffset;
      var left = Math.max(0, Math.round((expireMs - now) / 1000));
      clockEl.textContent = '⏱ ' + fmt(left);
      clockEl.className = 'wClock free';
      if (left <= 0) { expireMs = 0; }
    }

    function refreshHud(cb) {
      status(function (err, st) {
        if (err) { cb && cb(err); return; }
        serverOffset = (st.now_ms || Date.now()) - Date.now();
        coinEl.textContent = String(st.coins == null ? 0 : st.coins);
        var ses = st.session || {};
        expireMs = (ses.mode === 'free' && ses.expire_ms) ? Number(ses.expire_ms) : 0;
        paintClock();
        cb && cb(null, st);
      });
    }
    mountedRefresh = refreshHud;

    refreshHud();
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(paintClock, 1000);
    // 每 30 秒重新同步一次（撈新賺的金幣／新的 session）
    setInterval(refreshHud, 30000);

    return wrap;
  }

  function installStyles() {
    if (document.getElementById('walletCss')) return;
    var s = document.createElement('style');
    s.id = 'walletCss';
    s.textContent = [
      '.walletChip{position:relative;display:inline-flex;align-items:center;gap:6px;font-family:inherit}',
      '.walletChip .wCoin,.walletChip .wClock{display:inline-flex;align-items:center;gap:4px;',
      '  padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.16);',
      '  background:rgba(15,23,42,.74);color:#e2e8f0;font-size:13px;font-weight:800;',
      '  user-select:none;white-space:nowrap}',
      '.walletChip .wCoin b{color:#fbbf24;font-size:14px}',
      '.walletChip .wClock.free{color:#86efac;border-color:rgba(134,239,172,.4)}',
      '.walletChip .wClock.study{color:#94a3b8}'
    ].join('');
    document.head.appendChild(s);
  }

  window.Wallet = {
    status: status,
    redeem: redeem,
    refresh: refresh,
    mount: mount,
    uid: uid,
    isReal: isReal,
    fmt: fmt,
    FACE: FACE,
    COIN_PER_MIN: COIN_PER_MIN
  };
})();
