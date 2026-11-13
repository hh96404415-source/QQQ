/* ─────────────────────────────────────────────────────────────
   petlang.js — 寵物說話系統（三支 demo 共用）
   - 語言能力跟著進化：蛋(0) 不說話 → 幼獸(1) 2–4 字 → 成獸(2) 短句
     → 龍(3) 完整句 → 金龍(4) 會記得事情
   - 只說「現在發生的事」；不打擊、不情緒勒索、不比較
   - 一句 ≤ 12 字；冷卻 10 分鐘不重複；每分鐘最多 2 句（force 可跳過）
   - 家長設了小孩名字（localStorage['dsh_kid_name']）就叫名字
   ───────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var SAY = {
    /* 迎接 */
    greet: {
      1: ['你來了！', '等你好久', '嗨！我在這裡', '你回來了', '早安！', '我等得都快睡了'],
      2: ['今天過得怎麼樣？', '我剛剛在草地上滾', '你來了，我好開心', '我一直看著門口', '今天好嗎？', '我剛剛吃了好吃的'],
      3: ['我一直在想，你今天會不會來', '今天要去哪裡玩？', '你來了，我就開心了', '我剛才在想你', '今天有好事嗎？', '我數了雲，還沒數完你就來了'],
      4: ['我知道你會來，所以一直在等', '今天想聽我說一件事嗎？', '有你在，這裡就不無聊', '今天我把你的樣子想了一遍', '我記得你昨天走的方向', '你來的時候，風是暖的']
    },
    /* 狀態 */
    hungry: {
      1: ['肚子…咕嚕', '餓…', '想吃', '肚子叫了', '空空的', '有東西吃嗎？'],
      2: ['有一點餓了', '可以吃東西嗎？', '肚子在叫了', '我想吃點東西', '肚子扁掉了', '有一點想吃'],
      3: ['我餓了，但我不急', '聞到香味了…', '吃一點就好', '先餵我一下下', '肚子提醒我了', '等你有空再餵'],
      4: ['我餓了，先忙你的沒關係', '等你忙完再餵我', '我不吵，只是有點餓', '肚子餓是小事', '你想吃什麼？我陪你', '等等再說也可以']
    },
    bored: {
      1: ['陪我…', '想玩', '無聊', '一起玩', '好悶', '走一走'],
      2: ['想跟你玩一下', '陪我玩好嗎？', '好無聊喔', '我們去走走', '有沒有新遊戲？', '坐著好久了'],
      3: ['今天想玩點不一樣的', '我們去走一走', '陪我一下下就好', '帳篷那邊好像有新東西', '我想試試看那個', '你有想玩的嗎？'],
      4: ['我想跟你玩，但我不吵你', '有空的時候，陪我走走', '我可以等，反正我會想', '今天風很好，適合出去', '我準備好要玩了', '你決定，我都跟']
    },
    sad: {
      1: ['嗚…', '難過', '抱抱', '想哭', '陪我', '冷…'],
      2: ['我有一點難過', '可以陪我一下嗎？', '我想抱一下', '等一下好不好', '今天有點悶', '心裡怪怪的'],
      3: ['我等了好久，不過沒關係', '有一點點難過', '我想被抱一下', '沒事了，只是有點靜', '我等得有點久', '可以坐一下嗎'],
      4: ['沒事的，我知道你忙', '我在這裡，等你有空', '難過會過去，我記得', '我不怪你，真的', '安靜一下就好', '等一下下我就好了']
    },
    happy: {
      1: ['開心！', '喜歡你', '耶！', '好耶', '笑了！', '舒服'],
      2: ['今天很開心', '跟你在一起最好', '我喜歡這裡', '心情很好', '今天太陽好', '我笑了好久'],
      3: ['今天過得很好，謝謝你', '我覺得自己很幸運', '跟你在一起，時間過好快', '今天想記下來', '我很滿足', '謝謝你來'],
      4: ['有你在，每天都不一樣', '我記得每一個你來的時候', '今天值得記住', '跟你在一起，我學到很多', '我很喜歡現在的自己', '謝謝你一直都來']
    },
    fed: {
      1: ['好吃！', '還要', '謝謝…', '飽了', '好甜', '喜歡'],
      2: ['好好吃，謝謝你', '我吃飽了！', '這是我最喜歡的', '肚子滿足了', '好吃到想跳舞', '謝謝你餵我'],
      3: ['吃飽了，力氣變大了', '謝謝你記得我餓了', '這一餐好好吃', '我覺得有力氣了', '等我長大，換我照顧你', '吃飽就想動一動'],
      4: ['謝謝你，我吃得很飽', '被你照顧的感覺真好', '我記得每一餐的味道', '吃飽了，可以出發了', '這一餐我會記很久', '謝謝你，真的']
    },
    /* 答題 */
    correct: {
      1: ['好棒！', '再來！', '哇！', '對了！', '厲害', '繼續'],
      2: ['好厲害！', '你算得比我快', '再一題！', '這個我會了', '答對了，走！', '你愈來愈順'],
      3: ['你愈來愈快了', '這題我也想了一下', '這個方法好聰明', '你剛剛猶豫了一下，還是對了', '我看得出來你在想', '再難一點也可以'],
      4: ['你比我聰明多了', '看你答題，我也學會了', '你現在思考的樣子很好看', '這題對你不難了', '我喜歡看你解題', '你的進步我記得']
    },
    wrong: {
      1: ['沒關係', '再試', '加油', '慢慢來', '會好的', '別急'],
      2: ['沒關係，下一題', '我也常常算錯', '慢慢來就好', '錯了才有進步', '我們再看一次', '不痛，繼續'],
      3: ['錯了也沒關係，我陪你', '再想一下，你可以的', '這題有點狡猾', '換個方法看看', '錯了，但你會了', '我陪你慢慢看'],
      4: ['每個人都會算錯，包括我', '休息一下，再來一題', '錯的地方才是學到的地方', '你剛剛那個想法其實不錯', '我們把它拆小一點', '不用急，題目不會跑']
    },
    combo: {
      1: ['連對！', '好順！', '再來', '一直對', '發光了', '哇塞'],
      2: ['你連對了！', '愈來愈順了', '停不下來', '我看著都緊張', '太順了吧', '再連一個'],
      3: ['你是不是偷偷練過？', '我開始緊張了', '這個節奏很好', '我數著你連對幾題', '你今天的狀態不一樣', '穩住，快到了'],
      4: ['這種連對，我記住了', '你今天的狀態特別好', '我感覺你在發光', '你找到了自己的節奏', '連對的時候，時間變快', '我會記得這一段']
    },
    /* 下棋 */
    win: {
      1: ['我們贏了！', '贏了！', '好耶！', '太棒了', '打倒了！', '勝利！'],
      2: ['我們贏了，好開心！', '你保護了我', '剛剛那一下好帥', '我們配合得很好', '再打一隻', '我們是最強的'],
      3: ['剛剛那個有點可怕，可是你在', '謝謝你帶我打贏', '我愈來愈會打了', '這一場我記住了', '我們愈來愈有默契', '再來，我不怕了'],
      4: ['每一次都是你在前面，我記得', '跟你一起，我什麼都不怕', '你已經不需要我保護了', '我們贏過很多次了', '這一場也值得記住', '謝謝你一直帶著我']
    },
    lose: {
      1: ['再試！', '差一點', '加油', '不哭', '再來', '沒關係'],
      2: ['差一點點！', '再試一次就好', '下一次一定贏', '我還有力氣', '我們再打一次', '別灰心'],
      3: ['這局輸了，但你有進步', '我看到你差一步', '下次換個順序試試', '輸了也知道怎麼輸的', '我陪你檢討一下', '再一局，我準備好了'],
      4: ['輸贏都會過去，我記得你怎麼下', '再來，我陪你', '這一局教了我們東西', '你剛剛的判斷已經很好了', '輸的時候你還在想辦法', '我們離贏很近']
    },
    draw: {
      2: ['平手也很厲害', '誰都沒輸，很好', '打成平手！', '我們一樣強'],
      3: ['這樣也算扯平了', '再一局分高下', '平手，很公平', '誰也沒讓誰'],
      4: ['平手最難，因為誰都沒放棄', '再一局，我想贏你']
    },
    /* 里程碑（一輩子一次，force 顯示） */
    hatch: {
      1: ['我…出來了。', '你就是我的主人嗎？', '好亮…這是哪裡？', '我剛剛在裡面聽你說話']
    },
    evolve: {
      2: ['我好像…長大了一點', '我是不是變高了？', '我的尾巴變長了！', '我可以跳得更高了'],
      3: ['我變強了，可以保護你了', '我記得小時候的樣子', '現在換我走在前面', '我感覺得到自己的力量'],
      4: ['我不是原來那隻，但我還是我', '走過這麼多，我還在這裡', '謝謝你陪我變成這樣', '我記得每一階段的自己']
    },
    /* 時段 */
    night: {
      1: ['要睡覺了…', '晚安', '想睡了', '眼睛好重'],
      2: ['天黑了，早點睡', '晚安，明天見', '該睡了，明天再玩', '夜裡風變涼了'],
      3: ['夜深了，明天再玩', '去睡吧，我守著', '明天見，我會記得今天', '晚安，做個好夢'],
      4: ['好好休息，明天見', '晚安，我會記得今天', '睡吧，我把燈留著', '明天醒來，我還在這']
    }
  };

  /* 這幾種情境會叫名字（太常叫會膩） */
  var NAME_KEYS = { greet: 1, night: 1, win: 1, evolve: 1, hatch: 1 };
  var EMOJI = {
    greet: '👋', hungry: '🍖', bored: '🎾', sad: '😢', happy: '😊', fed: '🍚',
    correct: '✨', wrong: '🤍', combo: '🔥', win: '🏆', lose: '💪', draw: '🤝',
    hatch: '🐣', evolve: '✨', night: '🌙'
  };

  var COOLDOWN = 10 * 60 * 1000;   /* 同一句 10 分鐘內不重複 */
  var seen = {};                   /* text -> ts */
  var minuteStart = 0, minuteCount = 0;
  var lastAt = 0;

  function stageLines(key, stage) {
    var byStage = SAY[key];
    if (!byStage) return null;
    var s = Math.max(1, Math.min(4, stage | 0));
    return byStage[s] || byStage[1] || null;
  }

  /* 挑一句；stage 0（蛋）永遠不說話 */
  function pick(key, stage, opts) {
    opts = opts || {};
    if (stage === 0 && !opts.allowEgg) return null;
    var arr = stageLines(key, stage);
    if (!arr || !arr.length) return null;
    var now = Date.now();
    var fresh = arr.filter(function (t) { return !seen[t] || now - seen[t] > COOLDOWN; });
    var pool = fresh.length ? fresh : arr;
    var text = pool[Math.floor(Math.random() * pool.length)];
    return text;
  }

  /* 有禮貌版：套冷卻與頻率上限；回傳字串或 null */
  function speak(key, stage, opts) {
    opts = opts || {};
    var now = Date.now();
    if (now - minuteStart > 60000) { minuteStart = now; minuteCount = 0; }
    if (!opts.force) {
      if (minuteCount >= 2) return null;              /* 每分鐘最多 2 句 */
      if (now - lastAt < (opts.gap || 1200)) return null; /* 太近就閉嘴 */
    }
    var text = pick(key, stage, opts);
    if (!text) return null;
    text = withName(key, text);
    seen[text] = now;
    lastAt = now;
    minuteCount++;
    return text;
  }

  /* 叫名字：家長設了 dsh_kid_name 才叫，而且只在幾個關鍵時刻 */
  var NAME_KEY = 'dsh_kid_name';
  function kidName() {
    try { return (localStorage.getItem(NAME_KEY) || '').trim(); } catch (e) { return ''; }
  }
  function setKidName(v) {
    try {
      if (v) localStorage.setItem(NAME_KEY, String(v).trim().slice(0, 8));
      else localStorage.removeItem(NAME_KEY);
    } catch (e) {}
  }
  function withName(key, text) {
    if (!NAME_KEYS[key]) return text;
    var n = kidName();
    if (!n) return text;
    return n + '，' + text;
  }

  function emoji(key) { return EMOJI[key] || ''; }

  /* 停留時間：字數 × 0.35s，最少 3.5s（小孩讀得慢） */
  function holdMs(text) { return Math.max(3500, (text || '').length * 350); }

  /* 在任意元素上方掛一個氣泡（自己管理 DOM，頁面不用先有 bubble） */
  function bubble(anchor, text, opts) {
    if (!anchor || !text) return;
    opts = opts || {};
    var host = anchor.offsetParent || document.body;
    if (host !== document.body) {
      var cs = getComputedStyle(host);
      if (cs.position === 'static') host.style.position = 'relative';
    }
    var id = 'ps-' + (anchor.id || Math.random().toString(36).slice(2));
    var b = host.querySelector('[data-ps="' + id + '"]');
    if (!b) {
      b = document.createElement('div');
      b.className = 'petsay';
      b.setAttribute('data-ps', id);
      host.appendChild(b);
    }
    b.textContent = text;
    var r = anchor.getBoundingClientRect(), pr = host.getBoundingClientRect();
    b.style.left = (r.left - pr.left + r.width / 2) + 'px';
    b.style.top = (r.top - pr.top - 6) + 'px';
    b.classList.add('on');
    clearTimeout(b._t);
    b._t = setTimeout(function () { b.classList.remove('on'); }, opts.ms || holdMs(text));
    return b;
  }

  /* 氣泡樣式：注入一次，三支頁面共用 */
  function installStyles() {
    if (document.getElementById('petsay-css')) return;
    var st = document.createElement('style');
    st.id = 'petsay-css';
    st.textContent =
      '.petsay{position:absolute;z-index:60;transform:translate(-50%,-100%) scale(.86);' +
      'background:#fff;color:#1e293b;font-weight:800;font-size:15px;line-height:1.45;' +
      'padding:8px 13px;border-radius:14px;max-width:210px;width:max-content;' +
      'text-align:center;box-shadow:0 10px 26px rgba(0,0,0,.45);' +
      'opacity:0;pointer-events:none;transition:opacity .18s,transform .18s}' +
      '.petsay.on{opacity:1;transform:translate(-50%,-100%) scale(1)}' +
      '.petsay::after{content:"";position:absolute;left:50%;bottom:-5px;width:11px;height:11px;' +
      'margin-left:-5px;background:#fff;transform:rotate(45deg);border-radius:2px}';
    document.head.appendChild(st);
  }

  w.PetSay = {
    SAY: SAY, pick: pick, speak: speak, emoji: emoji, holdMs: holdMs,
    bubble: bubble, installStyles: installStyles,
    kidName: kidName, setKidName: setKidName
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installStyles);
  } else {
    installStyles();
  }
})(window);
