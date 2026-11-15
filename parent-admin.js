/* ──────────────────────────────────────────────────────────────
   parent-admin.js — 家長管理面板（家庭成員 / 封印清單 / 金幣 / 裝置）
   ──────────────────────────────────────────────────────────────
   後端合約（GAS-V2-Code.gs，全部走 POST {token,action,...}）：
   · listUsers(family_id) → {users:[rowToObj...]}
   · addUser(family_id,{pin,display_name,grade,age,avatar}) → {user_id,pin,display_name}
   · updateUser(user_id,{Display_Name/Grade/PIN...}) → {changed}
   · deactivateUser/activateUser(user_id) → {active}
   · coinLedger(user_id,limit) → {entries:[{delta,balance_after,source,created_at}]}
   · earnCoins(user_id,n,source) → {earned,coins}（單次上限 100）
   · listBlocklist(family_id) → {global[],family[],effective{block[],allow[],rev}}
   · setBlocklist(family_id,domain,category,action,active) → {created/updated}
   · delBlocklist(blocklist_id) → {deleted}
   · listDevices(family_id) → {devices:[{device_mac,device_name,role,mode,remaining_sec,user_id}]}
   · removeDevice(device_id) → {deleted}
   ────────────────────────────────────────────────────────────── */
(function () {
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbydbycnfQsKkirktxFhKOB9p847SlW3e7Jd8oudLykEgkh_zp4ATPde4XIc476JcWNl/exec';
  var TOKEN = 'IidSHWtXoAU4RfyDZrlhYeTQq6gxFm5j7JkuVwGC';
  var FAMILY_ID = 1;

  function cfg() {
    var o = {};
    try { o = JSON.parse(localStorage.getItem('dsh_qa') || '{}') || {}; } catch (e) {}
    var token = (o.token && o.token !== 'CHANGE_ME_TO_A_RANDOM_LONG_STRING') ? o.token : TOKEN;
    return { url: o.url || GAS_URL, token: token };
  }

  function post(action, params, cb) {
    var c = cfg();
    var body = { token: c.token, action: action };
    for (var k in params) if (params[k] !== undefined) body[k] = params[k];
    fetch(c.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).then(function (r) { return r.json(); }).then(function (d) { cb(null, d); })
      .catch(function (e) { cb(e, null); });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function fmtTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return esc(iso);
      var p = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (e) { return esc(iso); }
  }

  /* ── 主入口：把管理面板灌進 host ────────────────────────────── */
  function mount(host, familyId) {
    if (!host || document.getElementById('paRoot')) return null;
    FAMILY_ID = Number(familyId) || FAMILY_ID;

    var root = document.createElement('div');
    root.id = 'paRoot';
    root.innerHTML =
      '<div class="paTabs" id="paTabs">' +
        '<button class="paTab on" data-t="members">👧 成員</button>' +
        '<button class="paTab" data-t="block">🛡️ 封印</button>' +
        '<button class="paTab" data-t="coins">💰 金幣</button>' +
        '<button class="paTab" data-t="devices">📱 裝置</button>' +
      '</div>' +
      '<div class="paBody" id="paBody"></div>' +
      '<div class="paMsg" id="paMsg"></div>';
    host.appendChild(root);
    installStyles();

    var body = document.getElementById('paBody');
    var msg = document.getElementById('paMsg');
    var tabs = document.getElementById('paTabs');
    var cur = 'members';

    function setMsg(t, ok) {
      msg.textContent = t || '';
      msg.className = 'paMsg' + (ok === false ? ' bad' : '');
      if (t) setTimeout(function () { if (msg.textContent === t) { msg.textContent = ''; } }, 4000);
    }

    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.paTab');
      if (!b) return;
      cur = b.getAttribute('data-t');
      var all = tabs.querySelectorAll('.paTab');
      for (var i = 0; i < all.length; i++) all[i].className = 'paTab' + (all[i] === b ? ' on' : '');
      render();
    });

    function render() {
      body.innerHTML = '<div class="paLoading">載入中…</div>';
      if (cur === 'members') renderMembers(body, setMsg);
      else if (cur === 'block') renderBlock(body, setMsg);
      else if (cur === 'coins') renderCoins(body, setMsg);
      else if (cur === 'devices') renderDevices(body, setMsg);
    }

    render();
    return root;
  }

  /* ── 成員 ── */
  function renderMembers(host, setMsg) {
    post('listUsers', { family_id: FAMILY_ID }, function (err, d) {
      if (err) { host.innerHTML = '<div class="paErr">連不上：' + esc(err) + '</div>'; return; }
      if (!d || !d.ok) { host.innerHTML = '<div class="paErr">' + esc(d && d.error || '錯誤') + '</div>'; return; }
      var us = d.users || [];
      var rows = us.map(function (u) {
        var active = (u.Active === true || u.Active === 'true' || u.Active === 'TRUE' || u.Active === 1);
        var coins = (u['Points_分'] == null || u['Points_分'] === '') ? 0 : u['Points_分'];
        return '<div class="paRow">' +
          '<div class="paRowMain">' +
            '<div class="paRowName">' + esc(u.Avatar || '🐲') + ' ' + esc(u.Display_Name || u.PIN) +
              (active ? '' : ' <span class="paTag off">停用</span>') + '</div>' +
            '<div class="paRowSub">PIN ' + esc(u.PIN) + ' · ' + esc(u.Grade || '—') + ' · 💰 ' + coins + ' · 等級 ' + esc(u.Level || 1) + '</div>' +
          '</div>' +
          '<div class="paRowBtns">' +
            '<button class="paBtn sm" data-act="toggle" data-id="' + esc(u.User_ID) + '" data-active="' + active + '">' + (active ? '停用' : '啟用') + '</button>' +
            '<button class="paBtn sm" data-act="coins" data-id="' + esc(u.User_ID) + '" data-name="' + esc(u.Display_Name || '') + '">+金幣</button>' +
          '</div>' +
        '</div>';
      }).join('');

      host.innerHTML =
        '<div class="paCard">' +
          '<div class="paCardHead">家庭成員 <span class="paCount">' + us.length + ' 人</span></div>' +
          (rows || '<div class="paEmpty">還沒有孩子帳號</div>') +
        '</div>' +
        '<div class="paCard">' +
          '<div class="paCardHead">新增孩子</div>' +
          '<div class="paForm">' +
            '<input class="paInput" id="paName" placeholder="名字（例：小明）" maxlength="20">' +
            '<input class="paInput" id="paPin" placeholder="6 位數字 PIN" inputmode="numeric" maxlength="6">' +
            '<input class="paInput short" id="paGrade" placeholder="年級 P2" maxlength="8">' +
            '<button class="paBtn" id="paAdd">新增</button>' +
          '</div>' +
          '<div class="paHint">孩子 PIN 6 位</div>' +
        '</div>' +
        '<div class="paCard">' +
          '<div class="paCardHead">家長 PIN（8 位）</div>' +
          '<div class="paForm">' +
            '<input class="paInput" id="paOldPin" placeholder="舊家長 PIN（8 位）" inputmode="numeric" maxlength="8">' +
            '<input class="paInput" id="paNewPin" placeholder="新家長 PIN（8 位）" inputmode="numeric" maxlength="8">' +
            '<button class="paBtn" id="paSetPin">更改</button>' +
          '</div>' +
          '<div class="paHint">孩子 6 位、家長 8 位：長度不同就不會撞，別的家長也不會按錯進到你們家。</div>' +
        '</div>';

      // 綁定列按鈕
      var btns = host.querySelectorAll('.paRowBtns .paBtn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function () {
          var act = this.getAttribute('data-act');
          var id = this.getAttribute('data-id');
          if (act === 'toggle') {
            var cur = this.getAttribute('data-active') === 'true';
            this.disabled = true;
            post(cur ? 'deactivateUser' : 'activateUser', { user_id: Number(id) }, function (e2, d2) {
              if (e2 || !d2 || !d2.ok) { setMsg((d2 && d2.error) || '失敗', false); return; }
              setMsg('已' + (cur ? '停用' : '啟用'));
              renderMembers(host, setMsg);
            });
          } else if (act === 'coins') {
            var name = this.getAttribute('data-name');
            addCoinsPrompt(host, setMsg, Number(id), name);
          }
        });
      }

      document.getElementById('paAdd').addEventListener('click', function () {
        var name = document.getElementById('paName').value.trim();
        var pin = document.getElementById('paPin').value.trim();
        var grade = document.getElementById('paGrade').value.trim();
        if (!name || !/^\d{6}$/.test(pin)) { setMsg('名字＋6 位數字 PIN 都要填', false); return; }
        post('addUser', { family_id: FAMILY_ID, pin: pin, display_name: name, grade: grade }, function (e2, d2) {
          if (e2 || !d2 || !d2.ok) { setMsg((d2 && d2.error) || '新增失敗', false); return; }
          setMsg('已新增 ' + d2.display_name + '（PIN ' + d2.pin + '）');
          renderMembers(host, setMsg);
        });
      });
      document.getElementById('paSetPin').addEventListener('click', function () {
        var oldp = document.getElementById('paOldPin').value.trim();
        var newp = document.getElementById('paNewPin').value.trim();
        if (!/^\d{8}$/.test(oldp) || !/^\d{8}$/.test(newp)) { setMsg('舊、新 PIN 都要 8 位數字', false); return; }
        var btn = this;
        btn.disabled = true;
        post('setParentPin', { family_id: FAMILY_ID, old_pin: oldp, new_pin: newp }, function (e2, d2) {
          btn.disabled = false;
          if (e2 || !d2 || !d2.ok) { setMsg((d2 && d2.error) || '更改失敗', false); return; }
          setMsg('家長 PIN 已更新，下次登入請用新 PIN');
          try { localStorage.removeItem('dsh_parent_sess'); } catch (e) {}
        });
      });
    });
  }

  function addCoinsPrompt(host, setMsg, userId, name) {
    // 用 modal 取代 prompt，避免 iOS 阻擋
    var m = document.createElement('div');
    m.className = 'paMask';
    m.innerHTML = '<div class="paModal">' +
      '<div class="paModalHead">給 ' + esc(name) + ' 加金幣</div>' +
      '<div class="paModalBody">' +
        '<input class="paInput" id="paCoinN" type="number" min="1" max="100" value="25" inputmode="numeric">' +
        '<input class="paInput" id="paCoinSrc" placeholder="原因（預設 answer）" maxlength="30">' +
      '</div>' +
      '<div class="paModalBtns">' +
        '<button class="paBtn ghost" id="paCoinCancel">取消</button>' +
        '<button class="paBtn" id="paCoinOk">確認</button>' +
      '</div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    function close() { m.parentNode.removeChild(m); }
    document.getElementById('paCoinCancel').addEventListener('click', close);
    document.getElementById('paCoinOk').addEventListener('click', function () {
      var n = Number(document.getElementById('paCoinN').value) || 0;
      var src = document.getElementById('paCoinSrc').value.trim() || 'answer';
      if (n <= 0) { setMsg('金幣要正數', false); return; }
      post('earnCoins', { user_id: userId, n: n, source: src }, function (e2, d2) {
        if (e2 || !d2 || !d2.ok) { setMsg((d2 && d2.error) || '失敗', false); return; }
        setMsg('已 +' + d2.earned + ' 金幣（現在 ' + d2.coins + '）');
        close();
      });
    });
  }

  /* ── 封印 ── */
  function renderBlock(host, setMsg) {
    post('listBlocklist', { family_id: FAMILY_ID }, function (err, d) {
      if (err) { host.innerHTML = '<div class="paErr">連不上：' + esc(err) + '</div>'; return; }
      if (!d || !d.ok) { host.innerHTML = '<div class="paErr">' + esc(d && d.error || '錯誤') + '</div>'; return; }

      var own = d.family || [];
      var eff = d.effective || { block: [], allow: [], rev: '' };
      var ownRows = own.map(function (r) {
        var isBlock = (r.action || 'block') === 'block';
        return '<div class="paRow">' +
          '<div class="paRowMain">' +
            '<div class="paRowName">' + (isBlock ? '🚫' : '✅') + ' ' + esc(r.domain) +
              ' <span class="paTag ' + (isBlock ? 'block' : 'allow') + '">' + (isBlock ? '封' : '放行') + '</span>' +
              (r.category ? ' <span class="paDim">' + esc(r.category) + '</span>' : '') + '</div>' +
            '<div class="paRowSub">' + (r.active === false || r.active === 'false' ? '已停用' : '生效中') + '</div>' +
          '</div>' +
          '<div class="paRowBtns"><button class="paBtn sm" data-del="' + esc(r.blocklist_id) + '">刪除</button></div>' +
        '</div>';
      }).join('');

      host.innerHTML =
        '<div class="paCard">' +
          '<div class="paCardHead">家庭封印 <span class="paCount">封 ' + eff.block.length + ' · 放行 ' + eff.allow.length + '</span></div>' +
          (ownRows || '<div class="paEmpty">還沒自訂規則（用全域預設）</div>') +
        '</div>' +
        '<div class="paCard">' +
          '<div class="paCardHead">新增／覆寫規則</div>' +
          '<div class="paForm">' +
            '<input class="paInput" id="paDom" placeholder="域名（例：youtube.com）">' +
            '<select class="paInput short" id="paAct"><option value="block">🚫 封鎖</option><option value="allow">✅ 放行</option></select>' +
            '<input class="paInput short" id="paCat" placeholder="類別（影音）">' +
            '<button class="paBtn" id="paSet">套用</button>' +
          '</div>' +
          '<div class="paNote">「放行」優先於「封鎖」。全域預設（成人/賭博）由 AdGuard 負責，此處只管影音/遊戲。</div>' +
        '</div>';

      var dels = host.querySelectorAll('[data-del]');
      for (var i = 0; i < dels.length; i++) {
        dels[i].addEventListener('click', function () {
          var id = this.getAttribute('data-del');
          this.disabled = true;
          post('delBlocklist', { blocklist_id: id }, function (e2, d2) {
            if (e2 || !d2 || !d2.ok) { setMsg((d2 && d2.error) || '刪除失敗', false); return; }
            setMsg('已刪除');
            renderBlock(host, setMsg);
          });
        });
      }
      document.getElementById('paSet').addEventListener('click', function () {
        var dom = document.getElementById('paDom').value.trim();
        var act = document.getElementById('paAct').value;
        var cat = document.getElementById('paCat').value.trim();
        if (!dom) { setMsg('域名不可空白', false); return; }
        post('setBlocklist', { family_id: FAMILY_ID, domain: dom, action: act, category: cat, active: true }, function (e2, d2) {
          if (e2 || !d2 || !d2.ok) { setMsg((d2 && d2.error) || '套用失敗', false); return; }
          setMsg('已套用 ' + dom + ' → ' + (act === 'allow' ? '放行' : '封鎖'));
          renderBlock(host, setMsg);
        });
      });
    });
  }

  /* ── 金幣 ── */
  function renderCoins(host, setMsg) {
    post('listUsers', { family_id: FAMILY_ID }, function (err, d) {
      if (err) { host.innerHTML = '<div class="paErr">連不上：' + esc(err) + '</div>'; return; }
      if (!d || !d.ok) { host.innerHTML = '<div class="paErr">' + esc(d && d.error || '錯誤') + '</div>'; return; }
      var us = d.users || [];
      if (!us.length) { host.innerHTML = '<div class="paEmpty">還沒有孩子帳號</div>'; return; }
      var opts = us.map(function (u) {
        return '<option value="' + esc(u.User_ID) + '">' + esc(u.Display_Name || u.PIN) + '（💰 ' + (u['Points_分'] || 0) + '）</option>';
      }).join('');
      host.innerHTML =
        '<div class="paCard">' +
          '<div class="paCardHead">金幣帳本</div>' +
          '<div class="paForm"><select class="paInput" id="paLedgerUser">' + opts + '</select></div>' +
          '<div id="paLedger"></div>' +
        '</div>';
      var sel = document.getElementById('paLedgerUser');
      var box = document.getElementById('paLedger');
      function load() {
        box.innerHTML = '<div class="paLoading">載入中…</div>';
        post('coinLedger', { user_id: Number(sel.value), limit: 20 }, function (e2, d2) {
          if (e2 || !d2 || !d2.ok) { box.innerHTML = '<div class="paErr">' + esc((d2 && d2.error) || '錯誤') + '</div>'; return; }
          var es = d2.entries || [];
          if (!es.length) { box.innerHTML = '<div class="paEmpty">還沒流水</div>'; return; }
          var rows = es.map(function (e) {
            var plus = Number(e.delta) >= 0;
            return '<div class="paLedgerRow">' +
              '<span class="paLedgerDelta ' + (plus ? 'plus' : 'minus') + '">' + (plus ? '+' : '') + e.delta + '</span>' +
              '<span class="paLedgerSrc">' + esc(e.source || '—') + '</span>' +
              '<span class="paLedgerBal">餘 ' + e.balance_after + '</span>' +
              '<span class="paLedgerTime">' + fmtTime(e.created_at) + '</span>' +
            '</div>';
          }).join('');
          box.innerHTML = rows;
        });
      }
      sel.addEventListener('change', load);
      load();
    });
  }

  /* ── 裝置 ── */
  function renderDevices(host, setMsg) {
    post('listDevices', { family_id: FAMILY_ID }, function (err, d) {
      if (err) { host.innerHTML = '<div class="paErr">連不上：' + esc(err) + '</div>'; return; }
      if (!d || !d.ok) { host.innerHTML = '<div class="paErr">' + esc(d && d.error || '錯誤') + '</div>'; return; }
      var ds = d.devices || [];
      var rows = ds.map(function (v) {
        var isRouter = v.role === 'router';
        var mode = v.mode === 'free' ? '🎉 自由' : '🔒 學習';
        var left = v.remaining_sec ? Math.floor(v.remaining_sec / 60) + ' 分' : '';
        return '<div class="paRow">' +
          '<div class="paRowMain">' +
            '<div class="paRowName">' + (isRouter ? '📡' : '📱') + ' ' + esc(v.device_name || v.device_mac) +
              (isRouter ? ' <span class="paTag router">路由器</span>' : '') + '</div>' +
            '<div class="paRowSub">' + esc(v.device_mac) +
              (v.user_id ? ' · 孩子 ' + esc(v.user_id) : '') +
              ' · ' + mode + (left ? ' · 剩 ' + left : '') + '</div>' +
          '</div>' +
          '<div class="paRowBtns">' +
            (isRouter ? '' : '<button class="paBtn sm" data-rm="' + esc(v.device_id) + '">解除</button>') +
          '</div>' +
        '</div>';
      }).join('');
      host.innerHTML =
        '<div class="paCard">' +
          '<div class="paCardHead">已綁定裝置 <span class="paCount">' + ds.length + ' 台</span></div>' +
          (rows || '<div class="paEmpty">還沒綁定裝置</div>') +
          '<div class="paNote">孩子的平板要先用「配對碼」綁定，路由器才知道這台裝置歸誰。未綁定裝置預設封鎖（學習模式）。</div>' +
        '</div>';
      var rms = host.querySelectorAll('[data-rm]');
      for (var i = 0; i < rms.length; i++) {
        rms[i].addEventListener('click', function () {
          var id = this.getAttribute('data-rm');
          this.disabled = true;
          post('removeDevice', { device_id: id }, function (e2, d2) {
            if (e2 || !d2 || !d2.ok) { setMsg((d2 && d2.error) || '失敗', false); return; }
            setMsg('已解除綁定');
            renderDevices(host, setMsg);
          });
        });
      }
    });
  }

  /* ── 樣式 ── */
  function installStyles() {
    if (document.getElementById('paCss')) return;
    var s = document.createElement('style');
    s.id = 'paCss';
    s.textContent = [
      '#paRoot{display:flex;flex-direction:column;gap:14px}',
      '.paTabs{display:flex;gap:8px;flex-wrap:wrap}',
      '.paTab{font:inherit;font-size:14px;font-weight:900;padding:9px 16px;border-radius:999px;cursor:pointer;',
      '  background:rgba(255,255,255,.06);color:#cbd5e1;border:1px solid rgba(255,255,255,.14)}',
      '.paTab.on{background:rgba(251,191,36,.16);color:#fbbf24;border-color:rgba(251,191,36,.55)}',
      '.paTab:active{transform:translateY(1px)}',
      '.paBody{display:flex;flex-direction:column;gap:14px}',
      '.paCard{background:rgba(17,26,43,.9);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:16px 18px}',
      '.paCardHead{font-size:15px;font-weight:900;color:#f8fafc;margin-bottom:12px;display:flex;align-items:center;gap:8px}',
      '.paCount{font-size:12px;font-weight:800;color:#94a3b8}',
      '.paRow{display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid rgba(255,255,255,.07)}',
      '.paRow:first-of-type{border-top:none}',
      '.paRowMain{flex:1;min-width:0}',
      '.paRowName{font-size:15px;font-weight:900;color:#e2e8f0}',
      '.paRowSub{font-size:12.5px;color:#64748b;margin-top:3px;word-break:break-all}',
      '.paRowBtns{display:flex;gap:6px;flex-shrink:0}',
      '.paTag{font-size:11px;font-weight:900;padding:2px 8px;border-radius:999px}',
      '.paTag.block{background:rgba(239,68,68,.18);color:#fca5a5}',
      '.paTag.allow{background:rgba(34,197,94,.18);color:#86efac}',
      '.paTag.off{background:rgba(148,163,184,.18);color:#94a3b8}',
      '.paTag.router{background:rgba(56,189,248,.18);color:#7dd3fc}',
      '.paDim{font-size:12px;color:#64748b}',
      '.paBtn{font:inherit;font-size:14px;font-weight:900;padding:9px 16px;border-radius:11px;cursor:pointer;border:none;',
      '  background:linear-gradient(#fbbf24,#d97706);color:#1c1917}',
      '.paBtn.sm{font-size:12.5px;padding:6px 11px}',
      '.paBtn.ghost{background:rgba(255,255,255,.08);color:#cbd5e1}',
      '.paBtn:active{transform:scale(.95)}',
      '.paBtn:disabled{opacity:.5}',
      '.paForm{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.paInput{font:inherit;font-size:14px;font-weight:800;padding:9px 12px;border-radius:10px;',
      '  border:1px solid rgba(255,255,255,.15);background:rgba(15,23,42,.8);color:#e2e8f0;min-width:120px}',
      '.paInput.short{min-width:0;width:96px}',
      '.paNote{margin-top:12px;font-size:12.5px;color:#64748b;line-height:1.7}',
      '.paHint{margin-top:6px;font-size:12px;color:#64748b;line-height:1.6}',
      '.paEmpty{font-size:13.5px;color:#64748b;padding:8px 0}',
      '.paLoading{font-size:13.5px;color:#64748b;padding:10px 0}',
      '.paErr{font-size:13.5px;color:#fca5a5;padding:10px 0}',
      '.paMsg{min-height:20px;font-size:13.5px;font-weight:800;color:#86efac;text-align:center}',
      '.paMsg.bad{color:#fca5a5}',
      '.paLedgerRow{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,.06);font-size:13px}',
      '.paLedgerRow:first-of-type{border-top:none}',
      '.paLedgerDelta{flex:0 0 52px;font-weight:900}',
      '.paLedgerDelta.plus{color:#86efac}',
      '.paLedgerDelta.minus{color:#fca5a5}',
      '.paLedgerSrc{flex:1;color:#cbd5e1}',
      '.paLedgerBal{flex:0 0 auto;color:#fbbf24;font-weight:800}',
      '.paLedgerTime{flex:0 0 118px;color:#64748b;text-align:right}',
      '.paMask{position:fixed;inset:0;z-index:300;background:rgba(5,9,16,.72);display:flex;align-items:center;justify-content:center;padding:20px}',
      '.paModal{width:min(380px,100%);background:#0f172a;border:2px solid rgba(255,255,255,.14);border-radius:18px;padding:20px}',
      '.paModalHead{font-size:17px;font-weight:900;color:#fbbf24;margin-bottom:14px}',
      '.paModalBody{display:flex;flex-direction:column;gap:10px}',
      '.paModalBtns{display:flex;gap:8px;margin-top:16px;justify-content:flex-end}'
    ].join('');
    document.head.appendChild(s);
  }

  window.ParentAdmin = { mount: mount, post: post };
})();
