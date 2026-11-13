/* ─────────────────────────────────────────────────────────────
   juice.js — 全站「手感」層：音效、按鍵反應、過場、橫幅、彩帶
   （2026-11-14）

   用法：
     Juice.fx('correct', { streak: 3 })   一句就有一個音效
     Juice.banner('👑 BOSS 出現', { ms: 1400 })
     Juice.confetti(24)
     Juice.slowmo(160)                    假的慢動作：凍一下 + 推近 + 白閃
     Juice.flash('#fff', .45)
   ───────────────────────────────────────────────────────────── */
(function (w, d) {
  'use strict';

  var AC = null, master = null;
  function on() { return !w.SND || w.SND.on(); }

  function actx() {
    if (AC) { if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} } return AC; }
    try {
      AC = new (w.AudioContext || w.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = 0.9;
      master.connect(AC.destination);
    } catch (e) { AC = null; }
    return AC;
  }

  /* 單音：f1 → f2（滑音），可指定波形、長度、音量、延遲 */
  function tone(o) {
    var c = actx(); if (!c) return;
    var t0 = c.currentTime + (o.at || 0);
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f1, t0);
    if (o.f2 && o.f2 !== o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + o.dur);
    var peak = (o.gain == null ? 0.08 : o.gain);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g);
    if (o.filter) {
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = o.filter;
      g.connect(lp); lp.connect(master);
    } else {
      g.connect(master);
    }
    osc.start(t0); osc.stop(t0 + o.dur + 0.02);
  }

  /* 噪音（打擊感） */
  function noise(o) {
    var c = actx(); if (!c) return;
    var dur = o.dur || 0.12, n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = buf;
    var g = c.createGain();
    g.gain.value = o.gain == null ? 0.12 : o.gain;
    var lp = c.createBiquadFilter();
    lp.type = o.hp ? 'highpass' : 'lowpass';
    lp.frequency.value = o.freq || 1200;
    src.connect(lp); lp.connect(g); g.connect(master);
    var t0 = c.currentTime + (o.at || 0);
    src.start(t0); src.stop(t0 + dur);
  }

  var BANK = {
    click:  function () { tone({ f1: 660, f2: 720, type: 'sine', dur: 0.06, gain: 0.045 }); },
    tap:    function () { tone({ f1: 880, f2: 990, type: 'triangle', dur: 0.05, gain: 0.05 }); },
    coin:   function () {
      tone({ f1: 988, type: 'square', dur: 0.06, gain: 0.06 });
      tone({ f1: 1319, type: 'square', dur: 0.10, gain: 0.055, at: 0.06 });
    },
    star:   function () {
      tone({ f1: 1568, type: 'sine', dur: 0.08, gain: 0.05 });
      tone({ f1: 2093, type: 'sine', dur: 0.10, gain: 0.04, at: 0.05 });
    },
    correct: function (o) {
      var s = Math.min(7, (o && o.streak) ? o.streak : 0);
      var base = 523.25 * Math.pow(2, s / 12);
      [0, 4, 7].forEach(function (semi, i) {
        tone({ f1: base * Math.pow(2, semi / 12), type: 'triangle', dur: 0.12, gain: 0.075, at: i * 0.055 });
      });
    },
    wrong:  function () {
      tone({ f1: 220, f2: 120, type: 'square', dur: 0.20, gain: 0.06, filter: 900 });
      noise({ dur: 0.10, freq: 500, gain: 0.05 });
    },
    hit:    function () {
      tone({ f1: 150, f2: 70, type: 'square', dur: 0.10, gain: 0.09, filter: 700 });
      noise({ dur: 0.08, freq: 2600, hp: true, gain: 0.06 });
    },
    boom:   function () {
      tone({ f1: 70, f2: 38, type: 'sine', dur: 0.55, gain: 0.16 });
      noise({ dur: 0.35, freq: 800, gain: 0.10 });
    },
    level:  function () {
      tone({ f1: 420, f2: 1250, type: 'triangle', dur: 0.55, gain: 0.08 });
      tone({ f1: 840, f2: 2500, type: 'sine', dur: 0.45, gain: 0.045, at: 0.05 });
    },
    feed:   function () {
      tone({ f1: 300, f2: 620, type: 'sine', dur: 0.11, gain: 0.07 });
      tone({ f1: 900, type: 'sine', dur: 0.06, gain: 0.04, at: 0.10 });
    },
    win:    function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        tone({ f1: f, type: 'triangle', dur: 0.18, gain: 0.075, at: i * 0.09 });
      });
    },
    boss:   function () {
      tone({ f1: 90, f2: 60, type: 'sine', dur: 0.7, gain: 0.18 });
      tone({ f1: 200, f2: 900, type: 'sawtooth', dur: 0.5, gain: 0.05, filter: 1400 });
      noise({ dur: 0.5, freq: 300, gain: 0.07 });
    },
    page:   function () { tone({ f1: 320, f2: 880, type: 'sine', dur: 0.20, gain: 0.05 }); },
    unlock: function () { tone({ f1: 700, f2: 1400, type: 'sine', dur: 0.16, gain: 0.05 }); }
  };

  function fx(name, opt) {
    if (!on()) return;
    var f = BANK[name];
    if (!f) return;
    var c = actx(); if (!c) return;
    try { f(opt || {}); } catch (e) {}
  }

  /* ── 全站按鍵反應（視覺 + 極輕的 click 音）────────────── */
  function installPressCss() {
    if (d.getElementById('juiceCss')) return;
    var s = d.createElement('style');
    s.id = 'juiceCss';
    s.textContent = [
      /* 按下去有一點「陷進去」的感覺，但不動 transform（避免打架） */
      'button:active,.opt:active,.key:active,.chip:active,.gcard:active,.unitItem:active{filter:brightness(1.18)}',
      'button,.opt,.chip,.gcard{transition:filter .08s}',

      /* 過場用的黑幕 */
      '#juiceVeil{position:fixed;inset:0;background:#070b13;opacity:0;pointer-events:none;',
      '  z-index:9990;transition:opacity .22s}',
      '#juiceVeil.on{opacity:1}',

      /* BOSS / 提示橫幅 */
      '#juiceBanner{position:fixed;left:50%;top:26%;transform:translate(-50%,-50%) scale(.86);',
      '  z-index:9991;pointer-events:none;opacity:0;text-align:center;',
      '  font-size:clamp(24px,4.4vmin,42px);font-weight:900;color:#fde047;',
      '  -webkit-text-stroke:3px #7c2d12;paint-order:stroke fill;',
      '  text-shadow:0 10px 30px rgba(0,0,0,.65);white-space:nowrap}',
      '#juiceBanner.on{animation:jbIn .5s cubic-bezier(.2,1.4,.4,1) forwards}',
      '@keyframes jbIn{0%{opacity:0;transform:translate(-50%,-50%) scale(.7)}',
      '  45%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}',
      '  70%{transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-62%) scale(1)}}',

      /* 慢動作用的推近 + 白閃 */
      '.juiceZoom{transition:transform .18s ease-out!important;transform:scale(1.045)!important}',
      '#juiceFlash{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:9989;',
      '  transition:opacity .12s}'
    ].join('');
    d.head.appendChild(s);
  }

  function flash(color, ms) {
    var el = d.getElementById('juiceFlash');
    if (!el) { el = d.createElement('div'); el.id = 'juiceFlash'; d.body.appendChild(el); }
    el.style.background = color || '#fff';
    el.style.opacity = '0.85';
    setTimeout(function () { el.style.opacity = '0'; }, ms || 90);
  }

  function slowmo(ms, target) {
    var el = target || d.querySelector('#arena') || d.body;
    el.classList.add('juiceZoom');
    flash('#fff', 70);
    setTimeout(function () { el.classList.remove('juiceZoom'); }, ms || 160);
  }

  function banner(text, opt) {
    opt = opt || {};
    var el = d.getElementById('juiceBanner');
    if (!el) { el = d.createElement('div'); el.id = 'juiceBanner'; d.body.appendChild(el); }
    el.textContent = text;
    /* 有指定 target（例如競技場）就對齊它，否則對齊整個畫面 */
    var t = opt.target;
    if (t && t.getBoundingClientRect) {
      var r = t.getBoundingClientRect();
      el.style.left = (r.left + r.width / 2) + 'px';
      el.style.top = (r.top + Math.max(54, r.height * 0.2)) + 'px';
    } else {
      el.style.left = '50%';
      el.style.top = '26%';
    }
    el.classList.remove('on');
    void el.offsetWidth;
    el.style.animationDuration = ((opt.ms || 1500) / 1000) + 's';
    el.classList.add('on');
  }

  function confetti(n, origin) {
    var o = origin || { x: w.innerWidth / 2, y: w.innerHeight * 0.42 };
    var set = ['🎉', '⭐', '✨', '💛', '🧡'];
    n = n || 18;
    for (var i = 0; i < n; i++) {
      (function (i) {
        var s = d.createElement('div');
        s.textContent = set[(Math.random() * set.length) | 0];
        var size = 14 + Math.random() * 16;
        s.style.cssText = 'position:fixed;left:' + o.x + 'px;top:' + o.y + 'px;font-size:' + size +
          'px;z-index:9992;pointer-events:none;will-change:transform,opacity';
        d.body.appendChild(s);
        var ang = (-Math.PI / 2) + (Math.random() - 0.5) * 2.1;
        var dist = 90 + Math.random() * 190;
        var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
        var rot = (Math.random() - 0.5) * 720;
        var fall = 120 + Math.random() * 180;
        var dur = 900 + Math.random() * 700;
        if (s.animate) {
          s.animate([
            { transform: 'translate(-50%,-50%) rotate(0deg) scale(.4)', opacity: 1 },
            { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) rotate(' + (rot / 2) + 'deg) scale(1)', opacity: 1, offset: 0.45 },
            { transform: 'translate(calc(-50% + ' + (dx * 1.15) + 'px), calc(-50% + ' + (dy + fall) + 'px)) rotate(' + rot + 'deg) scale(.9)', opacity: 0 }
          ], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = function () { s.remove(); };
        } else {
          setTimeout(function () { s.remove(); }, dur);
        }
      })(i);
    }
  }

  /* 數字彈一下（星星、分數） */
  function bump(el, scale) {
    if (!el || !el.animate) return;
    el.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(' + (scale || 1.35) + ')' },
      { transform: 'scale(1)' }
    ], { duration: 420, easing: 'cubic-bezier(.2,1.5,.4,1)' });
  }

  /* ── 換頁過場 ─────────────────────────────────────────── */
  function installTransition() {
    var veil = d.createElement('div');
    veil.id = 'juiceVeil';
    d.body.appendChild(veil);

    d.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || a.target === '_blank') return;
      if (!/\.html(\?|$)/.test(href)) return;
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      fx('page');
      veil.classList.add('on');
      setTimeout(function () { location.href = href; }, 190);
    }, true);

    /* 從 bfcache 回來時把黑幕收掉 */
    w.addEventListener('pageshow', function () { veil.classList.remove('on'); });
  }

  /* ── 全域按鍵音（很輕，不搶戲）────────────────────────── */
  function installClickSound() {
    d.addEventListener('pointerdown', function (e) {
      var t = e.target.closest ? e.target.closest('.opt,.key,.gcard,.chip,button') : null;
      if (!t) return;
      if (t.hasAttribute('data-nosnd')) return;
      fx('click');
    }, { passive: true, capture: true });
  }

  function ready(fn) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    installPressCss();
    installTransition();
    installClickSound();
  });

  /* 第一次觸碰解鎖 AudioContext */
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    w.addEventListener(ev, function () { actx(); }, { once: true, passive: true });
  });

  w.Juice = {
    fx: fx, tone: tone, noise: noise,
    flash: flash, slowmo: slowmo, banner: banner, confetti: confetti, bump: bump
  };
})(window, document);
