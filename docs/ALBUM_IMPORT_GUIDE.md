# Bone 专辑合集接入说明

这份文件给以后接手的 agent 看：不要乱猜目录，按下面位置接入。

## 运行时真实目录

Android 打包时会把下面目录复制进 APK：

`C:\Users\Lenovo\Desktop\Bone转化\bone-android\recovery\good-apk-public`

所以要让手机里真正生效，优先修改这里。

## 专辑主索引

主文件：

`C:\Users\Lenovo\Desktop\Bone转化\bone-android\recovery\good-apk-public\recommendations\album-catalog.json`

每条专辑至少要有这些字段：

```json
{
  "id": "collection-album-artist",
  "collection": "1001-albums",
  "albumTitle": "专辑名",
  "albumArtist": "音乐人 / 乐队",
  "artworkUrl": "/recommendations/album-covers/1001/example.jpg",
  "styleTags": ["摇滚", "后朋克", "艺术摇滚"],
  "detail": {
    "introTitle": "",
    "shortIntro": "",
    "fullIntro": "直接给中文介绍正文。1001 Albums 系列不要重复拆块。",
    "whyKeep": ""
  },
  "albumIntro": "收藏页弹窗使用的简介，通常可与 fullIntro 保持一致。"
}
```

## 封面放置规则

封面建议放在：

`recovery\good-apk-public\recommendations\album-covers\<collection>\`

强烈建议文件名只用英文、数字、下划线和短横线，例如：

`1001_The_Magnetic_Fields_69_Love_Songs.jpg`

不要使用中文文件名。之前中文封面在 APK 里出现过路径/编码问题，所以人工核对后的中文专辑封面已经转成 ASCII 文件名映射。

## 新合集 collection 命名

已有常用值：

- `rolling-stone-500`
- `chinese-rock`
- `1001-albums`
- `apple-music`

新增合集可以自己加新的 `collection`，但要保证前端能识别显示名；如果不改前端，未知合集会显示为“其他合集”。

## 接入后必须检查

1. `artworkUrl` 指向的文件必须真实存在。
2. `styleTags` 最多建议 4 个，且全部中文。
3. `fullIntro` 必须是中文正文，不要 Markdown，不要重复“值得收藏”模块。
4. 如果是 1001 Albums 系列，介绍直接搬正文，不要再拆成旧格式，否则详情页会重复。
5. 修改后运行：

```powershell
cd C:\Users\Lenovo\Desktop\Bone转化\bone-android
.\gradlew.bat :app:assembleDebug
```

Gradle 会自动把 `recovery\good-apk-public` 复制到 `android\app\src\main\assets\public`。
