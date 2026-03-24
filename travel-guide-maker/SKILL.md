---
name: travel-guide-maker
description: |
  旅游攻略自动化生成技能。将旅游笔记原始素材（小红书、手动整理或其他来源）加工成结构化
  旅游攻略，输出为带目录、路线图、来源附录的 Word 文档（.docx）。
  用户提到"生成旅游攻略"、"整理旅行笔记"、"出行攻略文档"、"旅游 Word 文档"时务必使用本技能。
  用户提供了笔记素材但不知道如何整理成文档时，也应主动使用本技能。
  可与 xiaohongshu-skills 协作实现从小红书搜索到最终成品的完整自动化。
version: 1.0.0
---

# 旅游攻略生成 Skill

将旅游笔记素材整理成结构化攻略，输出为可交付的 Word 文档。核心价值与数据来源无关——素材符合固定格式即可，无论来自小红书、手动整理还是其他平台。

---

## 选择路径

先确认是否安装了 xiaohongshu-skills：

```bash
ls ~/.claude/skills/xiaohongshu-skills/SKILL.md 2>/dev/null \
  && echo "✓ 已安装，走路径 A" || echo "✗ 未安装，走路径 B"
```

- **路径 A（推荐）**：已安装 xiaohongshu-skills → AI 自动搜索采集，适配器自动转换格式
- **路径 B**：未安装 → 用户自行提供符合格式的素材，或扩展适配器

---

## 核心数据契约

> 无论走哪条路径，都必须产出这两个文件后才能构建文档。
> 详细字段说明和示例见 `references/data-spec.md`。

**`mappings/note-summary.json`** — 笔记摘要列表：每条包含 `feed_id`、`title`、`author`、`likedCount`（整数）、`collectedCount`（整数）、`commentCount`（整数）、`desc`（≤500字）、`top_comments`（数组）、`source_link`。

**`mappings/image-manifest.json`** — 图片映射列表：每条包含 `feed_id`、`title`、`image_count_downloaded`、`local_image_paths`（**绝对路径**）、`source_link`。

⚠️ 注意：互动数据必须是**整数**（`"2.8万"` 需转换为 `28000`）；图片路径必须是**绝对路径**。

---

## 路径 A：全自动（xiaohongshu-skills）

```bash
SKILL_ROOT="$HOME/.claude/skills/travel-guide-maker"
XHS_ROOT="$HOME/.claude/skills/xiaohongshu-skills"
DEST="<项目目录路径>"
```

### A-1 初始化项目目录

```bash
node "$SKILL_ROOT/scripts/init-guide.js" "$DEST" <目的地名称>
```

### A-2 多轮渐进式笔记搜索

搜索策略由 AI 自主执行，用文件记录状态（每轮保存到 `raw-search-snapshots/round-N-results.json`）。

**参数：** 目标 20 篇 · 初始点赞阈值 500 · 降级阈值 100 · 最多 10 轮 · 轮次间隔 5 分钟

**每轮决策逻辑：**

```
开始前：读取已有轮次文件，统计当前唯一 feed_id 总数

搜索：对所有活跃关键词调用 search-feeds，筛选 likedCount ≥ 阈值，去重后追加

本轮结束判断：
  已收集 ≥ 20             → 结束 → 进入 A-3
  阈值 = 500              → 下轮改为 100
  阈值 = 100              → 移除末尾关键词（相关性最低），重置阈值为 500
  关键词剩 1 个 / 达 10 轮 → 结束 → 进入 A-3
  否则                    → 等待 5 分钟，继续
```

**搜索命令：**

```bash
cd "$XHS_ROOT"
.venv/bin/python scripts/cli.py search-feeds \
  --keyword "<关键词>" --sort-by "最多点赞" --note-type "图文"
```

搜索结束后汇总所有轮次结果（按 likedCount 降序取前 20），保存到 `raw-search-snapshots/selected-feeds.json`。

### A-3 获取笔记详情和图片

对 `selected-feeds.json` 中每篇笔记（每篇间隔 2-3 秒）：

```bash
cd "$XHS_ROOT"

# 获取详情
.venv/bin/python scripts/cli.py get-feed-detail \
  --feed-id <FEED_ID> --xsec-token <XSEC_TOKEN> \
  > "$DEST/note-details/<FEED_ID>.json"

# 下载图片（从详情的 imageList 提取 urlDefault）
.venv/bin/python scripts/image_downloader.py \
  --feed-id <FEED_ID> --image-urls <URL1> <URL2> \
  --output-dir "$DEST/images/<FEED_ID>"
```

### A-4 转换为标准中间产物

```bash
# 预览（不写入）
node "$SKILL_ROOT/scripts/adapters/xhs/transform.js" "$DEST" --dry-run

# 正式转换 → 生成 note-summary.json 和 image-manifest.json
node "$SKILL_ROOT/scripts/adapters/xhs/transform.js" "$DEST"
```

### 📋 路径 A 提示词模板

用户可直接使用此模板发给 AI：

```
我想生成一份【目的地】旅游攻略。

目的地：[目的地名称]
项目目录：[本地路径，如 ~/Documents/ningbo-guide]

搜索关键词（按相关性从高到低）：
1. [目的地]两日游
2. [目的地]旅游攻略
3. [目的地]必打卡
4. [目的地]周末游

请按以下步骤执行：
1. 用 init-guide.js 初始化项目目录
2. 用 xiaohongshu-skills 执行多轮渐进式搜索（目标 20 篇，阈值 500→100，逐步减关键词，每轮间隔 5 分钟）
3. 逐一获取详情（get-feed-detail）保存到 note-details/，下载图片到 images/<feed_id>/
4. 运行 scripts/adapters/xhs/transform.js 生成中间产物
5. 根据笔记内容撰写 markdown/guide.md（参考 references/guide-template.md）
6. 路线图我会自行放入 route-map/route-map.png，确认后再构建
7. 运行 build_guide_docx.js 构建 Word 文档
```

---

## 路径 B：手动提供素材

**B-1 直接提供标准格式 JSON**：按数据契约（见 `references/data-spec.md`）自行整理 `note-summary.json` 和 `image-manifest.json`，直接进入文档生成步骤。

**B-2 扩展适配器**：仿照 `scripts/adapters/xhs/transform.js` 新建 `scripts/adapters/<platform>/transform.js`，将其他平台原始数据转换为标准格式。

---

## 文档生成

确认以下素材就绪：

```
✓ guide.config.json          （init-guide.js 已自动生成）
✓ markdown/guide.md          （见 references/guide-template.md）
✓ route-map/route-map.png    （建议截图自地图 App，竖向 2:3，PNG）
✓ mappings/note-summary.json
✓ mappings/image-manifest.json
```

构建命令：

```bash
cd <destination-guide>

# 精装版（推荐，需全局安装 docx：npm install -g docx）
NODE_PATH="$(npm root -g)" node docx-assets/build_guide_docx.js

# 简洁版（需系统安装 pandoc）
node docx-assets/build_guide_pandoc.js
```

输出：`docx-assets/output.docx`

---

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `Cannot find module 'docx'` | 缺少全局 npm 包 | `npm install -g docx` |
| `Route map not found` | 路线图未放置 | 放入 `route-map/route-map.png` |
| 图片附录为空但无报错 | 路径是相对路径 | 改为绝对路径（`/Users/...`）|
| 附录显示 `点赞 2.8万` | 互动数未转换 | `likedCount` 须为整数 `28000` |
