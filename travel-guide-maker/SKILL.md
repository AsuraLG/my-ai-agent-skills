---
name: travel-guide-maker
description: |
  旅游攻略自动化生成技能。将旅游笔记原始素材（小红书、手动整理或其他来源）加工成结构化
  旅游攻略，输出为带目录、路线图、来源附录的 Word 文档（.docx）。
  用户提到"生成旅游攻略"、"整理旅行笔记"、"出行攻略文档"、"旅游 Word 文档"时务必使用本技能。
  用户提供了笔记素材但不知道如何整理成文档时，也应主动使用本技能。
  可与 xiaohongshu-skills 协作实现从小红书搜索到最终成品的完整自动化。
version: 2.0.0
---

# 旅游攻略生成 Skill

将旅游笔记素材整理成结构化攻略，输出为可交付的 Word 文档。核心价值与数据来源无关——素材符合固定格式即可，无论来自小红书、手动整理还是其他平台。

---

## Skill 路径定位

本 skill 依赖两个路径，**不要使用硬编码路径**，必须通过以下方式动态定位并告知用户定位结果：

### SKILL_ROOT（当前 skill）

通过本 SKILL.md 的加载路径推断。例如 SKILL.md 位于 `/path/to/travel-guide-maker/SKILL.md`，则 `SKILL_ROOT=/path/to/travel-guide-maker`。

### XHS_ROOT（xiaohongshu-skills）

按标准 skill 安装目录查找，按优先级从高到低搜索：

```bash
# 项目级 → 用户全局级
for dir in ".claude/skills" "$HOME/.claude/skills"; do
  if [ -f "$dir/xiaohongshu-skills/SKILL.md" ]; then
    echo "found: $dir/xiaohongshu-skills"
    break
  fi
done
```

- **找到** → 取其路径作为 `XHS_ROOT`，告知用户："已定位到 xiaohongshu-skills: <路径>"
- **未找到** → 告知用户："未在标准 skill 目录中找到 xiaohongshu-skills，搜索和详情获取功能不可用"

### DEST（项目目录）

由 `init-guide.js` 自动确定。默认为 `<CWD>/travel-guide`，可通过 `--dest` 参数指定其他路径。init 完成后从输出 JSON 的 `dest` 字段获取实际路径，后续步骤使用该值作为 `$DEST`。

### 定位结果示例

```
SKILL_ROOT=<动态定位>
XHS_ROOT=<动态定位>
DEST=<init-guide.js 输出的 dest 字段>
```

---

## 状态机与流程管控

本 skill 使用状态机管理流程推进，所有状态通过 `workflow-state.json` 持久化。

**状态流转：**

```
INIT → KEYWORDS_CONFIRM → SEARCH → SEARCH_CONFIRM → FETCH_DETAILS → TRANSFORM → WRITE_GUIDE → BUILD → REVIEW
```

**管理脚本：** `$SKILL_ROOT/scripts/workflow.js`

```bash
node "$SKILL_ROOT/scripts/workflow.js" init <dest-dir>                              # 初始化状态
node "$SKILL_ROOT/scripts/workflow.js" status <dest-dir>                            # 查看当前状态
node "$SKILL_ROOT/scripts/workflow.js" resume <dest-dir>                            # 获取断点续跑信息
node "$SKILL_ROOT/scripts/workflow.js" check <dest-dir> <phase>                     # 校验并进入阶段
node "$SKILL_ROOT/scripts/workflow.js" advance <dest-dir> <phase> [--data '<json>'] # 标记完成并推进
node "$SKILL_ROOT/scripts/workflow.js" skip <dest-dir> <phase> --reason "<reason>"  # 跳过阶段
```

### 强制规则

1. **每个步骤开始前**必须运行 `check` 校验前置条件
2. **每个步骤完成后**必须运行 `advance` 推进状态
3. **不得跳过 `check`/`advance` 调用**，即使看起来"显然可以继续"
4. 所有 `check`/`advance`/`skip` 的输出都是 JSON，以此判断流程是否正常

---

## 用户确认机制

### 确认工具选择

所有需要向用户确认的节点，优先使用 `AskUserQuestion` 工具（提供结构化选项，体验更好）。如果当前环境不支持 `AskUserQuestion`（非 Claude Code 环境），则回退到常规文本提问方式，直接向用户描述选项并等待回复。

以下各步骤中提到"向用户确认"时，均遵循此规则，不再逐一说明。

| 确认点 | 触发时机 | 选项设计 |
|--------|---------|---------|
| 初始化参数确认 | 调用 `init-guide.js` 前 | "行程几天？（默认 2）" / "素材来源？(小红书搜索 / 手动提供 / 其他平台)" |
| 断点续跑确认 | `init-guide.js` 输出 `status: "resumable"` 时 | "从断点继续（当前在 X 阶段）" / "重新开始（清除已有进度）" |
| 关键词确认 | KEYWORDS_CONFIRM 阶段 | 展示构建好的关键词列表，"确认使用这组关键词" / "我要修改关键词" |
| 跳过搜索确认 | KEYWORDS_CONFIRM 阶段检测到 xiaohongshu-skills 不可用 | "跳过搜索，我自行准备原始素材" / "中止本次流程" |
| 搜索完成确认 | SEARCH_CONFIRM 阶段 | 展示搜索结果摘要，"确认，进入详情获取" / "继续搜索更多" / "调整关键词重新搜索" |
| 素材就绪确认 | TRANSFORM 阶段，搜索和详情获取被跳过时 | "note-details/ 或 mappings/ 中已有数据，继续" / "等等，我还没准备好" |
| 文档生成前确认 | BUILD 阶段开始前 | 展示素材清单和就绪状态，"开始生成" / "等等，我还要调整" |
| 文档评审 | REVIEW 阶段，每次构建完成后 | "满意，流程结束" / "修改表达/结构" / "补充新内容" |

---

## 流程总览

### 第 1 步：INIT — 启动与初始化

`init-guide.js` 统一处理目录检测、断点发现和项目初始化。

**参数获取方式：** 向用户确认行程天数和素材来源类型，将用户回答作为 `--days` 和 `--source` 参数传递。`--days` 默认值为 2，`--source` 默认值为 manual。

```bash
node "$SKILL_ROOT/scripts/init-guide.js" <目的地名称> --days <天数> --source <xhs|manual|other>
```

> `--dest` 可选，不传时默认使用 `<CWD>/travel-guide`。`--force` 用于强制重新初始化。

根据输出 JSON 的 `status` 字段决定后续操作：

- **`status: "resumable"`** → 检测到未完成的流程。向用户确认：
  - "从断点继续（当前在 X 阶段）" → 运行 `workflow.js resume "$DEST"` 获取断点详情，从 `resume_phase` 开始执行
  - "重新开始（清除已有进度）" → 加 `--force` 重新执行 `init-guide.js`，然后按下方 `initialized` 流程处理

- **`status: "initialized"`** → 初始化完成，从输出的 `dest` 字段获取 `$DEST` 路径，继续执行：

```bash
# 初始化状态文件
node "$SKILL_ROOT/scripts/workflow.js" init "$DEST"

# 推进
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" INIT \
  --data '{"destination": "<目的地名称>", "days": <天数>, "sourceType": "<来源类型>"}'
```

---

### 第 2 步：KEYWORDS_CONFIRM — 关键词确认

**前置检测 xiaohongshu-skills（使用已定位的 $XHS_ROOT，如果定位阶段已确定不可用则直接进入跳过逻辑）：**

分两级检测。第一级，文件存在性：

```bash
ls "$XHS_ROOT/SKILL.md" 2>/dev/null && echo "available" || echo "unavailable"
```

第二级，真实可用性探测（xiaohongshu-skills 依赖浏览器扩展 XHS Bridge，文件存在不代表可用）：

```bash
cd "$XHS_ROOT"
.venv/bin/python scripts/cli.py check-login
```

- 返回 JSON（无论是否已登录）→ 可用
- 命令报错（如 bridge/扩展未连接）→ 告知用户："xiaohongshu-skills 不可用，请确认 Chrome 已安装并启用 XHS Bridge 扩展（chrome://extensions/ → 开发者模式 → 加载已解压的扩展程序 → 选择 $XHS_ROOT/extension/ 目录），然后重试"。用户处理后可重测；用户选择不处理则按"不可用"分支走
- 返回 `logged_in: false` → 引导用户先完成小红书登录（xiaohongshu-skills 的 xhs-auth 流程）再继续

- **不可用** → 向用户确认：
  - "跳过搜索，我自行准备原始素材" → 执行 `skip KEYWORDS_CONFIRM`（会级联跳过 SEARCH、SEARCH_CONFIRM、FETCH_DETAILS），流程跳到 TRANSFORM
  - "中止本次流程" → 停止执行，告知用户

- **可用** → 继续以下流程：

```bash
node "$SKILL_ROOT/scripts/workflow.js" check "$DEST" KEYWORDS_CONFIRM
```

AI 根据用户 prompt 中的目的地信息构建关键词列表（按相关性从高到低排序，通常 3-5 个），然后**向用户确认关键词列表**。

用户可能要求修改，此时调整关键词后再次确认，循环直到用户满意。

确认后推进：

```bash
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" KEYWORDS_CONFIRM \
  --data '{"keywords": ["关键词1", "关键词2", "关键词3"]}'
```

---

### 第 3 步：SEARCH — 多轮渐进式笔记搜索

```bash
node "$SKILL_ROOT/scripts/workflow.js" check "$DEST" SEARCH
```

搜索策略由 AI 自主执行，用文件记录状态（每轮保存到 `raw-search-snapshots/round-N-results.json`）。

**参数：** 目标 20 篇 · 初始点赞阈值 500 · 降级阈值 100 · 最多 10 轮 · 轮次间隔 5 分钟

**渐进式扩大搜索范围策略：**

初始状态只使用第 1 个关键词（优先级最高），逐步引入更多关键词来扩大搜索范围。每引入新关键词时只搜索新增的（之前已搜过的不再重复）。

```
初始：活跃关键词 = [关键词1]，阈值 = 500

每轮流程：
  1. 对本轮新增的关键词调用 search-feeds，筛选 likedCount ≥ 阈值，去重后追加
  2. 判断：
     已收集 ≥ 20             → 结束
     阈值 = 500              → 下轮阈值降为 100（不变更关键词）
     阈值 = 100              → 引入下一个关键词，阈值重置为 500
     关键词已全部引入 / 达 10 轮 → 结束
     否则                    → 等待 5 分钟，继续

示例（3 个关键词 A、B、C）：
  轮1：搜索 A，阈值 500
  轮2：搜索 A，阈值 100     ← 降阈值，不引入新词
  轮3：搜索 B，阈值 500     ← 引入 B（A 已搜过，不重复）
  轮4：搜索 B，阈值 100
  轮5：搜索 C，阈值 500     ← 引入 C
  轮6：搜索 C，阈值 100
  → 关键词全部用完，结束
```

**搜索命令（$XHS_ROOT 为动态定位的 xiaohongshu-skills 路径）：**

```bash
cd "$XHS_ROOT"
.venv/bin/python scripts/cli.py search-feeds --keyword "<关键词>"
```

> ⚠️ 不要使用 `--sort-by` 和 `--note-type` 参数，使用默认综合排序即可。点赞数筛选在本地通过 likedCount 字段完成。

搜索结束后汇总所有轮次结果（按 likedCount 降序取前 20），保存到 `raw-search-snapshots/selected-feeds.json`。

```bash
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" SEARCH \
  --data '{"rounds": 3, "total_collected": 18, "final_threshold": 100}'
```

---

### 第 4 步：SEARCH_CONFIRM — 搜索结果确认

```bash
node "$SKILL_ROOT/scripts/workflow.js" check "$DEST" SEARCH_CONFIRM
```

**向用户展示搜索结果摘要**，包括：
- 共搜索了几轮
- 收集到多少篇笔记
- 笔记列表概要（标题、作者、点赞数）

选项：
- "确认，进入详情获取" → 推进
- "继续搜索更多" → 回到 SEARCH 阶段继续（需重置 SEARCH 状态）
- "调整关键词重新搜索" → 回到 KEYWORDS_CONFIRM 阶段

确认后：

```bash
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" SEARCH_CONFIRM
```

---

### 第 5 步：FETCH_DETAILS — 获取笔记详情

```bash
node "$SKILL_ROOT/scripts/workflow.js" check "$DEST" FETCH_DETAILS
```

对 `selected-feeds.json` 中每篇笔记（每篇间隔 2-3 秒）：

```bash
cd "$XHS_ROOT"
.venv/bin/python scripts/cli.py get-feed-detail \
  --feed-id <FEED_ID> --xsec-token <XSEC_TOKEN> \
  --keyword "<目的地>" \
  > "$DEST/note-details/<FEED_ID>.json"
```

> ⚠️ `--keyword` 传本次攻略的目的地（或当篇笔记对应的搜索关键词）。该参数用于 xiaohongshu-skills 风控重试时的搜索词，不传时默认值与旅游场景不符。

> ℹ️ `transform.js` 在没有图片时依然可以正常生成 `image-manifest.json`（`image_count_downloaded` 为 0），不影响文档构建。

完成后推进：

```bash
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" FETCH_DETAILS \
  --data '{"fetched_count": 18}'
```

---

### 第 6 步：TRANSFORM — 转换为标准中间产物

```bash
node "$SKILL_ROOT/scripts/workflow.js" check "$DEST" TRANSFORM
```

执行转换：

```bash
# 预览（不写入）
node "$SKILL_ROOT/scripts/adapters/xhs/transform.js" "$DEST" --dry-run

# 正式转换
node "$SKILL_ROOT/scripts/adapters/xhs/transform.js" "$DEST"
```

> 如果搜索和详情获取阶段被跳过（用户自行准备素材），向用户确认 `note-details/` 目录中已有数据，或 `mappings/` 中已有标准格式的 JSON 文件。如果 `mappings/` 已有文件可直接跳过 transform。

转换完成后，**必须运行数据契约校验**：

```bash
node "$SKILL_ROOT/scripts/validate.js" "$DEST"
```

校验通过（`valid: true`）后才能推进：

```bash
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" TRANSFORM
```

校验失败时禁止推进，必须先修复数据问题后重新校验。

---

### 第 7 步：WRITE_GUIDE — 撰写攻略正文

```bash
node "$SKILL_ROOT/scripts/workflow.js" check "$DEST" WRITE_GUIDE
```

根据 `mappings/note-summary.json` 中的素材内容，参考 `references/guide-template.md` 的结构规范，在 `markdown/guide.md`（已由 init-guide.js 生成骨架）上填充攻略正文。注意根据 `guide.config.json` 中的 `sourceType` 和 `days` 调整内容措辞。

完成后推进：

```bash
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" WRITE_GUIDE
```

---

### 第 8 步：BUILD — 构建 Word 文档

```bash
node "$SKILL_ROOT/scripts/workflow.js" check "$DEST" BUILD
```

**向用户确认素材就绪：**

```
✓ guide.config.json          （init-guide.js 已自动生成）
✓ markdown/guide.md          （已撰写）
○ route-map/route-map.png    （可选，建议截图自地图 App，竖向 2:3，PNG；不提供则跳过路线图页）
✓ mappings/note-summary.json
✓ mappings/image-manifest.json
```

选项："开始生成" / "等等，我还要调整"

确认后构建：

```bash
cd "$DEST"

# 精装版（推荐，需全局安装 docx：npm install -g docx）
NODE_PATH="$(npm root -g)" node docx-assets/build_guide_docx.js

# 简洁版（需系统安装 pandoc）
node docx-assets/build_guide_pandoc.js
```

输出：`docx-assets/output.docx`

```bash
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" BUILD
```

---

### 第 9 步：REVIEW — 文档评审与迭代

```bash
node "$SKILL_ROOT/scripts/workflow.js" check "$DEST" REVIEW
```

此阶段是一个**评审-调整-重建的循环**，直到用户满意为止。

**向用户确认文档评价**，选项：
- "满意，流程结束"
- "修改表达/结构（不需要新素材）"
- "补充新内容（需要搜索新素材）"

#### 修改表达/结构

用户描述调整需求（如"把这段话改简洁一点"、"调换 Day1 和 Day2 顺序"等），AI 直接修改 `markdown/guide.md`，重新构建：

```bash
cd "$DEST"
NODE_PATH="$(npm root -g)" node docx-assets/build_guide_docx.js
```

构建后再次向用户确认评价，循环直到满意。

#### 补充新内容

用户描述想补充的内容（如"加上 XX 景点"、"补充当地美食推荐"等），执行轻量搜索：

1. AI 根据用户需求构建 1-2 个针对性关键词
2. 用 xiaohongshu-skills 搜索 1 轮，筛选相关笔记（无需多轮渐进式搜索）
   ```bash
   cd "$XHS_ROOT"
   .venv/bin/python scripts/cli.py search-feeds --keyword "<关键词>"
   ```
3. 获取筛选后笔记的详情，保存到 `note-details/`
   ```bash
   cd "$XHS_ROOT"
   .venv/bin/python scripts/cli.py get-feed-detail \
     --feed-id <FEED_ID> --xsec-token <XSEC_TOKEN> \
     --keyword "<目的地>" \
     > "$DEST/note-details/<FEED_ID>.json"
   ```
4. 重新运行 transform 和 validate，将新笔记追加到中间产物中
   ```bash
   node "$SKILL_ROOT/scripts/adapters/xhs/transform.js" "$DEST"
   node "$SKILL_ROOT/scripts/validate.js" "$DEST"
   ```
5. 根据新素材补充 `markdown/guide.md`，重新构建 Word 文档
6. 再次向用户确认评价，循环直到满意

> 如果 xiaohongshu-skills 不可用，告知用户无法自动搜索新素材，建议用户自行补充信息后选择"修改表达/结构"方式调整。

#### 流程结束

用户选择"满意"时推进，流程结束：

```bash
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" REVIEW
```

---

## 核心数据契约

> 无论走哪条路径，都必须产出 `mappings/note-summary.json` 和 `mappings/image-manifest.json` 后才能构建文档。

**权威定义：** `$SKILL_ROOT/schemas/note-summary.schema.json` 和 `$SKILL_ROOT/schemas/image-manifest.schema.json`（JSON Schema 格式）。

**概要：**
- **`note-summary.json`** — 素材摘要列表：每条含 `feed_id`、`title`、`author`、互动数据（整数）、`desc`（≤500字）、`top_comments`（≤3条）、`source_link`
- **`image-manifest.json`** — 图片映射列表：每条含 `feed_id`、`title`、`image_count_downloaded`、`local_image_paths`（**绝对路径**）、`source_link`

**非小红书来源的数据适配：**
- 无互动数据 → `likedCount` / `collectedCount` / `commentCount` 填 `0`
- 无 feed_id → 自行生成唯一 ID，如 `"manual-001"`
- 无评论数据 → `top_comments` 填 `[]`
- 无来源链接 → `source_link` 填 `""`
- 图片未下载 → `image_count_downloaded: 0`，`local_image_paths: []`

详细字段约束（类型、必填、长度限制等）请直接查看 schema 文件。

### 强制校验

TRANSFORM 阶段完成后、WRITE_GUIDE 开始前，**必须运行校验脚本**：

```bash
node "$SKILL_ROOT/scripts/validate.js" "$DEST"
```

校验内容：
- JSON Schema 结构校验（字段类型、必填、长度限制等，由 ajv 引擎执行）
- `feed_id` 唯一性
- `image_count_downloaded` 与 `local_image_paths` 长度一致
- `local_image_paths` 中每个路径必须是绝对路径
- `note-summary.json` 与 `image-manifest.json` 之间的 `feed_id` 交叉引用一致性

> ⚠️ 首次使用本 skill 前需在 `$SKILL_ROOT` 目录执行 `npm install` 安装 ajv 依赖。

**校验不通过（退出码 1）时禁止继续推进流程**，必须先修复数据问题。

---

## 关键验证检查点

每个阶段完成后必须验证，发现异常立即停止并排查，不要继续推进：

| 阶段 | 验证命令 | 预期结果 |
|------|---------|----------|
| SEARCH 后 | `cat "$DEST/raw-search-snapshots/selected-feeds.json" \| python -c "import json,sys; d=json.load(sys.stdin); print(len(d), '篇')"` | ≥ 10 篇（目标 20 篇）|
| FETCH_DETAILS 后 | `ls "$DEST/note-details/" \| wc -l` | 与 selected-feeds.json 条数一致 |
| TRANSFORM 后 | `node "$SKILL_ROOT/scripts/validate.js" "$DEST"` | `valid: true`，无错误 |
| BUILD 后 | `ls -lh "$DEST/docx-assets/output.docx"` | 文件存在且大小 > 50KB |

---

## 手动提供素材（跳过搜索路径）

当 xiaohongshu-skills 不可用或用户选择跳过搜索时：

1. 搜索和详情获取阶段被标记为 `skipped`
2. 用户需自行准备素材，有两种方式：
   - **直接提供标准格式 JSON**：按 `$SKILL_ROOT/schemas/` 下的 JSON Schema 整理 `note-summary.json` 和 `image-manifest.json`，放入 `mappings/` 目录，TRANSFORM 阶段可跳过
   - **提供原始详情文件**：将笔记详情 JSON 放入 `note-details/` 目录，由 `transform.js` 转换
3. 流程从 TRANSFORM 或 WRITE_GUIDE 阶段继续

---

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `Cannot find module 'docx'` | 缺少全局 npm 包 | `npm install -g docx` |
| 搜索返回空结果 | 关键词过于具体或小红书限流 | 简化关键词，等待后重试 |
| 搜索/详情命令报 bridge 或扩展未连接 | xiaohongshu-skills 需要浏览器扩展 | Chrome 安装并启用 XHS Bridge 扩展（加载 `$XHS_ROOT/extension/`），cli.py 会自动拉起 bridge_server |
| 图片附录为空但无报错 | 路径是相对路径 | 改为绝对路径（`/Users/...`）|
| 附录显示 `点赞 2.8万` | 互动数未转换 | `likedCount` 须为整数 `28000`（见 schemas/note-summary.schema.json）|
| 流程中断后再次触发 | 上次会话意外中断 | skill 启动时自动检测断点，询问用户是否继续 |
