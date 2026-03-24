# 数据规范：中间产物 JSON 格式

本 skill 的核心接口契约。无论素材来自哪里，都必须产出这两个文件才能构建文档。

---

## note-summary.json

**路径：** `mappings/note-summary.json`
**用途：** 构建文档的「附录｜来源摘要」章节。

```json
[
  {
    "feed_id": "673abc123456",
    "title": "宁波两日游｜这条路线太绝了",
    "author": "旅行博主小明",
    "likedCount": 28000,
    "collectedCount": 12000,
    "commentCount": 368,
    "desc": "Day1 天一广场→月湖→老外滩 超详细攻略（去除多余换行，≤500字符）",
    "top_comments": ["好详细！已收藏", "Day2 可以去溪口"],
    "source_link": "https://www.xiaohongshu.com/explore/673abc123456?xsec_token=..."
  }
]
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `feed_id` | string | ✅ | 笔记唯一 ID |
| `title` | string | ✅ | 缺失时填 `"无标题笔记"` |
| `author` | string | ✅ | 缺失时填 `"未知作者"` |
| `likedCount` | **number** | ✅ | **整数**，非字符串（`"2.8万"` → `28000`）|
| `collectedCount` | **number** | ✅ | 同上 |
| `commentCount` | **number** | ✅ | 同上 |
| `desc` | string | ✅ | 正文摘要，去除多余空白，≤ 500 字符 |
| `top_comments` | string[] | ✅ | 高赞评论文本，1-3 条，无则填 `[]` |
| `source_link` | string | ✅ | 原文链接，无则填 `""` |

---

## image-manifest.json

**路径：** `mappings/image-manifest.json`
**用途：** 构建文档的「附录｜图片映射摘要」章节。

```json
[
  {
    "feed_id": "673abc123456",
    "title": "宁波两日游｜这条路线太绝了",
    "image_count_downloaded": 2,
    "local_image_paths": [
      "/Users/xxx/ningbo-guide/images/673abc123456/01.jpg",
      "/Users/xxx/ningbo-guide/images/673abc123456/02.jpg"
    ],
    "source_link": "https://www.xiaohongshu.com/explore/673abc123456?xsec_token=..."
  }
]
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `feed_id` | string | ✅ | 与 note-summary.json 保持一致 |
| `title` | string | ✅ | 笔记标题 |
| `image_count_downloaded` | number | ✅ | 实际下载成功数量 |
| `local_image_paths` | string[] | ✅ | **必须是绝对路径**，相对路径会导致构建失败 |
| `source_link` | string | ✅ | 同 note-summary.json |

---

## 非 xiaohongshu-skills 来源的数据适配

如素材来自其他渠道，按以下方式填充：

| 场景 | 处理方式 |
|------|----------|
| 无互动数据 | `likedCount` / `collectedCount` / `commentCount` 填 `0` |
| 互动数据为字符串 | `"2.8万"` → `28000`，`"368"` → `368` |
| 无 feed_id | 自行生成唯一 ID，如 `"manual-001"` |
| 无评论数据 | `top_comments` 填 `[]` |
| 无来源链接 | `source_link` 填 `""` |
| 图片未下载 | `image_count_downloaded: 0`，`local_image_paths: []` |

---

## xiaohongshu-skills 原始输出 → 标准格式映射

当使用 `adapters/xhs/transform.js` 时，脚本会自动处理以下转换：

- `note.noteId` → `feed_id`
- `note.user.nickname` → `author`
- `note.interactInfo.likedCount`（字符串 `"2.8万"`）→ `likedCount`（整数 `28000`）
- `comments[]` 按 `likeCount` 降序 → `top_comments`（前 3 条 `content`）
- `note.desc` 去空白截断 500 字符 → `desc`
- `noteId` + `xsecToken` 拼接 → `source_link`
- 扫描 `images/<feed_id>/` 目录 → `local_image_paths`（绝对路径）
