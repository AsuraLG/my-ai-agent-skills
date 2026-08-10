# 仓库自身开发记录

本仓库既是 skill 的**维护**场所，也是 skill 的**开发**场所。`dev/` 存放开发资产，不随 skill 分发。

## 设计决策

### 为什么把开发过程搬进这个仓库（2026-08-10）

改造前的工作方式：单开一个项目开发 skill，开发完成后把 skill 目录复制到本仓库收录。问题是跨项目搬运麻烦，且开发期的决策、踩坑、试验记录留在原开发项目里，收录时丢失。

改造目标：开发和维护在同一个仓库完成，零搬运。

### 为什么开发资产集中在 dev/ 而不是放进各 skill 目录

约束来自使用者：skill 目录会被整个复制走，使用者需要一眼看清哪个目录是纯 skill、不夹带开发信息。

因此分界判据只有一条：

| 内容 | 位置 |
| --- | --- |
| 使用者需要的 | skill 目录内 |
| 使用者不需要的 | `dev/<skill-name>/` |

按此判据，`evals/`、`tests/`、`references/`、`assets/` 留在 skill 目录内——它们是 skill 的验证与支撑资产，跟着 skill 走才有意义；决策记录、踩坑、版本日志、调试产物进 `dev/`。

排除过的两个方案：

- `<skill>.dev/` 与 skill 目录并列命名——根目录会变成 `nano-banana/`、`nano-banana.dev/` 交替出现，恰好破坏「一眼看清哪些是纯 skill」这个目标。
- `<skill>/.dev/` 放在 skill 目录内——复制走 skill 时会连开发信息一起带走，直接违背分界判据。

### 为什么不做「开发中 / 已发布」的目录分级

已发布的 skill 仍会持续迭代，发布不是终点。用 `drafts/` 孵化再 `git mv` 出来，等于把「一次性搬运」重新引进来，与改造目标冲突。

真正需要分开的是**同一个 skill 的两种形态**（纯分发形态 vs 带开发资产的完整形态），不是两种生命周期阶段。`dev/` 已经解决了这个问题。

### 为什么每个 skill 只用一个 NOTES.md

拆成 `decisions.md` / `pitfalls.md` / `CHANGELOG.md` 三个文件，会在 9 个 skill 下产生大量只有标题的空文件。空模板文件比没有更糟——它们制造「已经在维护」的假象。

单文件三章节，写的时候不用想放哪个文件，看的时候一屏看完。某个 skill 真写胀了再单独拆。

### 为什么调试产物放 dev/<skill>/scratch/ 并 gitignore

产物就近放在对应 skill 的开发目录下，方便边跑边对照；不进版本控制，避免仓库膨胀。真需要留作回归基准的样本，手动挪到 skill 自己的 `tests/fixtures/`。

### 为什么规范写在根 CLAUDE.md

规范的实际执行者是 AI。写在根 `CLAUDE.md`，每次在本项目开会话自动加载，写了就会被遵守；写在 `dev/README.md` 里 AI 不会自动读到，等于没写。

同理不再另写一份面向人的 `dev/README.md`——两份文档描述同一套规范，改的时候容易只改一边。

### 版本号递增判据：任何影响执行结果的变更都递增

构成 skill 的任何一部分发生变化，都算一个新版本，包括 SKILL.md 正文的措辞调整。理由是 SKILL.md 正文就是 skill 的执行指令，改措辞就可能改变 agent 的行为，与改脚本没有本质区别。

不按「大改升版本、小修不升」来判——「小修」这个界限无法客观划定，而一旦版本号和实际内容脱钩，版本号就失去了对账价值。

历史遗留不回溯：`travel-guide-maker` 在 2026-07-02 之后有一次「修复 SKILL.md 一致性问题」没有递增版本号，保持原样，本规范从 2026-08-10 起对新变更生效。

### 开发约束用 .claude/rules/ 而非 dev/<skill>/CLAUDE.md（2026-08-10）

最初打算把开发约束放 `dev/<skill>/CLAUDE.md`，理由是「子目录 CLAUDE.md 会自动加载」。查文档后发现触发条件对不上。

官方文档原文：

> Claude also discovers `CLAUDE.md` and `CLAUDE.local.md` files in subdirectories under your current working directory. Instead of loading them at launch, they are included **when Claude reads files in those subdirectories**.

即子目录 CLAUDE.md 只在读取**该子目录**下的文件时加载。而开发 nano-banana 时读写的是 `nano-banana/scripts/*.py`，不是 `dev/nano-banana/` 下的文件——那份约束永远不会在需要它的时候出现。

改用 `.claude/rules/<skill-name>.md` + `paths` frontmatter，把加载条件直接绑定到 skill 目录：

```markdown
---
paths:
  - "nano-banana/**"
---
```

三个落点由此定型，判据是「什么时候需要它」：

| 位置 | 内容 | 何时加载 |
| --- | --- | --- |
| skill 目录 | 使用者需要的 | 使用者复制走 |
| `.claude/rules/<skill>.md` | 现在该怎么做 | 读到匹配文件时自动 |
| `dev/<skill>/NOTES.md` | 当初为什么、当前状态、待办 | 需要时手动查 |

**已知限制**：`/compact` 之后 path-scoped rules 不会自动重新注入，要重新读到匹配文件才 reload。只有项目根 CLAUDE.md 会重新注入。必须每次都生效的规则写根 `CLAUDE.md`。

### 本仓库的职责边界

只负责 skill 的开发与维护，不负责 skill 如何被安装、部署、分发。因此不提供同步/安装脚本，也不对使用者的目录布局做任何假设。

## 踩坑记录

### 开发产物混进分发单元（2026-08-10 发现）

`github-tool-research/reports/claude-code-statusline-hud-20260725.html` 是一次真实调研的输出（46KB），被 git 跟踪且会跟着 skill 分发给使用者。对使用者没有价值——`assets/report-skeleton.html` 才是真正的模板。

本次改造中删除。这类污染在「开发搬进仓库」之后只会更多，`dev/<skill>/scratch/` 就是为它准备的落点。

## 版本变更

- 2026-08-10 建立开发过程维护结构。改动内容：

  | 类别 | 内容 |
  | --- | --- |
  | 新增 | `dev/` + 9 个 skill 的 `NOTES.md` + 本文件 |
  | 新增 | 根 `CLAUDE.md`（仓库规范） |
  | 新增 | `.claude/rules/nano-banana.md`、`.claude/rules/wechat-article-fetch.md`（path-scoped 开发约束） |
  | 修改 | `.gitignore` 追加 `dev/*/scratch/` |
  | 删除 | `github-tool-research/reports/claude-code-statusline-hud-20260725.html`（调研产物混进分发单元） |
  | 删除 | `nano-banana/CLAUDE.md`、`wechat-article-fetch/CLAUDE.md`（内容按性质拆到 rules 与 NOTES） |
  | 删除 | 根 `package-lock.json`（空壳孤儿文件，无对应 `package.json`，2026-03-25 误提交） |

  **待验证**：path-scoped rules 与嵌套 CLAUDE.md 的加载行为，在建立它们的那次会话中未能观察到注入。推测原因是 instruction 文件的发现发生在会话启动时，中途新建的不被当前会话拾取。需在新会话中用 `/context` 查看 **Memory files** 确认。
