# -*- coding: utf-8 -*-
"""回歸守門：把「已經修好、不想再壞」的規則寫成檢查。"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def read(name):
    p = os.path.join(ROOT, name)
    if not os.path.exists(p):
        return None
    return io.open(p, encoding='utf-8', errors='ignore').read()


MUST_NOT = [
    ('challenge.html', 'Time.mount(', '舊「答題秒數」chip 已移除，不能復活'),
    ('community.html', 'Time.mount(', '舊「答題秒數」chip 已移除，不能復活'),
    ('challenge.html', 'Time.earn(', '答題獎勵已改金幣，不能再用 Time.earn'),
    ('challenge.html', 'Time.gift(', '隨機送秒數已移除'),
    ('index.html', 'parent.html', '孩子頁不該出現家長入口'),
    ('index.html', '家長頁', '孩子頁不該出現家長入口字樣'),
]
MUST = [
    ('challenge.html', 'id="qSay"', '題目語音鈕'),
    ('challenge.html', 'QAudio.mount(', '卡拉OK逐字上色'),
    ('challenge.html', "action: 'earnBatch'", '本地題金幣批次入帳'),
    ('challenge.html', 'action: \'complete_set\'', '每 3 題交卷'),
    ('challenge.html', 'id="sbCoins"', '計分板金幣'),
    ('community.html', 'Wallet.mount(', '錢包 HUD'),
    ('community.html', 'wallet.js', '錢包腳本'),
    ('challenge.html', 'qb.js', 'Firebase 題庫'),
    ('challenge.html', 'qa-audio.js', '語音腳本'),
    ('parent.html', 'parentLogin', '家長獨立入口'),
    ('parent.html', 'ParentAdmin.mount(', '家長管理面板'),
    ('dev.html', 'devOverview', '開發者後台'),
]


def main():
    fails = []
    for f, needle, why in MUST_NOT:
        t = read(f)
        if t is None:
            fails.append('缺少檔案 %s' % f)
        elif needle in t:
            fails.append('%s 不該出現「%s」（%s）' % (f, needle, why))
    for f, needle, why in MUST:
        t = read(f)
        if t is None:
            fails.append('缺少檔案 %s' % f)
        elif needle not in t:
            fails.append('%s 找不到「%s」（%s）' % (f, needle, why))
    if fails:
        for x in fails:
            print('FAIL ' + x)
        return 1
    print('OK 守門 %d 條全部通過' % (len(MUST_NOT) + len(MUST)))
    return 0


sys.exit(main())
