# Bone

Bone 是一个给私人记忆、音乐和声音准备的小型 Android 应用。

它有点像一个随身的骨头盒子：你可以把语音变成笔记，把笔记按标签藏起来，把喜欢的专辑和播客收进自己的墙里，也可以在无聊的时候让它给你翻出一张唱片或一档节目。它不是那种板着脸的效率工具，更像一个独立开发者给自己和朋友做的随身小宇宙。

## 它能做什么

- 录音、语音转文字、文本整理、日记整理。
- 笔记页支持标签、图片、音频、置顶、隐私日记筛选。
- 专辑推荐：本地专辑库、滚石 500、中国乐队专辑、1001 Albums，以及 Apple Music 实时补充能力。
- 播客推荐：按小程序逻辑抓取播客封面和节目列表。
- 收藏页：收藏专辑、收藏播客、手动添加内容。
- 设置页：统一配置硅基流动 API、模型选择、默认跳转平台、备份恢复。
- 平台跳转：播客可跳小宇宙 / Apple Podcasts；专辑可跳网易云 / Spotify / Apple Music / QQ 音乐。

## 当前封版

这是 Bone 的 `2026 年 6 月 Android 封版`。

最终本地 APK：

`C:\Users\Lenovo\Desktop\Bone_album_loader_first_fix_20260627.apk`

项目目录：

`C:\Users\Lenovo\Desktop\Bone转化\bone-android`

## 技术栈

- React + TypeScript + Vite
- Capacitor Android
- 原生 Android 插件：
  - Apple / 外部音乐跳转
  - 图片保存与分享
  - Native HTTP 音频上传
  - Apple 专辑后台服务
- 本地大数据资源：
  - 专辑推荐库
  - 播客候选库
  - 封面资源

## 重要架构提醒

这个项目目前不是普通的“改 `src/App.tsx` 就马上影响 APK”的结构。

Android 打包时会通过 Gradle 任务把：

`recovery/good-apk-public`

复制到：

`android/app/src/main/assets/public`

所以手机里真正运行的 Web 资源，优先看 `recovery/good-apk-public`。

如果你是未来接手的 agent，先读：

- [AGENTS.md](./AGENTS.md)
- [docs/AGENT_QUICKSTART.md](./docs/AGENT_QUICKSTART.md)
- [docs/ALBUM_IMPORT_GUIDE.md](./docs/ALBUM_IMPORT_GUIDE.md)

## 构建

```powershell
cd C:\Users\Lenovo\Desktop\Bone转化\bone-android\android
.\gradlew.bat :app:assembleDebug
```

构建产物：

`android/app/build/outputs/apk/debug/app-debug.apk`

## 一句话

Bone 是一个还带着手作痕迹的私人 Android 软件：它不追求像产品经理文档里那样冷冰冰的完美流程，它更像一个人认真把自己的录音、日记、唱片和播客生活缝在了一起。
