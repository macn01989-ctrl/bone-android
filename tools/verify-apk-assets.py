import json
import os
import sys
import urllib.parse
import zipfile

apk = sys.argv[1] if len(sys.argv) > 1 else r"android/app/build/outputs/apk/debug/app-debug.apk"

with zipfile.ZipFile(apk) as z:
    names = set(z.namelist())
    catalog = json.loads(z.read("assets/public/recommendations/album-catalog.json"))
    chinese = [item for item in catalog if item.get("collection") == "chinese-rock"]
    missing = []
    for item in chinese:
        expected = "assets/public/" + urllib.parse.unquote(item["artworkUrl"]).lstrip("/")
        if expected not in names:
            missing.append(expected)

    waits = [
        "/kd/marilyn.png",
        "/kd/underground.png",
    ]
    print(f"apk chinese-rock total {len(chinese)} missing decoded covers {len(missing)}")
    for wait in waits:
        expected = "assets/public/" + urllib.parse.unquote(wait).lstrip("/")
        print(f"apk wait {wait} {expected in names}")
    print(f"apk size {os.path.getsize(apk)}")

if missing:
    print("first missing:", missing[0])
    raise SystemExit(2)
