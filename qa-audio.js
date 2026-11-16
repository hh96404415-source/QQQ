/* qa-audio.js — 題目語音（粵語→國語；英文題：英文選項→粵→國）
   設計：
   - 音檔全部預先生成（edge-tts），放在 jsDelivr CDN，$0 流量、不佔 Pages。
   - 每題附「逐字時間碼」→ 讀到哪個字，哪個字變色（卡拉 OK）。
   - 按了才讀；任何觸碰／換題／答題，立即停止（全站只有一個 <audio>）。
   對外：window.QAudio = { mount, play, stop, ready } */
(function () {
  /* 主：jsDelivr（快、有邊緣快取）；備：raw.githubusercontent（jsDelivr 未收錄時救急） */
  var CDNS = [
    'https://cdn.jsdelivr.net/gh/hh96404415-source/QQQ-audio@main/',
    'https://raw.githubusercontent.com/hh96404415-source/QQQ-audio/main/'
  ];
  var base = CDNS[0];

  var cache = {};        /* bucketKey -> { qid: {disp, clips} } */
  var loading = {};
  var audio = new Audio();
  audio.preload = 'auto';
  var pre = new Audio();           /* 預抓下一段，避免粵→國之間停頓 */
  pre.preload = 'auto';

  var raf = null, ctx = null, playing = false, btnEl = null;

  function bkey(level, subject) {
    var L = Number(level);
    if (!isFinite(L) || L < 0) L = 0;
    return 'L' + L + '_' + subject;
  }

  function getJson(url, cb) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.timeout = 12000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status >= 200 && x.status < 300) {
        var d = null;
        try { d = JSON.parse(x.responseText || 'null'); } catch (e) { d = null; }
        cb(null, d);
      } else cb('HTTP ' + x.status, null);
    };
    x.onerror = function () { cb('net', null); };
    x.ontimeout = function () { cb('timeout', null); };
    x.send();
  }

  function loadBucket(key, cb) {
    if (cache[key]) { cb(cache[key]); return; }
    if (loading[key]) { setTimeout(function () { loadBucket(key, cb); }, 120); return; }
    loading[key] = true;
    (function attempt(i) {
      getJson(CDNS[i] + 'manifest/' + key + '.json', function (err, d) {
        if ((err || !d) && i + 1 < CDNS.length) { attempt(i + 1); return; }
        loading[key] = false;
        if (!err && d && d.q && i > 0) base = CDNS[i];   /* 這台機器 jsDelivr 不行 → 改用 raw */
        cache[key] = (!err && d && d.q) ? d.q : {};
        cb(cache[key]);
      });
    })(CDNS.indexOf(base) >= 0 ? CDNS.indexOf(base) : 0);
  }

  function entry(qid, level, subject) {
    var b = cache[bkey(level, subject)];
    return (b && b[qid]) || null;
  }

  function stop() {
    try { audio.pause(); audio.currentTime = 0; } catch (e) { }
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    playing = false;
    if (btnEl) btnEl.classList.remove('playing');
    if (ctx) {
      ctx.spans.forEach(function (s) { s.classList.remove('on', 'done'); });
      ctx.opts.forEach(function (b) { if (b) b.classList.remove('qsaying'); });
    }
  }

  /* 把題目文字改成 span（用伺服器切好的 disp，索引才對得上時間碼） */
  function buildSpans(e) {
    var disp = e.disp || [];
    var optStart = disp.length;
    for (var i = 0; i < e.clips.length; i++) {
      if (e.clips[i].lang === 'en' && e.clips[i].marks && e.clips[i].marks.length) {
        var m = e.clips[i].marks, mn = disp.length;
        for (var k = 0; k < m.length; k++) if (m[k][2] < mn) mn = m[k][2];
        optStart = mn;
      }
    }
    return { disp: disp, optStart: optStart };
  }

  function paint(c) {
    var spans = ctx.spans, opts = ctx.opts, optStart = ctx.optStart;
    var marks = c.marks || [];
    function tick() {
      if (!playing) return;
      var t = audio.currentTime * 1000;
      var act = -1;
      for (var i = 0; i < marks.length; i++) {
        var mk = marks[i];
        if (t >= mk[1]) mark(mk[2], 'done');
        if (t >= mk[0] && t < mk[1]) act = mk[2];
      }
      ctx.spans.forEach(function (s) { s.classList.remove('on'); });
      opts.forEach(function (b) { if (b) b.classList.remove('qsaying'); });
      if (act >= 0) mark(act, 'on');
      raf = requestAnimationFrame(tick);
    }
    function mark(idx, cls) {
      if (idx < optStart) {
        var s = spans[idx];
        if (s) { s.classList.remove('done'); s.classList.add(cls); }
      } else {
        var b = opts[idx - optStart];
        if (!b) return;
        if (b) {
          if (cls === 'on') { b.classList.remove('done'); b.classList.add('qsaying'); b.classList.add('done'); }
          else b.classList.add('done');
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function playSeq(clips, i) {
    i = i || 0;
    if (i >= clips.length) {
      playing = false; if (raf) { cancelAnimationFrame(raf); raf = null; }
      if (btnEl) btnEl.classList.remove('playing');
      if (ctx) { ctx.spans.forEach(function (s) { s.classList.remove('on'); }); ctx.opts.forEach(function (b) { b.classList.remove('qsaying'); }); }
      return;
    }
    var c = clips[i];
    audio.src = base + c.f;
    if (clips[i + 1]) { try { pre.src = base + clips[i + 1].f; pre.load(); } catch (e) { } }
    audio.play().catch(function () { });
    paint(c);
    audio.onended = function () {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      setTimeout(function () { playSeq(clips, i + 1); }, 260);
    };
  }

  function unmount() {
    stop();
    ctx = null;
    if (btnEl) { btnEl.style.display = 'none'; btnEl.classList.remove('on', 'playing'); }
  }

  /* mount：qEl=題目元素、opts=選項按鈕陣列、btn=🔊 按鈕 */
  function mount(o) {
    stop();
    ctx = null;
    btnEl = o.btn || null;
    if (o.btn) o.btn.classList.remove('on', 'playing');
    var key = bkey(o.level, o.subject);
    loadBucket(key, function (bucket) {
      var e = bucket[o.qid];
      if (!e || !e.clips || !e.clips.length) { if (o.btn) o.btn.style.display = 'none'; return; }
      if (o.plain) {   /* 寫字題：畫面文字與朗讀稿不同，只播不畫 */
        ctx = { spans: [], opts: [], optStart: 1e9, clips: e.clips, qid: o.qid };
        if (o.btn) { o.btn.style.display = ''; o.btn.classList.add('on'); }
        return;
      }
      var info = buildSpans(e);
      var html = '';
      for (var i = 0; i < info.disp.length; i++) {
        if (i >= info.optStart) break;
        html += '<span>' + esc(info.disp[i]) + '</span>';
      }
      o.qEl.innerHTML = html;
      var spans = o.qEl.querySelectorAll('span');
      var optEls = [];
      for (var j = info.optStart; j < info.disp.length; j++) {
        var want = String(info.disp[j]).trim();
        var found = null;
        for (var k = 0; k < o.opts.length; k++) {
          if (String(o.opts[k].textContent).trim() === want) { found = o.opts[k]; break; }
        }
        optEls.push(found);
      }
      ctx = { spans: spans, opts: optEls, optStart: info.optStart, clips: e.clips, qid: o.qid };
      if (o.btn) { o.btn.style.display = ''; o.btn.classList.add('on'); }
    });
  }

  function play() {
    if (!ctx) return false;
    stop();
    playing = true;
    if (btnEl) btnEl.classList.add('playing');
    ctx.spans.forEach(function (s) { s.classList.remove('on', 'done'); });
    playSeq(ctx.clips, 0);
    return true;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* 任何觸碰立即停（capture 先於按鈕自己的 click，所以按 🔊 會先停再播，不會疊音） */
  document.addEventListener('pointerdown', function () { if (playing) stop(); }, true);
  window.addEventListener('blur', function () { if (playing) stop(); });

  window.QAudio = {
    mount: mount,
    unmount: unmount,
    play: play,
    stop: stop,
    ready: function (qid, level, subject) { return !!entry(qid, level, subject); }
  };
})();
