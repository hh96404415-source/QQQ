#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wr30u-enforce.py — Family OS 執法盒（Xiaomi WR30U / OpenWrt 24.10）

架構：推時間表（pull schedule, enforce locally）。
  - 每 sync_interval_sec 秒向 Firebase/GAS 拉一份「時間表」。
  - 每秒用「本機時鐘 vs 各裝置 expire_ms」自行判定 free/study（到期熔斷零延遲）。
  - study = 對該 MAC 套 AdGuard Home 過濾（擋 blocklist）；free = 清過濾。
  - 未綁定 MAC 一律 study（fail-closed）。

╔══════════════════════════════════════════════════════════════╗
║  設定拆分 + OTA（重要，別把秘密寫進這檔）                       ║
╠══════════════════════════════════════════════════════════════╣
║  1. 這檔會公開託管在 GitHub Pages（供 OTA 下載），所以           ║
║     device_token / fb_sched_key / adguard_pass 等秘密一律       ║
║     放本機 `/root/enforce-config.json`，這檔只留 CHANGE_ME。     ║
║  2. OTA：每次 sync 看時間表裡的 `enforce_version`，比本檔        ║
║     ENFORCE_VERSION 大 → 下載 `enforce_url` 的新腳本 →          ║
║     語法驗證 → 備份舊版 → 覆蓋 → 自我重啟。config.json 不動。    ║
║  3. 發布更新 = 改這檔+bump ENFORCE_VERSION → bump GAS 的          ║
║     ENFORCE_VERSION → build/push GitHub Pages → 跑               ║
║     fbPushAllSchedules（讓時間表帶上新版號）。                    ║
╚══════════════════════════════════════════════════════════════╝

用法：OpenWrt 上 `opkg update && opkg install python3-light`，
     把這檔放到 /root/、建 /root/enforce-config.json、用 procd init 開機自啟
     （procd 要設 respawn，萬一壞版崩潰才會自動拉起）。
"""

import base64
import json
import os
import sys
import time
import urllib.request
import urllib.error

# ---- 本檔版本（每次發布 bump；OTA 拿雲端 enforce_version 跟它比）----
ENFORCE_VERSION = 1

# ---- 預設值（無 /root/enforce-config.json 時的佔位；真實值只在 config.json）----
_DEFAULTS = {
    "fb_sched_key": "CHANGE_ME",     # 例 k3f9a2c1d4b5e6f7089（Families.sched_key）
    "fb_base": "https://qqquest-2e36a-default-rtdb.asia-southeast1.firebasedatabase.app",
    "gas_url": "https://script.google.com/macros/s/AKfycbydbycnfQsKkirktxFhKOB9p847SlW3e7Jd8oudLykEgkh_zp4ATPde4XIc476JcWNl/exec",
    "device_token": "CHANGE_ME",     # GAS Devices 表這台的 device_token
    "family_id": 1,
    "adguard_user": "admin",
    "adguard_pass": "CHANGE_ME",
    "adguard_api": "http://127.0.0.1:3000/control",
}

CONFIG_PATH = "/root/enforce-config.json"
SELF_PATH = "/root/wr30u-enforce.py"


def load_config():
    cfg = dict(_DEFAULTS)
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg.update(json.load(f))
    except (OSError, ValueError) as e:
        print("[config] 讀不到 %s（用預設佔位值）: %s" % (CONFIG_PATH, e))
    return cfg


CFG = load_config()
FB_SCHED_KEY = CFG["fb_sched_key"]
FB_BASE = CFG["fb_base"]
FB_SCHED_URL = FB_BASE + "/sched/v1/" + FB_SCHED_KEY + ".json"
GAS_URL = CFG["gas_url"]
DEVICE_TOKEN = CFG["device_token"]
FAMILY_ID = CFG["family_id"]
ADGUARD_API = CFG["adguard_api"]
ADGUARD_USER = CFG["adguard_user"]
ADGUARD_PASS = CFG["adguard_pass"]

STATE_FILE = "/tmp/familyos-schedule.json"


class Enforcer:
    def __init__(self):
        self.schedule = None
        self.synced_at = 0
        self.interval = 60
        self.last_rev = None
        self._applied = {}   # mac -> 目前套用狀態（free/study），避免重複 call API
        self._last_ota_try = 0.0

    # ---- 拉時間表 ----
    def sync(self):
        # 1) 先讀 Firebase（公開讀、沒有配額壓力，GAS 完全不用被叫）
        data = None
        try:
            req = urllib.request.Request(FB_SCHED_URL + "?t=%d" % int(time.time()), method="GET")
            with urllib.request.urlopen(req, timeout=8) as r:
                data = json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, ValueError, OSError) as e:
            print("[sync] firebase failed:", e)
        if data and data.get("ok"):
            self._accept(data, src="firebase")
            self._maybe_ota(data)
            return True
        # 2) 備援：GAS poll
        body = json.dumps({
            "action": "poll",
            "device_token": DEVICE_TOKEN,
            "family_id": FAMILY_ID,
        }).encode("utf-8")
        req = urllib.request.Request(
            GAS_URL, data=body,
            headers={"Content-Type": "text/plain"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, ValueError, OSError) as e:
            print("[sync] failed:", e)
            return False
        if not data.get("ok"):
            print("[sync] not ok:", data.get("error"))
            return False
        self._accept(data, src="gas")
        self._maybe_adopt_key(data)
        self._maybe_ota(data)
        return True

    def _maybe_adopt_key(self, data):
        """第一次用 GAS 備援時，自動學到這家的 sched_key，之後就直接讀 Firebase。"""
        global FB_SCHED_URL
        k = data.get("sched_key")
        if k and "CHANGE_ME" in FB_SCHED_URL:
            FB_SCHED_URL = FB_BASE + "/sched/v1/" + k + ".json"
            print("[sync] adopted sched_key ->", k)

    def _accept(self, data, src="?"):
        self.schedule = data
        self.synced_at = time.time()
        self.interval = max(30, int(data.get("sync_interval_sec", 60)))
        # 封印清單變了 → 下一輪重套
        if data.get("rev") != self.last_rev:
            self.last_rev = data.get("rev")
            self._applied = {}
        print("[sync] ok via %s rev=%s devices=%d" % (src, data.get("rev"), len(data.get("devices") or [])))

    # ---- OTA 自我更新 ----
    def _maybe_ota(self, data):
        """雲端 enforce_version 比本機新 → 下載新腳本 → 語法驗證 → 覆蓋 → 重啟。"""
        try:
            ver = int(data.get("enforce_version") or 0)
        except (TypeError, ValueError):
            return
        url = (data.get("enforce_url") or "").strip()
        if ver <= ENFORCE_VERSION or not url.startswith("http"):
            return
        # 節流：5 分鐘內只試一次，壞版別造成重啟迴圈（procd respawn 會救）
        if time.time() - self._last_ota_try < 300:
            return
        self._last_ota_try = time.time()
        print("[ota] 發現新版 %d > %d，從 %s 下載" % (ver, ENFORCE_VERSION, url))
        try:
            req = urllib.request.Request(url, method="GET", headers={"User-Agent": "wr30u-enforce-ota/1"})
            with urllib.request.urlopen(req, timeout=25) as r:
                raw = r.read()
        except (urllib.error.URLError, OSError) as e:
            print("[ota] 下載失敗（保留舊版）:", e)
            return
        if len(raw) < 200 or b"ENFORCE_VERSION" not in raw:
            print("[ota] 下載內容可疑（%d bytes、缺標記），放棄" % len(raw))
            return
        # 語法驗證（編譯失敗就別覆蓋，避免把盒子刷死）
        try:
            compile(raw.decode("utf-8", "replace"), "wr30u-enforce.py", "exec")
        except (SyntaxError, ValueError) as e:
            print("[ota] 新腳本語法錯誤，放棄:", e)
            return
        try:
            new_path = SELF_PATH + ".new"
            with open(new_path, "wb") as f:
                f.write(raw)
            os.chmod(new_path, 0o755)
            if os.path.exists(SELF_PATH):
                try:
                    os.replace(SELF_PATH, SELF_PATH + ".bak")
                except OSError:
                    pass
            os.replace(new_path, SELF_PATH)
        except OSError as e:
            print("[ota] 寫檔失敗（保留舊版）:", e)
            return
        print("[ota] 更新完成，2 秒後重啟")
        time.sleep(2)
        os.execv(sys.executable, [sys.executable] + sys.argv)

    # ---- 本機判定：某 MAC 現在該 free 還 study ----
    def mode_for(self, mac):
        mac = mac.lower()
        if not self.schedule:
            return "study"   # 沒拉到時間表 → 保守封鎖
        now_ms = int(time.time() * 1000)
        for d in self.schedule.get("devices", []):
            if (d.get("device_mac") or "").lower() == mac:
                return "free" if d.get("expire_ms", 0) > now_ms else "study"
        return "study"   # 未綁定 → fail-closed

    # ---- 在線裝置清單（OpenWrt /tmp/dhcp.leases：到期秒 MAC IP 主機名 clientid）----
    def online_devices(self):
        devs = []
        try:
            with open("/tmp/dhcp.leases") as f:
                for line in f:
                    parts = line.split()
                    if len(parts) >= 4:
                        devs.append({"mac": parts[1].lower(), "ip": parts[2]})
        except OSError:
            pass
        return devs

    # ---- AdGuard Home API（per-client 過濾開關）----
    def _ag_auth_header(self):
        raw = ("%s:%s" % (ADGUARD_USER, ADGUARD_PASS)).encode("utf-8")
        return {"Authorization": "Basic " + base64.b64encode(raw).decode("ascii"),
                "Content-Type": "application/json"}

    def _ag_call(self, method, path, payload=None):
        url = ADGUARD_API.rstrip("/") + path
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(url, data=data,
                                     headers=self._ag_auth_header(), method=method)
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print("[adguard] %s %s failed: %s" % (method, path, e))
            return None

    def _find_client(self, ident_list):
        resp = self._ag_call("GET", "/clients")
        if not resp:
            return None
        for c in resp.get("clients", []):
            ids = [str(i).lower() for i in c.get("ids", [])]
            if any(x in ids for x in ident_list):
                return {"name": c.get("name", ident_list[0]), "auto": False}
        # auto_clients 不能直接 update，需先 add 成 persistent client
        for c in resp.get("auto_clients", []):
            ids = [str(i).lower() for i in c.get("ids", [])]
            if any(x in ids for x in ident_list):
                return {"name": c.get("name", "kid"), "auto": True}
        return None

    def apply_filtering(self, mac, enabled, ip=None):
        mac_l = (mac or "").lower()
        ident = [mac_l] if mac_l else []
        if ip:
            ident.append(ip)
        if not ident:
            return
        found = self._find_client(ident)
        data = {"filtering_enabled": enabled, "use_global_settings": False}
        if found and not found["auto"]:
            self._ag_call("POST", "/clients/update",
                          {"name": found["name"], "data": data})
        else:
            name = "kid-" + (mac_l.replace(":", "")[-6:] if mac_l else str(ip))
            self._ag_call("POST", "/clients/add",
                          {"name": name, "ids": ident, **data})

    # ---- 每秒執法 ----
    def enforce_once(self):
        if not self.schedule:
            return
        for dev in self.online_devices():
            mac = dev["mac"]
            want = self.mode_for(mac)            # 'free' or 'study'
            if self._applied.get(mac) == want:
                continue
            self.apply_filtering(mac, enabled=(want == "study"), ip=dev.get("ip"))
            self._applied[mac] = want

    def run(self):
        while True:
            now = time.time()
            if now - self.synced_at >= self.interval:
                self.sync()
            self.enforce_once()
            time.sleep(1)


if __name__ == "__main__":
    Enforcer().run()
