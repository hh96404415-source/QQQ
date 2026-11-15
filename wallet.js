/* ──────────────────────────────────────────────────────────────
   wallet.js — 金幣錢包 ＋ 時間卷商店 ＋ 倒數
   ──────────────────────────────────────────────────────────────
   後端合約（GAS-V2-Code.gs）：
   · myStatus(user_id) → { coins, today_minutes, today_cap,
                            session:{ mode:'free'|'study', expire_ms, remaining_sec } }
   · redeem(user_id, minutes, request_id) → 扣金幣、開 session（即換即計時）
   規則：
   · 只有「真實登入」（User_ID 是數字）才有錢包；示範帳號不顯示。
   · 倒數以伺服器 now_ms 為基準做本機 tick，換裝置/刷新都正確。
   · 面額 15/30/60 分鐘 = 75/150/300 金幣（匯率 5 金幣 = 1 分鐘，讀後端）。
   ────────────────────────────────────────────────────────────── */
(function () {
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbydbycnfQsKkirktxFhKOB9p847SlW3e7Jd8oudLykEgkh_zp4ATPde4XIc476JcWNl/exec';
  var TOKEN = 'IidSHWtXoAU4RfyDZrlhYeTQq6gxFm5j7JkuVwGC';
  var FACE = [15, 30, 60];

  function cfg() {
    var o = {};
    try { o = JSON.parse(localStorage.getItem('dsh_qa') || '{}') || {}; } catch (e) {}
    var token = (o.token && o.token !== 'CHANGE_ME_TO_A_RANDOM_LONG_STRING') ? o.token : TOKEN;
    return { url: o.url || GAS_URL, token: token };
  }

  function post(body, cb) {
    var c = cfg();
    body.token = c.token;
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

  /* ── HUD（金幣＋倒數＋商店）────────────────────────────────── */
  function mount(host) {
    if (!host || document.getElementById('walletChip')) return null;
    if (!isReal()) return null;   // 示範帳號不顯示錢包

    var wrap = document.createElement('div');
    wrap.id = 'walletChip';
    wrap.className = 'walletChip';
    wrap.innerHTML =
      '<button class="wStore" id="wStore" title="用金幣換時間卷">🎁</button>' +
      '<span class="wCoin" id="wCoin">💰 <b>—</b></span>' +
      '<span class="wClock" id="wClock">⏱ —</span>';
    host.appendChild(wrap);

    installStyles();

    var coinEl = document.getElementById('wCoin').querySelector('b');
    var clockEl = document.getElementById('wClock');
    var storeBtn = document.getElementById('wStore');

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

    function tick() {
      paintClock();
    }

    function refresh(cb) {
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

    storeBtn.addEventListener('click', function () { openStore(); });

    refresh();
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(tick, 1000);
    // 每 30 秒重新同步一次（撈新賺的金幣／新的 session）
    setInterval(function () { refresh(); }, 30000);

    function openStore() {
      closeStore();
      var m = document.createElement('div');
      m.id = 'wStoreMask';
      m.className = 'wStoreMask';
      m.innerHTML =
        '<div class="wStoreBox">' +
          '<div class="wStoreHead">🎁 時間卷商店<button class="wStoreX" id="wStoreX">✕</button></div>' +
          '<div class="wStoreBal">你現在有 <b id="wStoreBal">—</b> 金幣</div>' +
          '<div class="wStoreHint">換了立刻開始倒數，時間用完自動回到學習模式</div>' +
          '<div class="wStoreGrid">' +
            FACE.map(function (m) {
              return '<button class="wStoreBtn" data-min="' + m + '">' +
                '<span class="wsMin">' + m + ' 分鐘</span>' +
                '<span class="wsCost">' + (m * 5) + ' 金幣</span></button>';
            }).join('') +
          '</div>' +
          '<div class="wStoreMsg" id="wStoreMsg"></div>' +
        '</div>';
      document.body.appendChild(m);
      document.getElementById('wStoreX').addEventListener('click', closeStore);
      m.addEventListener('click', function (e) { if (e.target === m) closeStore(); });

      status(function (err, st) {
        if (err) return;
        document.getElementById('wStoreBal').textContent = String(st.coins == null ? 0 : st.coins);
      });

      var btns = m.querySelectorAll('.wStoreBtn');
      for (var i = 0; i < btns.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var min = Number(btn.getAttribute('data-min'));
            var msg = document.getElementById('wStoreMsg');
            btn.disabled = true;
            msg.textContent = '兌換中…';
            redeem(min, function (err, d) {
              if (err) { msg.textContent = String(err); btn.disabled = false; return; }
              if (!d || !d.ok) {
                msg.textContent = (d && d.error) || '兌換失敗';
                btn.disabled = false;
                return;
              }
              // 成功：直接用回傳更新 HUD，並關掉商店
              coinEl.textContent = String(d.coins == null ? 0 : d.coins);
              if (d.start_ms) serverOffset = Number(d.start_ms) - Date.now();
              expireMs = d.expire_ms || 0;
              paintClock();
              msg.textContent = '✅ 已兌換 ' + d.minutes + ' 分鐘！開始倒數。';
              setTimeout(closeStore, 700);
            });
          });
        })(btns[i]);
      }
    }

    function closeStore() {
      var m = document.getElementById('wStoreMask');
      if (m) m.parentNode.removeChild(m);
    }

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
      '.walletChip .wClock.study{color:#94a3b8}',
      '.walletChip .wStore{width:34px;height:34px;border-radius:12px;border:1px solid rgba(255,255,255,.16);',
      '  background:rgba(15,23,42,.74);color:#fde047;font-size:17px;cursor:pointer;line-height:1}',
      '.walletChip .wStore:active{transform:scale(.92)}',
      /* 商店 modal */
      '.wStoreMask{position:fixed;inset:0;z-index:200;background:rgba(5,9,16,.72);',
      '  display:flex;align-items:center;justify-content:center;padding:20px}',
      '.wStoreBox{width:min(430px,100%);background:#0f172a;border:2px solid rgba(255,255,255,.14);',
      '  border-radius:20px;padding:20px}',
      '.wStoreHead{display:flex;align-items:center;justify-content:space-between;',
      '  font-size:20px;font-weight:900;color:#fde047}',
      '.wStoreX{border:0;background:rgba(255,255,255,.08);color:#cbd5e1;border-radius:10px;',
      '  padding:6px 12px;font-family:inherit;font-weight:900;cursor:pointer}',
      '.wStoreBal{margin-top:10px;font-size:15px;color:#cbd5e1}',
      '.wStoreBal b{color:#fbbf24;font-size:20px}',
      '.wStoreHint{margin-top:6px;font-size:12.5px;color:#64748b;line-height:1.6}',
      '.wStoreGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}',
      '.wStoreBtn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 6px;',
      '  border-radius:16px;border:2px solid rgba(255,255,255,.14);background:rgba(30,41,59,.9);',
      '  cursor:pointer;font-family:inherit;color:#e2e8f0}',
      '.wStoreBtn .wsMin{font-size:17px;font-weight:900;color:#fbbf24}',
      '.wStoreBtn .wsCost{font-size:12px;font-weight:800;color:#94a3b8}',
      '.wStoreBtn:active{transform:scale(.95)}',
      '.wStoreBtn:disabled{opacity:.5}',
      '.wStoreMsg{min-height:20px;margin-top:14px;font-size:13.5px;font-weight:800;color:#86efac;text-align:center}'
    ].join('');
    document.head.appendChild(s);
  }

  window.Wallet = {
    status: status,
    redeem: redeem,
    mount: mount,
    uid: uid,
    isReal: isReal,
    fmt: fmt
  };
})();
