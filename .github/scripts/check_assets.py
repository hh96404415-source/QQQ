# -*- coding: utf-8 -*-
"""檢查每個 HTML 引用的本機檔案是否真的存在（漏建置／改錯檔名會在這裡紅）。"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ATTR = re.compile(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', re.I)
SKIP = ('http://', 'https://', '//', 'data:', 'mailto:', 'javascript:', '#')


def main():
    htmls = [f for f in os.listdir(ROOT) if f.endswith('.html')]
    bad = []
    checked = 0
    for h in htmls:
        txt = open(os.path.join(ROOT, h), encoding='utf-8', errors='ignore').read()
        for ref in ATTR.findall(txt):
            ref = ref.strip()
            if not ref or ref.lower().startswith(SKIP):
                continue
            path = ref.split('?')[0].split('#')[0]
            if not path or path.endswith('/'):
                continue
            if '.' not in os.path.basename(path):
                continue  # 動態拼接（例如 'hw/hwdata' + n + '.js'）無法靜態驗證
            checked += 1
            if not os.path.exists(os.path.join(ROOT, path)):
                bad.append('%s -> %s' % (h, path))
    print('檢查 %d 個引用、%d 個頁面' % (checked, len(htmls)))
    if bad:
        print('缺少檔案：')
        for b in bad:
            print('  ' + b)
        return 1
    print('OK 全部存在')
    return 0


sys.exit(main())
