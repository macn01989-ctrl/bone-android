<img width="2000" height="1414" alt="27" src="https://github.com/user-attachments/assets/44c8f10a-f611-406a-8675-cfce59176312" /># Bone Android

Bone 是一个私人 Android 应用，用来记录声音、整理笔记、收藏专辑和播客。

它不是一个传统的效率工具，更像一个随身的个人记忆盒：把语音变成文字，把文字整理成日记，把喜欢的唱片和节目收进自己的收藏墙，在需要一点灵感的时候翻出一张专辑或一档播客。

## 操作与功能

<img width="2000" height="1414" alt="26" src="https://github.com/user-attachments/assets/d045a9c5-9181-45c6-b91e-9a74d272a12e" />
<img width="2000" height="1414" alt="27" src="https://github.com/user-attachments/assets/16f604ac-4cf4-4b34-9dc5-dc5086ca01ce" />
<img width="2000" height="1414" alt="28" src="https://github.com/user-attachments/assets/b311e83b-3fa4-4c49-9843-833931aa725c" />
<img width="2000" height="1414" alt="29" src="https://github.com/user-attachments/assets/5bfa0463-7c21-4230-b39f-42ddd4b3cef8" />
<img width="2000" height="1414" alt="30" src="https://github.com/user-attachments/assets/c93420ca-9100-4d8d-b6ab-ed86b0ca37a4" />
<img width="2000" height="1414" alt="31" src="https://github.com/user-attachments/assets/1e7f0c1c-7337-4ea5-bbff-25e11f953dc7" />
<img width="2000" height="1414" alt="32" src="https://github.com/user-attachments/assets/9db0a39b-890e-4e12-976e-9c013f897812" />

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
