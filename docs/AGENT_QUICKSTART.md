# Bone Android：给下一个 Agent 的快速上手笔记

## 0. 先理解当前项目的特殊性

Bone Android 是一个 Capacitor Android 应用，但当前版本经历过 APK 恢复，所以存在两套前端资源：

- `src/`：源码视角，适合长期整理。
- `recovery/good-apk-public/`：当前手机 APK 真正使用的运行时资源。

Gradle 任务 `restoreGoodApkAssets` 会在构建前复制 `recovery/good-apk-public` 到 `android/app/src/main/assets/public`。

因此，用户说“手机里没有变化”时，优先检查你是不是只改了 `src/`。

## 1. 目录速览

```text
bone-android/
├─ android/                         # Capacitor Android 工程
├─ src/                             # React/TypeScript 源码
├─ public/                          # Web 公共资源
├─ recovery/good-apk-public/        # 当前 APK 使用的前端资源，极其重要
├─ tools/                           # 修复、导入、转换脚本
├─ docs/                            # 项目说明
├─ README.md                        # GitHub 首页说明
├─ BONE_2026_06_RELEASE.md          # 2026 年 6 月封版说明
└─ AGENTS.md                        # Agent 入口说明
```

## 2. 构建 APK

```powershell
cd C:\Users\Lenovo\Desktop\Bone转化\bone-android\android
.\gradlew.bat :app:assembleDebug
```

输出：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 3. 当前最终 APK

```text
C:\Users\Lenovo\Desktop\Bone_album_loader_first_fix_20260627.apk
```

这个版本修复了专辑首次加载等待图。

## 4. 已知敏感点

### 4.1 页面动效

用户非常在意页面间跳转渐变。不要随便禁用：

- `.app-shell-leaving`
- `.app-shell-entering`
- `appViewFadeIn`

### 4.2 CSS 编码

不要让 `index-Dvq-jbN8.css` 出现 UTF-8 BOM。

检查：

```powershell
python -c "from pathlib import Path; print(Path('recovery/good-apk-public/assets/index-Dvq-jbN8.css').read_bytes()[:20])"
```

正常应以：

```text
b':root{color:#101010;'
```

开头。

### 4.3 压缩 JS

运行时 JS 是压缩文件：

```text
recovery/good-apk-public/assets/index-1_-kxmKC.js
```

如果必须改，用 Node 脚本精确替换，改完执行：

```powershell
node --check recovery/good-apk-public/assets/index-1_-kxmKC.js
```

### 4.4 专辑等待图

专辑首次加载等待图已经做过修复：等待图 class 需要默认带 `image-visible`，否则首次进入专辑页可能看不到等待图。

## 5. API 与模型

软件设置页由用户自己填写硅基流动 API Key。不要把 API Key 写进代码。

主要模型用途：

- 语音转文字
- 文本润色
- 专辑整理

如果排查 API 问题，优先让错误提示完整输出 HTTP 状态、模型、文件名、mime、bytes、body。

## 6. GitHub 发布建议

不要提交：

- `node_modules/`
- `android/.gradle/`
- `android/build/`
- `android/app/build/`
- APK / ZIP
- `.env`
- `models.json`
- 任何密钥

推荐只提交源码、运行时资源、文档、脚本和必要的本地推荐数据。

## 7. 对用户的沟通方式

用户非常讨厌“越改越乱”。改 UI 时请遵守：

1. 先确认是哪一个页面。
2. 一次只改一个视觉问题。
3. 不要顺手改别的。
4. 每次说明“改了什么、没改什么”。
5. 打 APK 前做最小验证。
