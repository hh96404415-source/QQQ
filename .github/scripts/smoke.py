# -*- coding: utf-8 -*-
"""線上煙霧測試：Pages 有沒有生效、GAS 後端自檢有沒有過。"""
import json, sys, time, urllib.request

SITE = 'https://hh96404415-source.github.io/QQQ/'
GAS = ('https://script.google.com/macros/s/'
       'AKfycbydbycnfQsKkirktxFhKOB9p847SlW3e7Jd8oudLykEgkh_zp4ATPde4XIc476JcWNl/exec')
PAGES = ['index.html', 'challenge.html', 'community.html', 'parent.html', 'dev.html',
         'wallet.js', 'parent-admin.js', 'qb.js', 'qa-audio.js', 'time.js', 'player.js']


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={'User-Agent': 'ci-smoke'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read()


def post_gas(body, timeout=60):
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(GAS, data=data, method='POST',
                                 headers={'Content-Type': 'text/plain;charset=utf-8'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def main():
    # 1) 等 Pages 生效（最多 5 分鐘；舊版也是 200，所以另外驗內容指紋）
    ok = False
    for i in range(30):
        try:
            st, body = get(SITE + 'qa-audio.js')
            if st == 200 and b'manifest/v2/' in body:
                ok = True
                break
        except Exception as e:
            print('等待 Pages… %s' % e)
        time.sleep(10)
    if not ok:
        print('FAIL Pages 5 分鐘內沒有更新到含 manifest/v2 的版本')
        return 1
    print('OK Pages 已生效（qa-audio.js 含 manifest/v2）')

    # 2) 主要頁面／腳本都要 200
    bad = []
    for f in PAGES:
        try:
            st, body = get(SITE + f)
            if st != 200 or len(body) < 200:
                bad.append('%s status=%s size=%d' % (f, st, len(body)))
            else:
                print('OK %-18s %7d bytes' % (f, len(body)))
        except Exception as e:
            bad.append('%s %s' % (f, e))
    if bad:
        for b in bad:
            print('FAIL ' + b)
        return 1

    # 3) GAS 後端：版本＋自檢 8 項
    v = post_gas({'action': 'version'})
    print('GAS version: %s' % v.get('v'))
    if not v.get('ok'):
        print('FAIL version 端點異常')
        return 1
    t = post_gas({'action': 'selfTest'})
    print('selfTest: pass=%s/%s all=%s' % (t.get('pass'), t.get('total'), t.get('all')))
    if not t.get('ok') or not t.get('all') or t.get('pass') != t.get('total'):
        for x in (t.get('tests') or []):
            if not x.get('ok'):
                print('  FAIL %s %s' % (x.get('name'), x.get('error')))
        return 1
    print('OK 煙霧測試全綠')
    return 0


sys.exit(main())
