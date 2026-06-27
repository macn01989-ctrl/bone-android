# Bone 2026 年 6 月封版说明

## 这是什么

Bone 是一个 Android 私人笔记与音乐推荐软件。

它主要做四件事：

1. 把语音录音转成文字，再整理成笔记或日记。
2. 管理私人笔记、标签、图片、音频和日记隐私。
3. 推荐和收藏专辑。
4. 推荐和收藏播客。

它的气质不是“办公软件”，而是一个带私人审美的随身记录器：说话、整理、收藏、回看。

## 当前电脑位置

项目目录：

`C:\Users\Lenovo\Desktop\Bone转化\bone-android`

最终 APK：

`C:\Users\Lenovo\Desktop\Bone_album_loader_first_fix_20260627.apk`

APK SHA256：

`6D4D5AFABD213D996348D8FD9914F5C4C955D0D513051ECC81FB872E4C63DC58`

封版 zip 输出到：

`C:\Users\Lenovo\Desktop\Bone_2026_06_project.zip`

## 当前状态

截至 2026 年 6 月 27 日，本版本已经完成：

- 安卓项目从损坏状态恢复。
- 专辑 / 播客推荐基础体验完成。
- 收藏页、笔记页、设置页主要功能完成。
- 语音转文字链路做过多轮修复和错误显示增强。
- 专辑封面路径、中文封面映射、等待图资源修复。
- 页面跳转渐变恢复。
- 收藏页弹窗支持安卓返回键关闭。
- 设置页保留“笔记页”文案和延迟加载优化。
- 专辑首次加载等待图修复。

## 不要乱动的地方

`recovery/good-apk-public`

这是当前 APK 真正使用的前端资源来源。Gradle 打包前会把它复制到 Android assets。

如果只改 `src/App.tsx`，但没有同步到 `recovery/good-apk-public`，手机里不一定会变。

## 最安全的构建方式

```powershell
cd C:\Users\Lenovo\Desktop\Bone转化\bone-android\android
.\gradlew.bat :app:assembleDebug
```

构建成功后 APK 在：

`C:\Users\Lenovo\Desktop\Bone转化\bone-android\android\app\build\outputs\apk\debug\app-debug.apk`

## 给未来自己的话

这个版本已经到了“可以留档”的阶段。之后再改功能，建议一小步一小步来，每次改完都单独出 APK，不要连续乱补丁。Bone 的界面和资源链路比较敏感，尤其是压缩后的运行时 JS/CSS。
