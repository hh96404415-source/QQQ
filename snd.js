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
    if (v && w.SND && w.SND._onEnable) { try { w.SND._onEnable(); } catch (e) {} }
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

  w.SND = { on: on, set: set, toggle: toggle, mount: mount, installStyles: installStyles };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installStyles);
  } else {
    installStyles();
  }
})(window);
