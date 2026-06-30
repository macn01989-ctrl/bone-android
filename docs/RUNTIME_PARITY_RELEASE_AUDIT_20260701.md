# Runtime Parity Release Audit - 2026-07-01

## Purpose

This checkpoint verifies that the source cleanup work is already present in the APK runtime assets loaded from `recovery/good-apk-public`.

No broad rewrite of compressed runtime JavaScript or CSS was applied in this stage.

## Branch

- Worktree: `C:\Users\Lenovo\Desktop\Bone转化\bone-android-refactor`
- Branch: `codex/runtime-parity-release`
- Base checkpoint: `025665a Consolidate shared source infrastructure`

## Runtime Source Rule

Android packages load frontend runtime assets from:

`recovery/good-apk-public`

During Android build, `restoreGoodApkAssets` copies that directory to:

`android/app/src/main/assets/public`

So runtime verification must check the APK assets, not only `src/`.

## Verified Runtime Markers

The following markers were checked in the packaged APK runtime JavaScript:

- `postMultipartAudio`
- `asr-connectivity-test.wav`
- `bone-connectivity-test.wav`
- `audio/wav`
- `在小宇宙打开`
- `在网易云音乐打开`
- `Apple Podcasts`
- `QQ 音乐`
- `favorites-album-popup-tags`
- `系统添加`
- `专辑默认平台`
- `已经拥有的专辑合集`
- `火山方舟`
- `NativeHttp`
- `ExternalMusic`
- `ImageActions`
- `ApplePool`

Result: all 17 markers were present in `assets/public/assets/index-*.js` inside the APK.

## Commands Run

```powershell
npm run build:android:safe
```

Result:

- `verify:runtime-guardrails` passed.
- `restore:good-apk-assets -SkipDist` restored `good-apk-public`.
- Gradle `assembleDebug` completed successfully.

```powershell
python tools\verify-apk-assets.py android\app\build\outputs\apk\debug\app-debug.apk
```

Result:

- `apk chinese-rock total 268`
- `missing decoded covers 0`
- `apk wait /kd/marilyn.png True`
- `apk wait /kd/underground.png True`
- `apk size 220755267`

## Final APK

Copied debug APK:

`C:\Users\Lenovo\Desktop\Bone_final_runtime_parity_release_20260701-004001.apk`

File size:

`220755267`

Visible file modified time:

`2026/7/1 0:40:01`

## Conclusion

The final runtime parity audit found no missing source-to-runtime behavior for the protected feature set. Because the packaged APK already contains the expected runtime markers, this stage intentionally did not patch `recovery/good-apk-public/assets/index-*.js` or compressed CSS.

