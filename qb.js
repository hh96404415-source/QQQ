/* qb.js — 題庫本機版（Firebase 一次抓、之後本機抽題，答題 0 延遲）
   設計：
   - 題庫唯一來源仍然是 Sheet(Questions_AI)；GAS 的 fbSync() 把它切成「年級×科目」小包寫進 Firebase。
   - 這支只「讀」Firebase：開場抓 _meta，版本沒變就用 localStorage 快取，變了才重抓有變的包。
   - 抽題、去重、答對不再出，全部在本機做 → 不再等 GAS 掃 3984 列。
   對外：window.QB = { load, ready, version, pick, stats, fetchMisses } */
(function () {
  var FB = 'https://qqquest-2e36a-default-rtdb.asia-southeast1.firebasedatabase.app/bank/v1';
  var CACHE_KEY = 'dsh_qb_v1';
  var DONE_KEY = 'dsh_ans_done';

  var meta = null;         // {version, count, levels:{1:{Chinese:n,...}}}
  var buckets = {};        // "1|Chinese" -> {q:{id:[text,opts,ans,skill]}}
  var loading = false;
  var failed = false;
  var waiters = [];

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.version && c.buckets) return c;
    } catch (e) { }
    return null;
  }
  function writeCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ version: meta.version, buckets: buckets, saved: Date.now() }));
    } catch (e) { /* 空間不足就算了，下次重抓 */ }
  }
  function getJson(url, cb) {
    var x = new XMLHttpRequest();
    x.open('GET', url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), true);
    x.timeout = 15000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      if (x.status >= 200 && x.status < 300) {
        var d = null;
        try { d = JSON.parse(x.responseText || 'null'); } catch (e) { d = null; }
        cb(null, d);
      } else {
        cb('HTTP ' + x.status, null);
      }
    };
    x.send();
  }

  function done() {
    loading = false;
    var list = waiters.slice(); waiters = [];
    list.forEach(function (f) { try { f(); } catch (e) { } });
  }

  function load(cb) {
    if (meta && Object.keys(buckets).length) { if (cb) cb(); return; }
    if (cb) waiters.push(cb);
    if (loading) return;
    loading = true;
    failed = false;

    getJson(FB + '/_meta.json', function (err, m) {
      if (err || !m || !m.levels || !m.version) { failed = true; done(); return; }
      var cached = readCache();
      if (cached && cached.version === m.version) {
        meta = m; buckets = cached.buckets; done(); return;
      }
      var need = [];
      Object.keys(m.levels).forEach(function (lv) {
        var set = m.levels[lv];
        if (!set || typeof set !== 'object') return;   /* RTDB 會把純數字 key 存成陣列（第 0 格是 null） */
        Object.keys(set).forEach(function (sub) { need.push(lv + '|' + sub); });
      });
      var left = need.length;
      if (!left) { meta = m; done(); return; }
      need.forEach(function (key) {
        var p = key.split('|');
        var url = FB + '/L' + p[0] + '/' + p[1] + '.json';
        getJson(url, function (e2, doc) {
          if (!e2 && doc && doc.q) buckets[key] = doc;
          if (--left === 0) {
            meta = m;
            if (Object.keys(buckets).length) writeCache();
            done();
          }
        });
      });
    });
  }

  function list(level, subject) {
    var key = String(level || 1) + '|' + subject;
    var doc = buckets[key];
    if (!doc || !doc.q) return [];
    return doc.q;
  }

  function doneSet() {
    try {
      var a = JSON.parse(localStorage.getItem(DONE_KEY) || '[]');
      var s = {};
      for (var i = 0; i < a.length; i++) s[String(a[i])] = 1;
      return s;
    } catch (e) { return {}; }
  }
  function markDone(qid) {
    if (!qid) return;
    try {
      var a = JSON.parse(localStorage.getItem(DONE_KEY) || '[]');
      if (a.indexOf(qid) < 0) a.push(qid);
      if (a.length > 4000) a = a.slice(a.length - 4000);
      localStorage.setItem(DONE_KEY, JSON.stringify(a));
    } catch (e) { }
  }

  // 抽 n 題：先排除「答對過」的，不夠才放寬
  function pick(level, subject, n) {
    var q = list(level, subject);
    var ids = Object.keys(q);
    if (!ids.length) return [];
    var doneMap = doneSet();
    var fresh = [], stale = [];
    for (var i = 0; i < ids.length; i++) {
      (doneMap[ids[i]] ? stale : fresh).push(ids[i]);
    }
    function shuffle(a) {
      for (var j = a.length - 1; j > 0; j--) {
        var k = (Math.random() * (j + 1)) | 0; var t = a[j]; a[j] = a[k]; a[k] = t;
      }
      return a;
    }
    var want = Math.max(1, n || 12);
    var take = shuffle(fresh.slice()).slice(0, want);
    if (take.length < want) take = take.concat(shuffle(stale.slice()).slice(0, want - take.length));
    return take.map(function (id) {
      var it = q[id];
      return {
        id: id, text: it[0], options: it[1], answer: it[2], skill: it[3] || '',
        subject: subject, level: Number(level) || 1
      };
    });
  }

  window.QB = {
    load: load,
    ready: function () { return !!(meta && Object.keys(buckets).length); },
    version: function () { return meta ? meta.version : ''; },
    error: function () { return failed; },
    pick: pick,
    markDone: markDone,
    stats: function () {
      var out = { version: meta ? meta.version : '', buckets: {} };
      Object.keys(buckets).forEach(function (k) {
        out.buckets[k] = buckets[k] && buckets[k].q ? Object.keys(buckets[k].q).length : 0;
      });
      return out;
    }
  };
})();
