/* ──────────────────────────────────────────────────────────────
   player.js — 這部機屬於哪一位小朋友（一人一機）
   ──────────────────────────────────────────────────────────────
   規則（2026-11-14 家長定）：
   · 一部機只綁一位小朋友，登入一次就記住，之後開頁自動進去。
   · 機器上**沒有**「隨時換人」。要換人＝家長長按首頁標題解除綁定。
   · 名冊（姓名／乳名／6 位密碼）由家長在 Google Sheet 的 Users 表手動輸入。

   內部資料的做法（沿用）：
   不去改每一頁原有的 localStorage key（`dsh_stars`、`dsh_pet`…），
   綁定時把「當前這一位的所有 dsh_* 資料」整包存到 `dsh__p_<id>`，
   再把新那位的那包載回原本的 key。這樣四頁一行都不用改。
   `dsh__` 開頭的 key（__cur、__bind、__p_*）本身不算玩家資料，不會被搬。
   ────────────────────────────────────────────────────────────── */
(function () {
  var CUR = 'dsh__cur';
  var PKG = 'dsh__p_';
  var BIND = 'dsh__bind';

  /* 只在「未綁定 + 連不上名冊」時當示範用 */
  var PLAYERS = [
    { id: 'demo_a', name: '陳小明', nick: '小明', pet: '火苗龍', tag: '穩定進步型', emoji: '🐲' },
    { id: 'demo_b', name: '李美欣', nick: '美欣', pet: '竹筍熊', tag: '卡關型', emoji: '🐣' }
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
    return localStorage.getItem(CUR) || '';
  }

  function bound() {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(BIND) || 'null'); } catch (e) {}
    return o && o.id ? o : null;
  }

  function meta(id) {
    if (id) {
      for (var i = 0; i < PLAYERS.length; i++) if (PLAYERS[i].id === id) return PLAYERS[i];
      return { id: id, name: id, nick: id, emoji: '🐲', tag: '' };
    }
    var b = bound();
    if (b) {
      return {
        id: b.id,
        name: b.name || b.id,
        nick: b.nick || b.name || b.id,
        emoji: b.emoji || '🐲',
        tag: b.grade ? b.grade : ''
      };
    }
    var c = cur();
    for (var j = 0; j < PLAYERS.length; j++) if (PLAYERS[j].id === c) return PLAYERS[j];
    return { id: '', name: '未登入', nick: '未登入', emoji: '🐲', tag: '' };
  }

  /* 綁定這部機（登入成功時呼叫） */
  function bind(st) {
    if (!st || !st.id) return false;
    var prev = cur();
    if (prev && prev !== st.id) save(prev);
    load(st.id);
    localStorage.setItem(CUR, st.id);
    localStorage.setItem(BIND, JSON.stringify({
      id: String(st.id),
      name: st.name || '',
      nick: st.nick || st.name || '',
      emoji: st.emoji || '🐲',
      grade: st.grade || '',
      t: Date.now()
    }));
    return true;
  }

  /* 解除綁定（家長長按首頁標題） */
  function unbind() {
    var c = cur();
    if (c) save(c);
    localStorage.removeItem(CUR);
    localStorage.removeItem(BIND);
  }

  /* 舊 API 保留：登入頁以外不要用 */
  function switchTo(pid) {
    if (!pid || pid === cur()) return;
    save(cur());
    load(pid);
    localStorage.setItem(CUR, pid);
    location.reload();
  }

  function login(pid) {
    if (!pid || pid === cur()) return;
    save(cur());
    load(pid);
    localStorage.setItem(CUR, pid);
  }

  /* ── 右上角的名字：只有一個，沒有下拉、不能換人 ── */
  function mount(host) {
    if (!host || document.getElementById('whoChip')) return;
    var m = meta();
    if (!m.id) return;

    var wrap = document.createElement('div');
    wrap.id = 'whoChip';
    wrap.className = 'whoChip';
    wrap.innerHTML = '<span class="whoBtn" title="' + m.name + '">' +
      '<span class="whoDot">' + m.emoji + '</span>' +
      '<span class="whoName">' + (m.nick || m.name) + '</span></span>';
    host.appendChild(wrap);
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
      '  cursor:default;user-select:none}',
      '.whoChip .whoDot{font-size:16px;line-height:1}'
    ].join('');
    document.head.appendChild(s);
  }

  window.Player = {
    players: PLAYERS,
    cur: cur,
    bound: bound,
    meta: meta,
    name: function () { var m = meta(); return m.nick || m.name; },
    fullName: function () { return meta().name; },
    bind: bind,
    unbind: unbind,
    switchTo: switchTo,
    login: login,
    mount: function (host) { installStyles(); mount(host); }
  };
})();
