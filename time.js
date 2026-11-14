/* ─────────────────────────────────────────────────────────────
   time.js — 娛樂時間代幣（四頁共用）※ 單位＝秒
   localStorage['dsh_time'] = { day, earned, used, star, v:2 }（全部是秒）
   localStorage['dsh_time_cap'] = 每日娛樂上限（分鐘，預設 45）
   規則：
     · 答對一題 = +300 秒（關卡越高越少：5/4/3/2 分鐘）
     · 隨機禮物：連對、答得快 → 額外秒數（120 秒以內）
     · 每日上限：balance = min(earned, cap×60) - used
     · 時間 → 星星：300 秒 = 1 顆（單向；星星換不回時間）
   ───────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';
  var CAP_KEY = 'dsh_time_cap';
  var KEY = 'dsh_time';
  var DEF_CAP = 45;              // 每日娛樂上限（分鐘）
  var V = 2;                     // 資料版本：2 = 秒
  var STAR_COST = 300;           // 300 秒（5 分鐘）換 1 顆星

  /* 做題比例：stage 1-3 → 5 分鐘，4-5 → 4，6-7 → 3，8+ → 2（換算成秒） */
  var STAGE_RAMP = [5, 5, 5, 4, 4, 3, 3, 2];
  function stageNow() {
    var v = parseInt(localStorage.getItem('dsh_stage') || '1', 10);
    return (isNaN(v) || v < 1) ? 1 : v;
  }
  function secNow() {
    var st = stageNow();
    var min = STAGE_RAMP[Math.min(st, STAGE_RAMP.length) - 1] || 2;
    return min * 60;
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
      ('0' + d.getDate()).slice(-2);
  }
  function load() {
    var o = null;
    try { o = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!o || typeof o !== 'object' || o.day !== today()) {
      return { day: today(), earned: 0, used: 0, star: 0, v: V };
    }
    /* 舊資料是「分鐘」→ 換成秒 */
    if (o.v !== V) {
      o.earned = (o.earned || 0) * 60;
      o.used = (o.used || 0) * 60;
      o.star = (o.star || 0) * 60;
      o.v = V;
    }
    return o;
  }
  function save(o) {
    o.v = V;
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  function cap() {                       /* 回傳「分鐘」 */
    var c = parseInt(localStorage.getItem(CAP_KEY), 10);
    return (c > 0) ? c : DEF_CAP;
  }
  function capSec() { return cap() * 60; }
  function setCap(n) {
    n = Math.max(0, parseInt(n, 10) || 0);
    try { localStorage.setItem(CAP_KEY, String(n)); } catch (e) {}
    var o = load();
    if (o.earned > n * 60) { o.earned = n * 60; save(o); }
    paint();
    return n;
  }
  function earn(n) {
    var o = load();
    o.earned += Math.max(0, Math.round(n || 0));
    save(o);
    paint();
    return balance();
  }
  function used() { return load().used; }
  function balance() {
    var o = load();
    return Math.max(0, Math.min(o.earned, capSec()) - o.used);
  }
  function use(n) {
    var o = load();
    o.used = Math.min(capSec(), o.used + Math.max(0, Math.round(n || 0)));
    save(o);
    paint();
    return balance();
  }
  function toStars(n) {
    var steps = Math.floor((Math.floor(n) || 0) / STAR_COST);
    if (steps <= 0) return 0;
    if (balance() < steps * STAR_COST) return 0;
    var o = load();
    o.earned -= steps * STAR_COST;
    o.star += steps * STAR_COST;
    save(o);
    paint();
    return steps;
  }

  /* 隨機禮物：偶爾才有（基礎 4%），連對越多、答得越快機率略高；金額 20–40 秒 */
  var GIFTS = [20, 20, 30, 30, 40];
  function gift(opt) {
    opt = opt || {};
    var streak = Math.max(0, opt.streak || 0);
    var ms = opt.ms || 0;
    var fast = ms > 0 && ms < 6000;
    var chance = 0.015 + Math.min(0.05, streak * 0.008) + (fast ? 0.015 : 0);
    if (Math.random() > chance) return null;
    var sec = GIFTS[Math.floor(Math.random() * GIFTS.length)];
    if (fast && sec < 40) sec += 10;
    var why = fast ? '答得好快' : (streak >= 5 ? '連對 ' + streak + ' 題' : '手氣好');
    earn(sec);
    return { sec: sec, label: why };
  }

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    if (sec < 60) return sec + ' 秒';
    var m = Math.floor(sec / 60), s = sec % 60;
    return s ? (m + ' 分 ' + s + ' 秒') : (m + ' 分鐘');
  }

  function stats() {
    var o = load();
    return {
      day: o.day, earned: o.earned, used: o.used, star: o.star,
      cap: cap(), capSec: capSec(), balance: balance(),
      secPerAnswer: secNow(), starCost: STAR_COST
    };
  }
  function paint() {
    var els = document.querySelectorAll('.timeChip');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute('data-time-full')) {
        el.textContent = '⏱ ' + balance() + ' / ' + capSec() + ' 秒';
      } else {
        el.textContent = '⏱ ' + balance() + ' 秒';
      }
      el.title = '娛樂時間（答題賺）：剩 ' + fmt(balance()) + '，每日上限 ' + cap() + ' 分鐘';
    }
  }
  function mount(host, full) {
    installStyles();
    var el = document.createElement('div');
    el.className = 'timeChip';
    if (full) el.setAttribute('data-time-full', '1');
    if (host) host.appendChild(el);
    paint();
    return el;
  }
  function installStyles() {
    if (document.getElementById('time-css')) return;
    var st = document.createElement('style');
    st.id = 'time-css';
    st.textContent =
      '.timeChip{display:inline-flex;align-items:center;gap:4px;font-weight:800;color:#a7f3d0;' +
      'background:rgba(6,78,59,.72);border:1px solid rgba(52,211,153,.4);border-radius:999px;' +
      'padding:5px 12px;font-size:14px;backdrop-filter:blur(4px);white-space:nowrap}';
    document.head.appendChild(st);
  }

  w.Time = {
    cap: cap, capSec: capSec, setCap: setCap,
    secPerAnswer: secNow,
    minPerAnswer: function () { return Math.round(secNow() / 60); },  /* 舊接口：回分鐘 */
    starCost: function () { return STAR_COST; },
    earn: earn, used: used, balance: balance, use: use, toStars: toStars,
    gift: gift, fmt: fmt,
    stats: stats, mount: mount, paint: paint, installStyles: installStyles
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installStyles);
  } else {
    installStyles();
  }
})(window);
