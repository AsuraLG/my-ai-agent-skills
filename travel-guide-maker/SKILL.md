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

由用户指定或从 prompt 中提取。

### 定位结果示例

```
SKILL_ROOT=<动态定位>
XHS_ROOT=<动态定位>
DEST=<用户指定>
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

### ⚠️ 强制确认点

在以下节点，**必须使用 `AskUserQuestion` 工具**向用户提问。禁止用纯文本提问替代，禁止跳过。

| 确认点 | 触发时机 | 选项设计 |
|--------|---------|---------|
| 断点续跑确认 | 检测到已有 `workflow-state.json` 时 | "从断点继续（当前在 X 阶段）" / "重新开始（清除已有进度）" |
| 关键词确认 | KEYWORDS_CONFIRM 阶段 | 展示构建好的关键词列表，"确认使用这组关键词" / "我要修改关键词" |
| 跳过搜索确认 | SEARCH 阶段检测到 xiaohongshu-skills 不可用 | "跳过搜索，我自行准备原始素材" / "中止本次流程" |
| 搜索完成确认 | SEARCH_CONFIRM 阶段 | 展示搜索结果摘要，"确认，进入详情获取" / "继续搜索更多" / "调整关键词重新搜索" |
| 跳过详情获取确认 | FETCH_DETAILS 阶段检测到 xiaohongshu-skills 不可用 | "跳过，我自行准备素材" / "中止本次流程" |
| 文档生成前确认 | BUILD 阶段开始前 | 展示素材清单和就绪状态，"开始生成" / "等等，我还要调整" |
| 文档评审 | REVIEW 阶段，每次构建完成后 | "满意，流程结束" / "修改表达/结构" / "补充新内容" |

---

## 流程总览

### 第 0 步：启动与断点检测

每次 skill 触发时，首先检测是否存在未完成的流程：

```bash
node "$SKILL_ROOT/scripts/workflow.js" resume "$DEST"
```

- **`resumable: true`** → 用 `AskUserQuestion` 询问用户是否断点续跑
  - 选择"从断点继续" → 从 `resume_phase` 开始执行
  - 选择"重新开始" → 删除 `workflow-state.json`，从头开始
- **`resumable: false, action: start_fresh`** → 全新流程，直接开始

---

### 第 1 步：INIT — 初始化项目目录

```bash
# 校验
node "$SKILL_ROOT/scripts/workflow.js" check "$DEST" INIT

# 执行
node "$SKILL_ROOT/scripts/init-guide.js" "$DEST" <目的地名称>

# 初始化状态文件（init-guide.js 创建目录后）
node "$SKILL_ROOT/scripts/workflow.js" init "$DEST"

# 推进
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" INIT \
  --data '{"destination": "<目的地名称>"}'
```

> 注意：INIT 阶段比较特殊，`workflow.js init` 在 `init-guide.js` 之后执行（需要目录先存在）。首次执行时 `check INIT` 会因为状态文件不存在而失败，这是预期行为，此时直接执行 `init-guide.js` 和 `workflow.js init` 即可。

---

### 第 2 步：KEYWORDS_CONFIRM — 关键词确认

**前置检测 xiaohongshu-skills（使用已定位的 $XHS_ROOT，如果定位阶段已确定不可用则直接进入跳过逻辑）：**

```bash
ls "$XHS_ROOT/SKILL.md" 2>/dev/null && echo "available" || echo "unavailable"
```

- **不可用** → 用 `AskUserQuestion` 询问用户：
  - "跳过搜索，我自行准备原始素材" → 执行 `skip KEYWORDS_CONFIRM`（会级联跳过 SEARCH、SEARCH_CONFIRM、FETCH_DETAILS），流程跳到 TRANSFORM
  - "中止本次流程" → 停止执行，告知用户

- **可用** → 继续以下流程：

```bash
node "$SKILL_ROOT/scripts/workflow.js" check "$DEST" KEYWORDS_CONFIRM
```

AI 根据用户 prompt 中的目的地信息构建关键词列表（按相关性从高到低排序，通常 3-5 个），然后**必须用 `AskUserQuestion` 展示关键词列表让用户确认**。

用户可能要求修改，此时调整关键词后再次用 `AskUserQuestion` 确认，循环直到用户满意。

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

**必须用 `AskUserQuestion` 向用户展示搜索结果摘要**，包括：
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
  > "$DEST/note-details/<FEED_ID>.json"
```

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

> 如果搜索和详情获取阶段被跳过（用户自行准备素材），此步骤需要用户确认 `note-details/` 目录中已有数据，或 `mappings/` 中已有标准格式的 JSON 文件。如果 `mappings/` 已有文件可直接跳过 transform。

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

根据 `mappings/note-summary.json` 中的笔记内容，参考 `references/guide-template.md` 的模板格式，撰写 `markdown/guide.md` 攻略正文。

完成后推进：

```bash
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" WRITE_GUIDE
```

---

### 第 8 步：BUILD — 构建 Word 文档

```bash
node "$SKILL_ROOT/scripts/workflow.js" check "$DEST" BUILD
```

**必须用 `AskUserQuestion` 确认素材就绪：**

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

**必须用 `AskUserQuestion` 让用户评价文档**，选项：
- "满意，流程结束"
- "修改表达/结构（不需要新素材）"
- "补充新内容（需要搜索新素材）"

#### 修改表达/结构

用户描述调整需求（如"把这段话改简洁一点"、"调换 Day1 和 Day2 顺序"等），AI 直接修改 `markdown/guide.md`，重新构建：

```bash
cd "$DEST"
NODE_PATH="$(npm root -g)" node docx-assets/build_guide_docx.js
```

构建后再次用 `AskUserQuestion` 评价，循环直到满意。

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
     > "$DEST/note-details/<FEED_ID>.json"
   ```
4. 重新运行 transform 和 validate，将新笔记追加到中间产物中
   ```bash
   node "$SKILL_ROOT/scripts/adapters/xhs/transform.js" "$DEST"
   node "$SKILL_ROOT/scripts/validate.js" "$DEST"
   ```
5. 根据新素材补充 `markdown/guide.md`，重新构建 Word 文档
6. 再次用 `AskUserQuestion` 评价，循环直到满意

> 如果 xiaohongshu-skills 不可用，告知用户无法自动搜索新素材，建议用户自行补充信息后选择"修改表达/结构"方式调整。

#### 流程结束

用户选择"满意"时推进，流程结束：

```bash
node "$SKILL_ROOT/scripts/workflow.js" advance "$DEST" REVIEW
```

---

## 核心数据契约

> 无论走哪条路径，都必须产出这两个文件后才能构建文档。
> 详细字段说明和示例见 `references/data-spec.md`。

**`mappings/note-summary.json`** — 笔记摘要列表：每条包含 `feed_id`、`title`、`author`、`likedCount`（整数）、`collectedCount`（整数）、`commentCount`（整数）、`desc`（≤500字）、`top_comments`（数组）、`source_link`。

**`mappings/image-manifest.json`** — 图片映射列表：每条包含 `feed_id`、`title`、`image_count_downloaded`、`local_image_paths`（**绝对路径**）、`source_link`。

### 强制校验

TRANSFORM 阶段完成后、WRITE_GUIDE 开始前，**必须运行校验脚本**：

```bash
node "$SKILL_ROOT/scripts/validate.js" "$DEST"
```

校验内容包括：
- 字段类型严格检查（`likedCount` 必须是整数，不能是 `"2.8万"` 等字符串）
- 必填字段存在性
- `top_comments` 数组长度 ≤ 3
- `desc` 长度 ≤ 500
- `image_count_downloaded` 与 `local_image_paths` 长度一致
- `local_image_paths` 中每个路径必须是绝对路径
- `feed_id` 唯一性
- `note-summary.json` 与 `image-manifest.json` 之间的 `feed_id` 交叉引用一致性

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
   - **直接提供标准格式 JSON**：按 `references/data-spec.md` 整理 `note-summary.json` 和 `image-manifest.json`，放入 `mappings/` 目录，TRANSFORM 阶段可跳过
   - **提供原始详情文件**：将笔记详情 JSON 放入 `note-details/` 目录，由 `transform.js` 转换
3. 流程从 TRANSFORM 或 WRITE_GUIDE 阶段继续

---

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `Cannot find module 'docx'` | 缺少全局 npm 包 | `npm install -g docx` |
| 搜索返回空结果 | 关键词过于具体或小红书限流 | 简化关键词，等待后重试 |
| 图片附录为空但无报错 | 路径是相对路径 | 改为绝对路径（`/Users/...`）|
| 附录显示 `点赞 2.8万` | 互动数未转换 | `likedCount` 须为整数 `28000` |
| 流程中断后再次触发 | 上次会话意外中断 | skill 启动时自动检测断点，询问用户是否继续 |
