/* motion.js — 讓畫面「不是死圖」：雲飄、光斑、鳥飛、草動、設施微動、UI 呼吸
   全部只用 transform / opacity，跑在合成層，不會拖慢答題。 */
(function () {
  var CSS = "\
@keyframes mbDrift{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(120px,0,0)}}\
@keyframes mbDrift2{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(-90px,0,0)}}\
@keyframes mbRay{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}\
@keyframes mbBird{0%{transform:translate3d(-8vw,0,0) scaleX(1);opacity:0}\
  8%{opacity:.9}92%{opacity:.9}100%{transform:translate3d(108vw,-26px,0) scaleX(1);opacity:0}}\
@keyframes mbMote{0%{transform:translate3d(0,0,0) scale(.7);opacity:0}\
  20%{opacity:.85}100%{transform:translate3d(18px,-70px,0) scale(1.1);opacity:0}}\
@keyframes mbSway{0%,100%{transform:rotate(-1.6deg) translateY(0)}50%{transform:rotate(1.6deg) translateY(-1px)}}\
@keyframes mbBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}\
@keyframes mbPulse{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.012)}}\
@keyframes mbGlow{0%,100%{box-shadow:0 0 0 rgba(251,191,36,0)}50%{box-shadow:0 0 14px rgba(251,191,36,.55)}}\
@keyframes mbWater{0%{background-position:0 0}100%{background-position:80px 0}}\
.ambWrap{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1}\
.ambCloud{position:absolute;border-radius:50%;background:rgba(255,255,255,.55);filter:blur(16px);\
  animation:mbDrift linear infinite}\
.ambRay{position:absolute;left:50%;top:-40%;width:150%;height:180%;transform-origin:50% 0;\
  background:conic-gradient(from 200deg,rgba(255,255,255,0) 0deg,rgba(255,255,255,.10) 12deg,\
  rgba(255,255,255,0) 26deg,rgba(255,255,255,0) 190deg,rgba(255,255,255,.08) 202deg,\
  rgba(255,255,255,0) 216deg);animation:mbRay 90s linear infinite;mix-blend-mode:screen;opacity:.45}\
.ambBird{position:absolute;font-size:15px;animation:mbBird linear infinite;opacity:0}\
.ambMote{position:absolute;width:4px;height:4px;border-radius:50%;background:rgba(255,246,190,.9);\
  box-shadow:0 0 6px rgba(255,236,150,.9);animation:mbMote linear infinite}\
.fac.sway img.fico,.fac.sway .fico{animation:mbSway 7s ease-in-out infinite;transform-origin:50% 100%}\
.fac.bob img.fico,.fac.bob .fico{animation:mbBob 4.2s ease-in-out infinite}\
.fac.glow{animation:mbPulse 5s ease-in-out infinite}\
.fac.pond img.fico{animation:mbPulse 4.5s ease-in-out infinite}\
.shopCard{animation:mbBob 6s ease-in-out infinite}\
.shopCard:nth-child(2n){animation-delay:-2s}\
.shopCard:nth-child(3n){animation-delay:-3.4s}\
#btnStar{animation:mbGlow 3.2s ease-in-out infinite}\
#petBar .chip img{transition:transform .18s}\
#petBar .chip:hover img{transform:translateY(-2px) scale(1.05)}\
@media (prefers-reduced-motion:reduce){.ambWrap{display:none}\
  .fac.sway img.fico,.fac.bob img.fico,.shopCard,.grow{animation:none!important}}";

  function style() {
    if (document.getElementById('motionCss')) return;
    var s = document.createElement('style');
    s.id = 'motionCss';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* 農場／競技場共用的環境層 */
  function sky(host, opt) {
    if (!host || host.querySelector('.ambWrap')) return;
    style();
    var o = Object.assign({ clouds: 3, birds: 2, motes: 7, ray: true }, opt || {});
    var w = document.createElement('div');
    w.className = 'ambWrap';
    w.style.zIndex = '1';

    if (o.ray) {
      var ray = document.createElement('div');
      ray.className = 'ambRay';
      w.appendChild(ray);
    }
    for (var i = 0; i < o.clouds; i++) {
      var c = document.createElement('div');
      c.className = 'ambCloud';
      var cw = 90 + Math.random() * 140;
      c.style.width = cw + 'px';
      c.style.height = (cw * 0.42) + 'px';
      c.style.left = (-20 + Math.random() * 90) + '%';
      c.style.top = (4 + Math.random() * 30) + '%';
      c.style.opacity = String(0.25 + Math.random() * 0.35);
      c.style.animationDuration = (60 + Math.random() * 70) + 's';
      c.style.animationDelay = (-Math.random() * 60) + 's';
      c.style.animationName = Math.random() > 0.5 ? 'mbDrift' : 'mbDrift2';
      w.appendChild(c);
    }
    for (var b = 0; b < o.birds; b++) {
      var bird = document.createElement('div');
      bird.className = 'ambBird';
      bird.textContent = '🐦';
      bird.style.top = (8 + Math.random() * 18) + '%';
      bird.style.animationDuration = (26 + Math.random() * 22) + 's';
      bird.style.animationDelay = (-Math.random() * 30) + 's';
      w.appendChild(bird);
    }
    for (var m = 0; m < o.motes; m++) {
      var mo = document.createElement('div');
      mo.className = 'ambMote';
      mo.style.left = (6 + Math.random() * 88) + '%';
      mo.style.top = (45 + Math.random() * 45) + '%';
      mo.style.animationDuration = (5 + Math.random() * 6) + 's';
      mo.style.animationDelay = (-Math.random() * 8) + 's';
      w.appendChild(mo);
    }
    host.appendChild(w);
  }

  window.Motion = {
    sky: sky,
    farm: function (host) { sky(host, { clouds: 3, birds: 0, motes: 10, ray: true }); },
    arena: function (host) { sky(host, { clouds: 2, birds: 0, motes: 6, ray: true }); },
    /* 給設施上動態類別 */
    tag: function (el, kind) {
      style();
      if (!el) return;
      if (kind === 'tree') el.classList.add('sway');
      else if (kind === 'ride') el.classList.add('bob');
      else if (kind === 'pond') el.classList.add('pond');
      else el.classList.add('glow');
    }
  };
})();
