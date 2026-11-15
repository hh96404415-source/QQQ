/* qb.js — 題庫本機版（Firebase 一次抓、之後本機抽題，答題 0 延遲）
   設計：
   - 題庫唯一來源仍然是 Sheet(Questions_AI)；GAS 的 fbSync() 把它切成「年級×科目」小包寫進 Firebase。
   - 這支只「讀」Firebase：開場抓 _meta，版本沒變就用 localStorage 快取，變了才重抓。
   - 「答對不再出」的紀錄存在雲端（Firebase done/u{user_id}），換裝置也接得上；
     寫入走 GAS 的 doneAdd（因為 Firebase 只開放讀），批次送出、失敗會重試。
   對外：window.QB = { load, setUser, ready, version, pick, markDone, flush, stats } */
(function () {
  var FB_BASE = 'https://qqquest-2e36a-default-rtdb.asia-southeast1.firebasedatabase.app';
  var FB = FB_BASE + '/bank/v1';
  var GAS_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbydbycnfQsKkirktxFhKOB9p847SlW3e7Jd8oudLykEgkh_zp4ATPde4XIc476JcWNl/exec';
  var TOKEN_DEFAULT = 'IidSHWtXoAU4RfyDZrlhYeTQq6gxFm5j7JkuVwGC';

  var CACHE_KEY = 'dsh_qb_v1';
  var DONE_KEY = 'dsh_ans_done';      // 本機鏡像（離線用）

  var meta = null;
  var buckets = {};
  var loading = false;
  var failed = false;
  var waiters = [];

  var uid = '';
  var doneMap = {};
  var pending = [];
  var flushTimer = null;

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
    } catch (e) { }
  }
  function localDone() {
    try {
      var a = JSON.parse(localStorage.getItem(DONE_KEY) || '[]');
      var s = {};
      for (var i = 0; i < a.length; i++) s[String(a[i])] = 1;
      return s;
    } catch (e) { return {}; }
  }
  function saveLocalDone() {
    try { localStorage.setItem(DONE_KEY, JSON.stringify(Object.keys(doneMap))); } catch (e) { }
  }
  function gasCfg() {
    var c = {};
    try { c = JSON.parse(localStorage.getItem('dsh_qa') || '{}') || {}; } catch (e) { c = {}; }
    return { url: c.url || GAS_URL_DEFAULT, token: c.token || TOKEN_DEFAULT };
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
    x.onerror = function () { cb('network', null); };
    x.ontimeout = function () { cb('timeout', null); };
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
        getJson(FB + '/L' + p[0] + '/' + p[1] + '.json', function (e2, doc) {
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

  /* 設定目前的孩子：把雲端「答對過」清單載進來（跨裝置一致） */
  function setUser(u) {
    uid = String(u || '');
    if (!/^\d+$/.test(uid)) return;
    var local = localDone();
    Object.keys(local).forEach(function (k) { doneMap[k] = 1; });
    getJson(FB_BASE + '/done/u' + uid + '.json', function (e, d) {
      if (e || !d) return;
      Object.keys(d).forEach(function (k) { doneMap[k] = 1; });
      saveLocalDone();
    });
  }

  function flush(cb) {
    if (!pending.length || !/^\d+$/.test(uid)) { if (cb) cb(true); return; }
    var batch = pending.slice();
    pending = [];
    var cfg = gasCfg();
    var x = new XMLHttpRequest();
    x.open('POST', cfg.url, true);
    x.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
    x.timeout = 20000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var ok = x.status >= 200 && x.status < 300;
      if (!ok) pending = batch.concat(pending);   /* 失敗就留著，下次再送 */
      if (cb) cb(ok);
    };
    x.onerror = function () { pending = batch.concat(pending); if (cb) cb(false); };
    x.send(JSON.stringify({ token: cfg.token, action: 'doneAdd', user_id: Number(uid), qids: batch }));
  }

  function markDone(qid) {
    if (!qid) return;
    doneMap[qid] = 1;
    pending.push(qid);
    saveLocalDone();
    if (pending.length >= 5) { flush(); return; }
    if (!flushTimer) {
      flushTimer = setTimeout(function () { flushTimer = null; flush(); }, 8000);
    }
  }

  function list(level, subject) {
    var key = String(level || 1) + '|' + subject;
    var doc = buckets[key];
    if (!doc || !doc.q) return [];
    return doc.q;
  }

  // 抽 n 題：先排除「答對過」的，不夠才放寬
  function pick(level, subject, n) {
    var q = list(level, subject);
    var ids = Object.keys(q);
    if (!ids.length) return [];
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
    setUser: setUser,
    ready: function () { return !!(meta && Object.keys(buckets).length); },
    version: function () { return meta ? meta.version : ''; },
    error: function () { return failed; },
    pick: pick,
    markDone: markDone,
    flush: flush,
    stats: function () {
      var out = { version: meta ? meta.version : '', uid: uid, done: Object.keys(doneMap).length, pending: pending.length, buckets: {} };
      Object.keys(buckets).forEach(function (k) {
        out.buckets[k] = buckets[k] && buckets[k].q ? Object.keys(buckets[k].q).length : 0;
      });
      return out;
    }
  };
})();
