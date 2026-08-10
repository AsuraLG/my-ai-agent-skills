# travel-guide-maker 开发记录

> 本文件建立于 2026-08-10，早于此的内容从 git 提交信息与代码反推，已标注出处 commit。

## 设计决策

### JSON Schema 作为数据契约的唯一权威定义（c6b4327，2026-05-21）

`schemas/` 目录下的 JSON Schema 是数据结构的唯一定义源，`validate.js` 用 ajv 加载 schema 做结构校验。

同时删除了 `references/data-spec.md`——它与 schema 描述同一件事，两份文档会不同步。宁可只留机器可校验的那份。

### 流程重构为 9 阶段状态机（a150cb6，2026-05-18）

SKILL.md 从 v1 到 v2 的核心变更。动机是支持断点续跑：长流程中途失败时不必从头再来。配套 `workflow.js` 提供 init/status/resume/check/advance/skip 命令。

同时引入 AskUserQuestion 强制确认点，避免流程在关键分叉处自行其是。

### 输出流分工：stderr 给人，stdout 给机器（fb1f433，2026-05-21）

`init-guide.js` 的人类可读信息走 stderr，结构化 JSON 走 stdout。这样调用方可以直接管道解析 stdout，不必从混合输出里挑。

### dest 默认 `<CWD>/travel-guide`，不再要求用户指定（fb1f433，2026-05-21）

接口从要求显式传 dest 改为 `<name> [--dest dir] [--days N] [--source S] [--force]`。少一个必填参数，减少启动摩擦。

`--force` 用于跳过断点检测并清空目录重建。

### 搜索策略：逐步引入关键词，而非逐步剔除（a150cb6，2026-05-18）

原策略是「每轮搜全部关键词，然后移除优先级最低的」，改为「逐步引入关键词扩大范围」。

同一提交里还去掉了 `--sort-by` 参数，改用默认综合排序，点赞筛选放到本地做。

### Skill 路径动态定位（a150cb6，2026-05-18）

不再硬编码 skill 路径，因为 skill 的实际安装位置由使用者决定。

## 踩坑记录

### 上游 xiaohongshu-skills 架构迁移导致前置检测失效（3d55bfa，2026-06-11）

上游从 CDP 直连迁移为 bridge_server + Chrome 扩展（XHS Bridge）架构。原来「文件存在」的单级检测不再能说明可用性——文件在，但扩展没装或 bridge 没起，照样跑不通。

改为两级检测：文件存在 + `check-login` 真实探测，失败时给出扩展安装指引。

**教训**：依赖外部工具时，「装了」和「能用」是两件事，前置检测要探测后者。

### 风控重试时使用默认搜索词（3d55bfa，2026-06-11）

`get-feed-detail` 在风控触发重试时会退回默认搜索词，与实际目的地无关。补 `--keyword` 参数把目的地传下去。

### 正文字段在新旧格式间不兼容（3d55bfa，2026-06-11）

新版返回干净的 `body` 字段（不含话题标记），旧格式只有 `desc`。`transform.js` 改为优先取 `body`、无则回退 `desc`，保持向后兼容。fixture 补了 `body`/`tags` 字段，新增两个用例覆盖优先与回退两条路径。

## 版本变更

- **v2**（2026-05-18，a150cb6 起）流程重构为 9 阶段状态机，支持断点续跑与强制确认点；引入 JSON Schema 校验体系与测试基础设施；适配 xiaohongshu-skills 新架构。
- **v1**（2026-03-24，809aaf0）初版。将旅游笔记素材加工为带目录、路线图与来源附录的 Word 文档。
