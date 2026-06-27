# Agent 快速上手：Bone Android

你正在接手 Bone Android 项目。先不要急着写代码。

## 项目位置

`C:\Users\Lenovo\Desktop\Bone转化\bone-android`

## 最重要的一句话

手机 APK 里真正运行的前端资源来自：

`recovery/good-apk-public`

不是单纯来自 `src/`。

Gradle 打包时会执行 `restoreGoodApkAssets`，把 `recovery/good-apk-public` 复制到：

`android/app/src/main/assets/public`

所以如果你改了 `src/App.tsx` 但没有同步运行时资源，用户手机里可能完全看不到变化。

## 先读这些文件

1. `README.md`
2. `BONE_2026_06_RELEASE.md`
3. `docs/AGENT_QUICKSTART.md`
4. `docs/ALBUM_IMPORT_GUIDE.md`

## 常用命令

构建 APK：

```powershell
cd C:\Users\Lenovo\Desktop\Bone转化\bone-android\android
.\gradlew.bat :app:assembleDebug
```

检查当前 APK：

```powershell
Get-Item C:\Users\Lenovo\Desktop\Bone转化\bone-android\android\app\build\outputs\apk\debug\app-debug.apk
```

## 修改原则

- 不要大范围重写压缩后的 JS/CSS。
- 不要用 PowerShell 直接重写压缩 CSS，容易写入 BOM 或乱码。
- 如果必须改 `recovery/good-apk-public/assets/index-*.js`，请用 Node 脚本按精确字符串替换。
- 改 CSS 时必须确认文件开头不是 UTF-8 BOM。
- 每次只改一个问题，打一版 APK。
- 用户非常在意原本的动效、页面位置和手感，不要擅自“优化”。

## 封版 APK

当前 2026 年 6 月封版 APK：

`C:\Users\Lenovo\Desktop\Bone_album_loader_first_fix_20260627.apk`

## 不要上传到 GitHub 的东西

- `node_modules/`
- `android/.gradle/`
- `android/build/`
- `android/app/build/`
- `*.apk`
- `*.zip`
- `.env`
- `models.json`
- 任何 API Key

## 如果要加专辑

读：

`docs/ALBUM_IMPORT_GUIDE.md`

重点：

- 专辑索引在 `recovery/good-apk-public/recommendations/album-catalog.json`
- 封面文件名尽量用 ASCII，不要中文文件名。
- `styleTags` 用中文，最多 4 个。
