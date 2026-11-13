/* ─────────────────────────────────────────────────────────────
   time.js — 娛樂時間代幣（四頁共用）
   localStorage['dsh_time'] = { day:'YYYY-MM-DD', earned, used, star }
   localStorage['dsh_time_cap'] = 每日娛樂上限（分鐘，預設 45）
   規則：
     · 答對一題 = +5 分鐘娛樂（起步 1 分鐘題 ≈ 15 分鐘玩）
     · 每日娛樂上限：balance = min(earned, cap) - used
     · 時間 → 星星：5 分鐘 = 1 顆（單向；星星換不回時間）
     · 星星 → 時間：禁止（這裡根本不提供入口）
   ───────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';
  var CAP_KEY = 'dsh_time_cap';
  var KEY = 'dsh_time';
  var DEF_CAP = 45;        // 每日娛樂上限（分鐘）
  var MIN_PER_ANSWER = 5;  // 每答對 1 題賺的分鐘數
  var STAR_COST = 5;       // 幾分鐘換 1 顆星

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
      o = { day: today(), earned: 0, used: 0, star: 0 };
    }
    return o;
  }
  function save(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  function cap() {
    var c = parseInt(localStorage.getItem(CAP_KEY), 10);
    return (c > 0) ? c : DEF_CAP;
  }
  function setCap(n) {
    n = Math.max(0, parseInt(n, 10) || 0);
    try { localStorage.setItem(CAP_KEY, String(n)); } catch (e) {}
    var o = load();
    if (o.earned > n) { o.earned = n; save(o); }  // 上限調低，已賺跟著夾
    paint();
    return n;
  }
  function earn(n) {
    var o = load();
    o.earned += n;
    save(o);
    paint();
    return balance();
  }
  function used() { return load().used; }
  function balance() {
    var o = load();
    return Math.max(0, Math.min(o.earned, cap()) - o.used);
  }
  function use(n) {
    /* 未來：路由器在娛樂時間用完時呼叫，扣除已用分鐘 */
    var o = load();
    o.used = Math.min(cap(), o.used + n);
    save(o);
    paint();
    return balance();
  }
  function toStars(n) {
    /* 時間 → 星星（單向）。n = 要犧牲的分鐘數；只能整顆換。回傳換到幾顆星（0＝不夠/不合法）。 */
    var steps = Math.floor((Math.floor(n) || 0) / STAR_COST);
    if (steps <= 0) return 0;
    var o = load();
    if (balance() < steps * STAR_COST) return 0;
    o.earned -= steps * STAR_COST;
    o.star += steps * STAR_COST;
    save(o);
    paint();
    return steps;
  }
  function stats() {
    var o = load();
    return {
      day: o.day, earned: o.earned, used: o.used, star: o.star,
      cap: cap(), balance: balance(), minPerAnswer: MIN_PER_ANSWER, starCost: STAR_COST
    };
  }
  function paint() {
    var els = document.querySelectorAll('.timeChip');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute('data-time-full')) {
        el.textContent = '⏱ ' + balance() + ' / ' + cap() + ' 分鐘';
      } else {
        el.textContent = '⏱ ' + balance() + ' 分鐘';
      }
    }
  }
  function mount(host, full) {
    installStyles();
    var el = document.createElement('div');
    el.className = 'timeChip';
    if (full) el.setAttribute('data-time-full', '1');
    el.title = '娛樂時間（答題賺）：剩 ' + balance() + ' 分鐘，上限 ' + cap() + ' 分鐘';
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
    cap: cap, setCap: setCap,
    minPerAnswer: function () { return MIN_PER_ANSWER; },
    starCost: function () { return STAR_COST; },
    earn: earn, used: used, balance: balance, use: use, toStars: toStars,
    stats: stats, mount: mount, paint: paint, installStyles: installStyles
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installStyles);
  } else {
    installStyles();
  }
})(window);
