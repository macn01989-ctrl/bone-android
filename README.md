# Bone Android

Bone 是一个私人 Android 应用，用来记录声音、整理笔记、收藏专辑和播客。

它不是一个传统的效率工具，更像一个随身的个人记忆盒：把语音变成文字，把文字整理成日记，把喜欢的唱片和节目收进自己的收藏墙，在需要一点灵感的时候翻出一张专辑或一档播客。

## Screenshots

截图可以放在 `screenshots/` 目录。建议后续补这几张图：

| 页面 | 建议文件名 |
| --- | --- |
| 首页 | `screenshots/home.png` |
| 录音页 | `screenshots/recorder.png` |
| 笔记页 | `screenshots/notes.png` |
| 专辑推荐 | `screenshots/albums.png` |
| 播客推荐 | `screenshots/podcasts.png` |
| 设置页 | `screenshots/settings.png` |

## Features

- 录音、语音转文字、文本润色和日记整理。
- 笔记支持标签、图片、音频、置顶和隐私日记筛选。
- 专辑推荐支持本地专辑库、Rolling Stone 500、中国摇滚专辑、1001 Albums，以及 Apple Music 实时补充。
- 播客推荐支持候选库、封面和节目列表。
- 收藏页支持收藏专辑、收藏播客和手动添加内容。
- 设置页可配置语音转文字、文本润色、专辑整理模型、默认跳转平台、备份和恢复。
- 平台跳转支持小宇宙、Apple Podcasts、网易云音乐、Spotify、Apple Music 和 QQ 音乐。

## Tech Stack

- React
- TypeScript
- Vite
- Capacitor Android
- Native Android plugins for HTTP, sharing, image actions, music deep links, and Apple album background preparation

## Project Structure

```text
bone-android/
├─ android/                         # Capacitor Android project
├─ src/                             # React and TypeScript source
├─ public/                          # Web public assets and recommendation data
├─ recovery/good-apk-public/        # Runtime web assets used by the APK build
├─ tools/                           # Import, repair, and runtime patch scripts
├─ docs/                            # Maintenance notes
├─ AGENTS.md                        # Agent handoff guide
└─ BONE_2026_06_RELEASE.md          # June 2026 release notes
```

## Important Runtime Note

This project has a special packaging flow. The Android APK does not only depend on `src/`.

During the Android build, Gradle runs `restoreGoodApkAssets` and copies:

```text
recovery/good-apk-public
```

into:

```text
android/app/src/main/assets/public
```

So if you change `src/App.tsx` but do not update the runtime assets, the installed Android app may not show the change. Read [AGENTS.md](./AGENTS.md) before changing the app.

## Build

Install dependencies:

```powershell
npm install
```

Build the web app:

```powershell
npm run build
```

Build a debug APK with the current runtime assets:

```powershell
npm run build:android:safe
```

The debug APK is generated at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Privacy And Keys

Do not commit API keys or local model configuration. The app expects users to configure model keys in the settings page.

The repository intentionally ignores:

- `.env`
- `models.json`
- APK and ZIP files
- Gradle build outputs
- temporary snapshots and local backup folders

## Current Release

The June 2026 local Android release is documented in [BONE_2026_06_RELEASE.md](./BONE_2026_06_RELEASE.md).

## License

No open source license has been selected yet.
