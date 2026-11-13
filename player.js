/* ──────────────────────────────────────────────────────────────
   player.js — 兩個小朋友的示範資料包
   ──────────────────────────────────────────────────────────────
   為什麼要有這個檔：
   投資人要「先用小朋友身分玩一下，再用家長身分看一下」。
   所以同一個小朋友在四頁之間要有連貫的進度（星星、寵物、寫過的字、
   玩過的棋），而家長頁看到的就是他本人。

   做法（重要）：
   不去改每一頁原有的 localStorage key（`dsh_stars`、`dsh_pet`…），
   而是在切換小朋友時，把「當前這一位的所有 dsh_* 資料」整包存到
   `dsh__p_<id>`，再把另一位的那包載回原本的 key。
   這樣四頁一行都不用改，資料也不會互相污染。
   `dsh__` 開頭的 key（__cur、__p_*）本身不算玩家資料，不會被搬。
   ────────────────────────────────────────────────────────────── */
(function () {
  var CUR = 'dsh__cur';
  var PKG = 'dsh__p_';

  var PLAYERS = [
    { id: 'demo_a', name: '陳小明', pet: '火苗龍', tag: '穩定進步型', emoji: '🐲' },
    { id: 'demo_b', name: '李美欣', pet: '竹筍熊', tag: '卡關型', emoji: '🐣' }
  ];

  function isData(k) { return k.indexOf('dsh_') === 0 && k.indexOf('dsh__') !== 0; }

  function snapshot() {
    var o = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (isData(k)) o[k] = localStorage.getItem(k);
    }
    return o;
  }

  function clearData() {
    var ks = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (isData(k)) ks.push(k);
    }
    ks.forEach(function (k) { localStorage.removeItem(k); });
  }

  function save(pid) {
    try { localStorage.setItem(PKG + pid, JSON.stringify(snapshot())); } catch (e) {}
  }

  function load(pid) {
    clearData();
    var box = {};
    try { box = JSON.parse(localStorage.getItem(PKG + pid) || '{}'); } catch (e) {}
    Object.keys(box).forEach(function (k) {
      try { localStorage.setItem(k, box[k]); } catch (e) {}
    });
  }

  function cur() {
    var v = localStorage.getItem(CUR);
    if (!v) { localStorage.setItem(CUR, 'demo_a'); v = 'demo_a'; }
    return v;
  }

  function meta(id) {
    for (var i = 0; i < PLAYERS.length; i++) if (PLAYERS[i].id === (id || cur())) return PLAYERS[i];
    return PLAYERS[0];
  }

  function switchTo(pid) {
    if (!pid || pid === cur()) return;
    save(cur());
    load(pid);
    localStorage.setItem(CUR, pid);
    location.reload();
  }

  /* 登入頁用：換人但不 reload（緊接住自己要跳頁） */
  function login(pid) {
    if (!pid || pid === cur()) return;
    save(cur());
    load(pid);
    localStorage.setItem(CUR, pid);
  }

  /* ── 右上角的「現在是：X ▾」 ─────────────────────────────── */
  function mount(host, opts) {
    if (!host || document.getElementById('whoChip')) return;
    opts = opts || {};
    var m = meta();

    var wrap = document.createElement('div');
    wrap.id = 'whoChip';
    wrap.className = 'whoChip';
    wrap.innerHTML = '<button class="whoBtn" type="button">' +
      '<span class="whoDot">' + m.emoji + '</span>' +
      '<span class="whoName">' + m.name + '</span>' +
      '<span class="whoCaret">▾</span></button>' +
      '<div class="whoMenu hidden">' +
      PLAYERS.map(function (p) {
        return '<button class="whoItem' + (p.id === m.id ? ' on' : '') + '" data-id="' + p.id + '">' +
          '<span class="whoDot">' + p.emoji + '</span>' +
          '<span><b>' + p.name + '</b><i>' + p.tag + '</i></span>' +
          (p.id === m.id ? '<span class="whoTick">✓</span>' : '') +
          '</button>';
      }).join('') +
      '<div class="whoHint">切換會載入這位小朋友自己的進度</div>' +
      '</div>';
    host.appendChild(wrap);

    var menu = wrap.querySelector('.whoMenu');
    wrap.querySelector('.whoBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', function () { menu.classList.add('hidden'); });
    wrap.addEventListener('click', function (e) { e.stopPropagation(); });

    wrap.querySelectorAll('.whoItem').forEach(function (b) {
      b.addEventListener('click', function () { switchTo(b.getAttribute('data-id')); });
    });
  }

  function installStyles() {
    if (document.getElementById('whoChipCss')) return;
    var s = document.createElement('style');
    s.id = 'whoChipCss';
    s.textContent = [
      '.whoChip{position:relative;display:inline-block;font-family:inherit}',
      '.whoChip .whoBtn{display:flex;align-items:center;gap:6px;padding:6px 12px 6px 8px;',
      '  border-radius:999px;border:1px solid rgba(255,255,255,.18);',
      '  background:rgba(15,23,42,.72);color:#e2e8f0;font-size:14px;font-weight:800;',
      '  cursor:pointer;transition:transform .12s,background .12s}',
      '.whoChip .whoBtn:hover{background:rgba(30,41,59,.9)}',
      '.whoChip .whoBtn:active{transform:scale(.95)}',
      '.whoChip .whoDot{font-size:16px;line-height:1}',
      '.whoChip .whoCaret{opacity:.6;font-size:11px}',
      '.whoChip .whoMenu{position:absolute;top:calc(100% + 8px);right:0;z-index:200;min-width:210px;',
      '  background:#0f172a;border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:6px;',
      '  box-shadow:0 18px 40px rgba(0,0,0,.55)}',
      '.whoChip .whoMenu.hidden{display:none}',
      '.whoChip.alignLeft .whoMenu{left:0;right:auto}',
      '.whoChip .whoItem{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;',
      '  border:0;border-radius:10px;background:transparent;color:#e2e8f0;text-align:left;cursor:pointer}',
      '.whoChip .whoItem:hover{background:rgba(255,255,255,.07)}',
      '.whoChip .whoItem.on{background:rgba(251,191,36,.12)}',
      '.whoChip .whoItem b{display:block;font-size:14px}',
      '.whoChip .whoItem i{display:block;font-style:normal;font-size:11px;color:#94a3b8;margin-top:1px}',
      '.whoChip .whoTick{margin-left:auto;color:#fbbf24;font-weight:900}',
      '.whoChip .whoHint{padding:8px 10px 4px;font-size:11px;color:#64748b;border-top:1px solid rgba(255,255,255,.08);margin-top:4px}'
    ].join('');
    document.head.appendChild(s);
  }

  window.Player = {
    players: PLAYERS,
    cur: cur,
    meta: meta,
    name: function () { return meta().name; },
    switchTo: switchTo,
    login: login,
    mount: function (host) { installStyles(); mount(host); }
  };
})();
