# -*- coding: utf-8 -*-
"""音檔覆蓋率：題庫（Firebase）每一題都要在 manifest 找得到，並抽驗音檔可下載。"""
import json, sys, urllib.request

FB = 'https://qqquest-2e36a-default-rtdb.asia-southeast1.firebasedatabase.app/bank/v1/'
RAW = 'https://raw.githubusercontent.com/hh96404415-source/QQQ-audio/main/'
MAN = RAW + 'manifest/v2/'
SUBJECTS = ['Chinese', 'English', 'Math']


def get_json(url, timeout=60):
    return json.load(urllib.request.urlopen(url, timeout=timeout))


def head_ok(url):
    req = urllib.request.Request(url, method='HEAD')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200, r.headers.get('Content-Length')
    except Exception:
        return False, None


def main():
    total = 0
    missing = []
    sample = []
    for lvl in (1, 2, 3):
        for sub in SUBJECTS:
            try:
                bank = get_json('%sL%d/%s.json' % (FB, lvl, sub)).get('q') or {}
                man = get_json('%sL%d_%s.json' % (MAN, lvl, sub)).get('q') or {}
            except Exception as e:
                print('抓取失敗 L%d/%s：%s' % (lvl, sub, e))
                return 1
            total += len(bank)
            for qid in bank:
                if qid not in man:
                    missing.append('%s %s' % (sub, qid))
                elif len(sample) < 8 and qid.endswith('_01'):
                    clips = man[qid].get('clips') or []
                    if clips:
                        sample.append(clips[0].get('f'))
            print('L%d %-8s 題庫 %4d ／ manifest %4d' % (lvl, sub, len(bank), len(man)))
    print('題庫合計 %d，缺 manifest %d' % (total, len(missing)))
    bad = 0
    for f in sample:
        ok, size = head_ok(RAW + f)
        print('%s %s %s' % ('OK ' if ok else 'FAIL', f, size))
        if not ok:
            bad += 1
    if missing:
        for m in missing[:20]:
            print('MISSING ' + m)
        return 1
    if bad:
        return 1
    print('OK 覆蓋 100%%、抽驗音檔 %d/%d 可下載' % (len(sample) - bad, len(sample)))
    return 0


sys.exit(main())
