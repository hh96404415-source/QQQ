/* ─────────────────────────────────────────────────────────────
   snd.js — 音效開關（三支 demo 共用）
   localStorage['dsh_sound'] = '1' | '0'
   頁面的音效入口只要加一句 if (!SND.on()) return;
   ───────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';
  var KEY = 'dsh_sound';
  var btn = null;

  function on() {
    try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; }
  }
  function set(v) {
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
    paint();
    if (v) tryPlay(); else tryPause();
  }
  function toggle() { set(!on()); }

  function paint() {
    if (!btn) return;
    var yes = on();
    btn.textContent = yes ? '🔊' : '🔇';
    btn.classList.toggle('off', !yes);
    btn.setAttribute('aria-label', yes ? '音效開' : '音效關');
    btn.title = yes ? '音效開（點一下關）' : '音效關（點一下開）';
  }

  function mount(host, style) {
    if (btn || !host) return btn;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'sndBtn';
    btn.className = 'sndBtn';
    if (style) btn.setAttribute('style', style);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    host.appendChild(btn);
    paint();
    return btn;
  }

  function installStyles() {
    if (document.getElementById('snd-css')) return;
    var st = document.createElement('style');
    st.id = 'snd-css';
    st.textContent =
      '.sndBtn{appearance:none;border:1px solid rgba(255,255,255,.16);cursor:pointer;' +
      'width:30px;height:30px;border-radius:999px;background:rgba(15,23,42,.72);color:#e2e8f0;' +
      'font-size:14px;line-height:1;padding:0;display:inline-flex;align-items:center;' +
      'justify-content:center;font-family:inherit;transition:transform .1s, opacity .15s;' +
      'backdrop-filter:blur(4px)}' +
      '.sndBtn:hover{transform:scale(1.08)}' +
      '.sndBtn:active{transform:scale(.94)}' +
      '.sndBtn.off{opacity:.55}';
    document.head.appendChild(st);
  }

  /* ── 背景音樂 ──────────────────────────────────────────────
     SND.bgm('fear.mp3', 0.35)
     · 瀏覽器不許自動播音，所以第一次使用者碰畫面/按鍵才開始播
     · 音效關掉時一併暫停；重新開啟會接回原本的進度
     · 切到別的頁籤（hidden）也暫停，回來再播
     ────────────────────────────────────────────────────────── */
  var bgmEl = null, bgmWanted = false, bgmVolume = 0.35, unlocked = false;

  function tryPlay() {
    if (!bgmEl || !bgmWanted || !unlocked || !on()) return;
    if (document.hidden) return;
    var p = bgmEl.play();
    if (p && p.catch) p.catch(function () {});
  }
  function tryPause() {
    if (bgmEl && !bgmEl.paused) bgmEl.pause();
  }
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    tryPlay();
  }
  function bgm(src, vol) {
    if (!src) return null;
    if (typeof vol === 'number') bgmVolume = vol;
    if (!bgmEl) {
      bgmEl = document.createElement('audio');
      bgmEl.id = 'bgm';
      bgmEl.loop = true;
      bgmEl.preload = 'auto';
      bgmEl.volume = bgmVolume;
      bgmEl.setAttribute('playsinline', '');
      document.body.appendChild(bgmEl);
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
        w.addEventListener(ev, unlock, { once: true, passive: true });
      });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) tryPause(); else tryPlay();
      });
    }
    if (!bgmEl.src || bgmEl.src.indexOf(encodeURI(src)) === -1) bgmEl.src = src;
    bgmEl.volume = bgmVolume;
    bgmWanted = true;
    tryPlay();
    return bgmEl;
  }

  // 音效開關改變時，跟著播/停背景音樂
  w.SND = { on: on, set: set, toggle: toggle, mount: mount, installStyles: installStyles,
            bgm: bgm, _onEnable: tryPlay, _bgmEl: function () { return bgmEl; } };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installStyles);
  } else {
    installStyles();
  }
})(window);
