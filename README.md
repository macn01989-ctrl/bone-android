# Bone Android

Bone 是一个私人 Android 应用，用来记录声音、整理笔记、收藏专辑和播客。

它不是一个传统的效率工具，更像一个随身的个人记忆盒：把语音变成文字，把文字整理成日记，把喜欢的唱片和节目收进自己的收藏墙，在需要一点灵感的时候翻出一张专辑或一档播客。

## 操作与功能

<img width="3500" height="2475" alt="26" src="https://github.com/user-attachments/assets/4d0bb7e2-7c59-48a9-bb14-8e46e97a95ad" />
<img width="3500" height="2475" alt="27" src="https://github.com/user-attachments/assets/9857d44c-00d4-4727-bb27-3c5c613ac1b5" />
<img width="3500" height="2475" alt="28" src="https://github.com/user-attachments/assets/58bb069b-0b4b-4d98-bd63-a56d00328f2a" />
<img width="3500" height="2475" alt="29" src="https://github.com/user-attachments/assets/cf43f3aa-eefa-44f7-80e0-d75861ac5514" />
<img width="3500" height="2475" alt="30" src="https://github.com/user-attachments/assets/59b66178-a0cc-4b24-a766-c758e985b1e3" />
<img width="3500" height="2475" alt="31" src="https://github.com/user-attachments/assets/f03f1db5-7157-466a-9cb0-be27c3b45a68" />
<img width="3500" height="2475" alt="32" src="https://github.com/user-attachments/assets/2d5c353c-7ca2-4c05-8903-2dbe4be80658" />

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
