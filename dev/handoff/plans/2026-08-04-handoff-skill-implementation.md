# handoff skill 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 中文说明：本计划逐任务执行，每个任务末尾有「自检清单」与「提交」两步，做完再进下一个。
> 验证任务（Task 5–7）由**全新 subagent** 执行（用户 2026-08-04 裁决），简报全文已写在任务里。

**Goal:** 把 `docs/superpowers/specs/2026-08-04-handoff-skill-design.md` 实现为可用的 `handoff` skill（纯 Markdown，无运行时代码），并按 spec §10 完成三项验证。

**Architecture:** skill 由一份 `SKILL.md`（五阶段主流程，运行时必读，力求紧凑）+ 三份 `references/`（按需加载：探测细则、prompt 骨架细则、平台档案）构成。事实一律由 skill 指挥当前 agent 跑命令实测取得；项目形态存于被交接项目自己的 `.handoff/project-profile.md`，不进 skill。

**Tech Stack:** Markdown；Claude Code skill 装载机制（`~/.claude/skills/handoff` 软链，已建，指向本仓库 `skills/handoff/`）；git 命令用于事实采集与验证隔离。**不引入任何运行时代码与依赖**——spec 全文未要求脚本，且 §9.1 要求本 skill 在上下文紧张时仍可用。

### 关于本计划的写法（与 writing-plans 默认模板的一处偏离，显式记录）

writing-plans 要求「每一步都给出工程师需要的实际内容」，对代码任务即贴代码。
本项目的交付物**本身就是散文**（Markdown 指令），把成品散文预先抄进计划，等于把实现写两遍，
且两份副本必然漂移。因此 Task 1–4 的步骤给的是：**该文件必须包含哪些要素 + 每条要素的 spec 出处 +
可当场核对的自检项**（含可执行的 `grep` 反查）。凡是判据性的原文（骨架清单、四档标注表、
翻译四层表、profile 模板、④ 冲突话术）仍逐字抄进计划，因为那几处「照抄」就是正确实现。
验证任务（Task 5–7）不适用该偏离，全部给了可逐条执行的命令与通过判据（spec §10.4 明令）。

---

## Global Constraints

以下为项目级硬约束，**每个任务的要求都隐含包含本节**。逐条标出处。

| # | 约束 | 出处 |
|---|---|---|
| G1 | spec 是唯一判据。实现与 spec 冲突以 spec 为准；spec 本身有疑问找用户裁决，不自行解释 | 交接件「判据顺序」 |
| G2 | 不重新设计。裁决台账 §一 D1–D10 全部已定案，不得重开 | 裁决台账 §一 |
| G3 | 不许把 Claude Code 当「母语平台」、别的平台当「降级」。两侧对称精准 | spec §6.1；台账 D4 / §三 |
| G4 | **Codex CLI 等其他平台的机制不得凭印象编写。** 本次只建 `claude-code.md` 与空白模板，不写任何未经校对的他平台档案 | spec §6.2；交接件易出事点 2 |
| G5 | 探测不到的东西留空并标「未探测到」，**禁止用通用最佳实践填充空缺** | spec §5.6 |
| G6 | skill 本体不含任何具体项目的文档名 / 流程名 / 工具名。可点名的只有跨项目通用入口（CLAUDE.md / AGENTS.md / README.md）与 git 自身命令 | spec §3.3 |
| G7 | 回填（③）必须早于采集（④），顺序不可调换 | spec §4.1；台账 I2（用户已明确认可） |
| G8 | 验证绝不在主工作区 `git checkout`。一律用一次性 worktree，用完即弃 | spec §10.1；台账 D9 |
| G9 | 提交用显式 `git add <path>`，禁止 `-A` | 交接件「硬约束」 |
| G10 | commit 描述用中文；新分支用 `feature/XXX` 命名 | 交接件「硬约束」；使用者的 Git 协作规范文档 |
| G11 | 临时脚本用 `/usr/bin/python3`，不用 `python`（别名在非交互 shell 不展开）。本计划预期不需要写脚本 | 交接件「硬约束」；使用者的 Python 规范文档 §1 |
| G12 | 派 subagent 时所有路径写绝对路径；简报第一步要求它切到目标目录并自检，不符即停下报告；简报中每条事实按 ①实测 / ②推断未实测 / ③转抄未核 标注 | 使用者的 Git 协作规范文档「Worktree 与 subagent 协作」；AI 协作规范文档 §1 |
| G13 | 本仓库当前无测试基建、无 CLAUDE.md、无 hook，因此不存在测试基线数字；不得伪造 | 交接件「你在哪」 |

---

## 文件结构

| 文件 | 职责 | 判据出处 | 何时被读 |
|---|---|---|---|
| `skills/handoff/SKILL.md` | 五阶段主流程、顺序铁律、模式判定、四档标注、禁止事项 | spec §3 §4 §5.2 §6.3 §7.2 §9 | **每次运行必读** |
| `skills/handoff/references/detection.md` | ② 探测阶段细则、profile 模板全文、增量校验、④ 锁定冲突话术、profile 维护三操作 | spec §5 全节 | 首次运行 / profile 维护时 |
| `skills/handoff/references/prompt-skeleton.md` | 十段骨架逐段写法、接力↔委派差异、三个非显然设计的落地规则、反例清单 | spec §7 §1.2 | 生成阶段（⑤）读 |
| `skills/handoff/references/platforms/claude-code.md` | Claude Code 平台档案（分级标注，每条带出处） | spec §6.2 §6.3 | 目标或当前平台为 Claude Code 时 |
| `skills/handoff/references/platforms/_template.md` | 新平台建档模板，全部条目默认 ② | spec §6.2 | 首次向未建档平台交接时 |
| `docs/verification/2026-08-04-verification-report.md` | 三项验证的执行记录与结论，含作用域边界声明 | spec §10.1.1 §10.4 | 验证任务产出 |

**分层理由（我的实现决策，非 spec 原文）**：spec §9.1 说本 skill 常在上下文已用 60%–满 的区间运行，因此把「每次都要读」的主流程与「按条件才读」的细则分开，避免一次性灌入。十段骨架的**清单**留在 SKILL.md（每次都要用），**逐段写法**放 references。

**跨任务锚点（后续任务会引用，命名不得改动）**：

- SKILL.md 的一级/二级标题：`## 五阶段`、`### ① 定位`、`### ② 探测`、`### ③ 回填审计`、`### ④ 采集事实`、`### ⑤ 生成`、`## 分级标注`、`## 禁止事项`
- profile 路径常量：`.handoff/project-profile.md`
- prompt 落点：`.handoff/<date>-<topic>-prompt.md`；固定入口：`.handoff/latest.md`
- 平台档案路径：`references/platforms/<platform>.md`（相对 skill 根目录）

---

## Task 0：建分支并落盘本计划

**Files:**
- Create: `docs/superpowers/plans/2026-08-04-handoff-skill-implementation.md`（本文件）

- [ ] **Step 1: 建分支**

```bash
cd <本仓库绝对路径>
git switch -c feature/handoff-skill-implementation
git branch --show-current    # 期望输出：feature/handoff-skill-implementation
```

- [ ] **Step 2: 提交计划**

```bash
git add docs/superpowers/plans/2026-08-04-handoff-skill-implementation.md
git commit -m "docs: 落盘 handoff skill 实现计划（spec §10 三项验证已展开为可执行步骤）"
```

---

## Task 1：SKILL.md 主流程

**Files:**
- Create: `skills/handoff/SKILL.md`

**下游依赖的锚点：** Task 2/3/4 的文件靠 SKILL.md 里的相对路径被引用；标题名见「跨任务锚点」。

- [ ] **Step 1: 写 frontmatter**

```yaml
---
name: handoff
description: Use when handing work off to a new session, another agent, or another platform — context is filling up, the session must be closed and reopened, or another AI/role takes over implementation. Also 交接 / 开新会话 / 上下文快满了 / 让 Codex 去实现. Writes the session's conclusions into the project's durable docs, then produces a ready-to-paste prompt.
---
```

判据：description 必须同时含「何时用」与「产出什么」，并含中文触发词——用户的触发原话是「上下文用了 60%」「这段会话上下文要满了」「开始下一版就是新会话了」（spec §1.2）。

- [ ] **Step 2: 写「首要约束」节**

必须包含（spec §9.1）：

1. 本 skill 常在上下文紧张时运行 → **产出立即落盘，不在上下文中积攒**；中途被打断时已写部分仍然有效
2. 优先级：**prompt 是最关键产出**。即使回填审计未完成，也先交付 prompt
3. 回填审计分两步（先列清单 → 用户批 → 再写），清单本身保持简短
4. 回填未完成时的三条处置，逐条照 spec §4.1.1 写：
   - 不得留下未提交的回填改动（已写的必须提交完；未写的一律不写，转为待办列入 prompt）
   - prompt 中显式声明「回填审计未完成，以下 N 条结论尚未落盘，请接手方先补」并逐条列出
   - 采集仍在其后进行，因此 HEAD 与工作区状态始终是真实终态

- [ ] **Step 3: 写「五阶段」节 —— ① 定位**

必须包含：

- 取项目根：`git rev-parse --show-toplevel`（非 git 项目则用当前工作目录，并在档案中记明「非 git 项目」）
- 判断 `.handoff/project-profile.md` 是否存在
  - 存在 → 增量校验后跳至 ③（校验细则见 `references/detection.md`「增量校验」节）
  - 不存在 → 进 ②
- 同时做**模式判定**（spec §7.2 原文三条）：
  - 目标平台 == 当前平台，且未提及分工 → 接力
  - 目标平台 != 当前平台，或用户明示「让 X 去实现」→ 委派
  - 边界模糊 → **询问用户，不猜**

- [ ] **Step 4: 写「五阶段」节 —— ② 探测**

SKILL.md 内只写：探测四类目标的名称（事实源地图 / 执行方法论 / 硬约束 / 交接件落点）、
「探测不到留空、禁止用通用最佳实践填充」（G5）、「产出 profile → 用户只校对 ② 类 → 固化」，
然后指向 `references/detection.md` 读细则。**不在 SKILL.md 里展开命令**（细则文件的职责）。

必须写明：profile 已存在且增量校验通过时，② **整段跳过**，探测成本为零（spec §4.2）。

- [ ] **Step 5: 写「五阶段」节 —— ③ 回填审计**

必须包含：

- 扫描对象是**本会话产生的结论·裁决·发现·踩坑**（来自会话上下文，不是从仓库里扫）
- 逐条判两件事：「已落盘了吗？」「该进哪份文档？」——目标文档取自 profile 的事实源地图
- **先出清单给用户批**，清单每条格式：`结论摘要 | 目标文档 | 新增还是修订`
- 用户批准后才写入；**默认不写用户的长期事实源**（spec §9.2）
- 写完立即提交，用显式 `git add <path>`（G9），commit 描述用中文（G10）
- 用户否决的条目不写，转为 prompt 里的待办

- [ ] **Step 6: 写「五阶段」节 —— ④ 采集事实**

必须给出可直接执行的命令清单，并写明「全部实测，不许凭记忆」（spec §3.2）：

```bash
git rev-parse --show-toplevel          # 项目根
git branch --show-current              # 分支（detached 时为空，需另记）
git log --oneline -3                   # HEAD 及其前两个提交
git status --short                     # 工作区是否干净
git worktree list                      # 是否在 worktree 中、有哪些
git log @{u}..HEAD --oneline           # 未推送提交；无 upstream 会报错，报错即记「无上游分支」
git stash list                         # 有无 stash（有则必须写进 prompt，否则接手方看不见）
```

测试基线：从 profile 的「硬约束」栏取测试命令跑。**不得卡死**（spec §9.2）——
- 命令最多尝试一次，超过 5 分钟即中止
- 跑不起来 / 超时 / 无测试命令 → 记「基线未取得（原因）」，并在 prompt 中写「起点基线未知，请先自行跑一遍」
- **禁止**写一个没实际跑出来的数字

顺序铁律（G7，须在本节显著位置写明）：**④ 必须在 ③ 的提交完成之后执行**。
理由一句话写清：③ 会产生提交，若先采集，prompt 里的 HEAD 是回填前的旧值，
接手方跑自愈判定会与实际 HEAD 不符——要么停下追问仓库被谁动过，要么信了错值继续执行。
「工作区干净」这一断言同理，必须在回填提交完成后才采集。

- [ ] **Step 7: 写「五阶段」节 —— ⑤ 生成**

必须包含三份产出（spec §8）与顺序：

1. **交接文档** → 落到 profile「交接件落点」指定位置；有账本则**追加**进账本，位置与顺序遵循该账本既有惯例
2. **完整 prompt** → 写入 `.handoff/<date>-<topic>-prompt.md`，**同时在终端打印全文**供用户过目
3. **固定入口** → `.handoff/latest.md`，内容与本次 prompt 一致

并写明 latest.md 的作用：用户在新会话中只需粘一行
`读 /绝对路径/.handoff/latest.md 并严格按它执行`；跨平台同样适用（任何 agent 都能读本地文件）。

十段骨架**清单**写在这里（🔒 为必填，其余按探测结果决定是否输出）：

```
🔒 1. 接手 <项目> <主题>。这是接力 / 这是委派。
🔒 2. 你在哪 ── 工作目录绝对路径 / 分支 / HEAD / 工作区状态 / 从哪启动会话的警告
   3. 别重复做 ── 已就绪的环境、已完成的事
   4. 基线数字 ── 测试结果 + 哪条失败是预期的
🔒 5. 第一入口 ── 读哪份账本、「不要凭上下文推断」、失效声明
   6. 判据顺序 ── 含冲突仲裁规则
🔒 7. 剩余工作 ── 编号有序
   8. 怎么做 ── 执行方法论（平台适配层在此段）
   9. 最容易出事的 N 点 ── 每条带代价
  10. 硬约束
```

逐段写法指向 `references/prompt-skeleton.md`。

- [ ] **Step 8: 写「分级标注」节**

照 spec §5.2 的表原样写四档，并写明用户只需校对 ② 类：

| 档 | 含义 | 用户是否需要校对 |
|---|---|---|
| ① | 实测（附命令/输出证据） | 否 |
| ② | 我推断的，未实测 | **是，重点校对** |
| ③ | 抄自项目规范原文 | 否 |
| ④ | 用户口述或手改 | 否，**且锁定** |

- [ ] **Step 9: 写「平台翻译」节**

照 spec §6.3 的四层表写，一字不改语义：

| 层 | 内容 | 是否翻译 |
|---|---|---|
| 事实层 | 路径、commit、待办、判据 | 否——任何 agent 都能读 |
| 执行层 | 用什么方法论推进 | **是** |
| 纪律层·项目 | 项目特有纪律 | 否，照搬 |
| 纪律层·平台 | 平台特有纪律 | **是**；平台不匹配则整条不输出 |

并写明（spec §6.1 §6.2，即 G3/G4）：
- 不存在「母语平台」与「降级平台」之分，两侧都应精准翻译
- 其他平台的机制**不得凭印象编写**；未建立档案的平台，翻译一律降级为能力描述并标 ②，使接手方知悉该条未经验证
- 平台档案位置：`references/platforms/<platform>.md`；建档走与 profile 同一套机制（探测 + 分级标注 + 用户校对 + ④ 锁定）

- [ ] **Step 10: 写「禁止事项」节**

逐条（每条附一句代价）：

1. 探测不到就留空，**禁止用通用最佳实践填充**（spec §5.6）——代价：一个只有 README 的项目会被写出它根本没有的方法论，接手方照做即走空
2. ④ 类条目**不得自动覆盖**，冲突时停下报告请用户裁决（spec §5.3）——代价：用户纠正过的条目会被推断值改回，同一处错误反复纠正
3. 事实**不许凭记忆**：HEAD、测试数字、工作区状态、分支一律跑命令（spec §3.2）
4. prompt **只装指针不装内容**（spec §3.1）——真正的事实留在 durable 文档里
5. 顺序不许换：③ 早于 ④（G7）
6. 不得把某个具体项目的文档名 / 流程名硬编码进本 skill（G6）

- [ ] **Step 11: 写「profile 维护」节**

照 spec §5.7 三种自然语言驱动的操作写成表（定点修正 / 重新探测 / 补充），
并写明：手改内容优先于探测结果（spec §5.1）。

- [ ] **Step 12: 自检清单**

逐条核对，全部打勾才算完成（判据 = spec 条款，不是我的印象）：

- [ ] frontmatter 的 description 含触发场景与中文触发词
- [ ] §9.1 的三条（立即落盘 / prompt 优先 / 回填两步走）都在
- [ ] §4.1.1 的三条处置逐条在
- [ ] 五阶段齐全，标题名与「跨任务锚点」一致
- [ ] ③ 早于 ④ 的**理由**写出来了（不只是写顺序）
- [ ] ④ 的命令清单可直接复制执行，且含「不得卡死」与「禁止写没跑出来的数字」
- [ ] ⑤ 的三份产出齐全，含 latest.md 的一行粘贴用法
- [ ] 十段骨架清单完整，🔒 标记与 spec §7 逐字一致
- [ ] 四档标注表在
- [ ] §6.3 四层翻译表在，且含「无档案平台标 ②」
- [ ] 禁止事项 6 条在，每条带代价
- [ ] 全文 **grep 不到任何具体项目的专有名**（除跨项目通用入口 `CLAUDE.md` / `AGENTS.md` / `README.md` 外，
      不得出现任何项目特有的状态文件名、流程名、工具名、构建命令）：
      `grep -nE "<你的项目专有名>|<你的构建命令>" skills/handoff/SKILL.md` 应无输出
- [ ] 未混入 spec §10 的验证方案内容（那是本项目怎么验证 skill，不是 skill 的运行时行为）

- [ ] **Step 13: 提交**

```bash
git add skills/handoff/SKILL.md
git commit -m "feat(handoff): 实现 SKILL.md 五阶段主流程"
```

---

## Task 2：references/detection.md（探测细则与 profile）

**Files:**
- Create: `skills/handoff/references/detection.md`

**Interfaces / 锚点：** 本文件被 SKILL.md 的 ② 与 ① 增量校验两处引用；profile 模板的小节名（`## 事实源地图` / `## 判据优先级` / `## 执行方法论` / `## 硬约束` / `## 交接件落点`）被 Task 3 的第 5、6、8 段取材时引用，不得改名。

- [ ] **Step 1: 写「探测四类目标」**

逐类给可执行做法。**注意 G6**：只有跨项目通用的入口文件可以点名。

1. **事实源地图**（spec §5.5.1）
   - 通用入口：`ls CLAUDE.md AGENTS.md README.md .cursorrules 2>/dev/null`
   - 文档结构：`git ls-files "docs/**" | head -50`（非 git 项目用 `find docs -type f`）
   - **热点即事实源候选**：`git log --since="30 days ago" --name-only --pretty=format: -- "*.md" | sort | uniq -c | sort -rn | head -15`
   - 项目状态文件：按模式发现（仓库根的 `*.yaml` / `*.yml` / `*.json` 中被近期提交频繁修改者），**不得预设文件名**
   - 每条记入表：`| 文件 | 是什么 | 何时读 | 依据 |`，「依据」列填档位与证据

2. **执行方法论**（spec §5.5.2）
   - 项目规范文件中声明的流程：在入口文件里找「流程 / workflow / 开工前 / 必读」等段落，**抄原文并标 ③**
   - **本会话实际使用过的 skill 与工具**：来自当前会话上下文，标 ①（我用过）或 ④（用户指定用的）
   - 探测不到 → 整栏写「未探测到」（G5）

3. **硬约束**（spec §5.5.3）
   - 规范文件中的「必须 / 禁止 / 不要 / 一律」条款 → 抄原文标 ③
   - hooks：`ls .claude/settings.json .claude/settings.local.json 2>/dev/null` 后读其 `hooks` 段；无则记「无 hook」
   - 测试命令：从 `package.json` 的 scripts / `Makefile` / `pyproject.toml` / CI 配置中发现候选；
     **实测跑通才标 ①**；跑不通或超时按 spec §9.2 记「基线未取得（原因）」

4. **交接件落点**（spec §5.5.4）
   - 先找已有账本体系：按时间追加的进度 / 台账 / progress 类文档（用上面的热点扫描结果判断）
   - 有 → 追加进去，并记下该账本的既有惯例（新内容放顶部还是底部）
   - 无 → 落 `.handoff/`

- [ ] **Step 2: 写 profile 模板全文**

照 spec §5.4 原样，一字不减：

```markdown
# 项目档案：<name>
> handoff skill 于 <date> 首次探测生成。可手改；手改内容优先于探测结果。
> 标注：① 实测（附证据） ② 我推断的（请重点校对） ③ 抄自项目规范 ④ 你说的（锁定）

## 事实源地图
| 文件 | 是什么 | 何时读 | 依据 |

## 判据优先级
（如 spec > plan；探测不到则留空）

## 执行方法论
（探测不到则留空，不编造）

## 硬约束
（测试命令、禁止事项、hook 限制等）

## 交接件落点
交接段落 → <路径>
prompt 文件 → .handoff/<date>-<topic>-prompt.md
```

并写明：profile 随项目仓库版本管理（spec §5.1），校对通过后用显式 `git add .handoff/project-profile.md` 提交。

- [ ] **Step 3: 写「用户校对」流程**

- 生成后**只把 ② 类条目列出来**请用户校对（spec §5.2「把校对成本收敛到只看 ② 类」）
- 用户改过的条目改标 ④ 并锁定
- 写明为什么值得（spec §5.2 原文）：一条 ② 类误判会被复制进后续每一份交接件，且越往后越无人回头核对

- [ ] **Step 4: 写「增量校验」节**

profile 已存在时执行，三件事：

1. 档案点名的每个文件是否仍存在：逐个 `test -f <path> || echo "失效: <path>"`
2. 有无新增事实源候选：`git log --since="<profile 生成日>" --name-only --pretty=format: -- "*.md" | sort -u`，
   出现档案里没有的高频文档即报告
3. **④ 类条目冲突检查**：探测结果与 ④ 类冲突时**不得自动覆盖**，按下面的话术停下报告

冲突话术照 spec §5.3 的例子写：

```
⚠️ 档案记「测试命令 = `npm test`」（④，你 2026-08-04 指定），但当前 package.json 无 test script。
是项目变了，还是档案该更新？
```

并写明后果（spec §5.3 原文）：无此锁定，用户纠正过的条目会在下次探测时被推断值改回。

- [ ] **Step 5: 写「profile 维护三操作」**

照 spec §5.7 的表：定点修正（只动该条，不重探其他，改后标 ④）/ 重新探测（全量重探，**保留所有 ④ 类**，冲突处报告）/ 补充（新增条目，标 ④）。

- [ ] **Step 6: 自检清单**

- [ ] 四类探测目标齐全，每类都有可直接执行的命令
- [ ] 命令里没有任何具体项目专有名（G6）：`grep -nE "<你的项目专有名>" skills/handoff/references/detection.md` 无输出
- [ ] 「探测不到则留空 / 不编造」在四类里各出现一次或有统一声明
- [ ] profile 模板与 spec §5.4 逐字一致（`diff` 心算：五个小节名、表头四列、两行落点）
- [ ] 增量校验三件事齐全，④ 冲突话术在
- [ ] 维护三操作在

- [ ] **Step 7: 提交**

```bash
git add skills/handoff/references/detection.md
git commit -m "feat(handoff): 补探测细则与 project-profile 模板"
```

---

## Task 3：references/prompt-skeleton.md（十段骨架逐段写法）

**Files:**
- Create: `skills/handoff/references/prompt-skeleton.md`

**Interfaces / 锚点：** 被 SKILL.md 的 ⑤ 引用。段号 1–10 与 SKILL.md 的清单一一对应，不得增删段号。

- [ ] **Step 1: 写十段逐段写法**

每段写三件事：**写什么 / 从哪取材 / 什么情况下不输出**。逐段要点如下（取材列的「④ 采集」指 SKILL.md 的采集阶段产物）：

| 段 | 写什么 | 取材 | 不输出的条件 |
|---|---|---|---|
| 1 🔒 | 一句话：接手什么项目的什么主题 + **明示「这是接力」或「这是委派」** | 会话上下文 + 模式判定 | 永不省略 |
| 2 🔒 | 工作目录**绝对路径**、分支、HEAD、工作区是否干净、未推送提交、stash；**从哪个目录启动会话的警告** | ④ 采集 | 永不省略 |
| 3 | 接力：已就绪的环境与已完成的事；委派：**边界外别碰** | 会话上下文 + profile | 无可写时省略 |
| 4 | 测试基线数字 + 哪条失败是预期的（附理由） | ④ 采集 | 项目无测试、或基线未取得时改写「起点基线未知，请先自行跑一遍」 |
| 5 🔒 | 第一入口：先读哪份账本 / 事实源，**「不要凭上下文推断」**，以及失效声明 | profile 事实源地图 | 永不省略；无账本时指向本次生成的交接文档 |
| 6 | 判据优先级 + 冲突仲裁规则（如 spec > plan，冲突以 spec 为准） | profile 判据优先级 | profile 该栏为空则省略 |
| 7 🔒 | 剩余工作，**编号有序**；委派模式写「任务 + 交付标准」 | 会话上下文 + 未完成的回填条目 | 永不省略 |
| 8 | 怎么做：执行方法论。**平台适配层在此段** | profile 执行方法论 + 平台档案 | profile 该栏为空则省略（G5：不得用通用最佳实践顶上） |
| 9 | 最容易出事的 N 点，**每条带代价** | 会话中真实踩过的坑 | 本会话没踩过坑就少写或不写，**不得凑数** |
| 10 | 硬约束 | profile 硬约束（③ 类抄原文） | 该栏为空则省略 |

- [ ] **Step 2: 写「三个非显然设计」的落地规则**

这三条来自用户既有实践（spec §1.2），是本骨架区别于普通「总结」的地方：

1. **只装指针，不装内容**
   - prompt 里写「读 X 的 §Y」，不把 X 的内容抄进 prompt
   - 判断标准：如果接手方不读那份文档也能干活，说明内容被抄进来了，应删

2. **自愈判定**
   - prompt 内嵌可执行命令让接手方自验前提，例如：

     ```
     分支 <branch>，HEAD = <sha>，工作区干净。
     自验：`git log --oneline -3` 首行应为 <sha>；不符说明仓库已被改动，先停下核对再动手。
     ```
   - 至少给 HEAD 一条自愈判定（spec §1.2 原文举的就是这条）

3. **显式失效声明**
   - 追加进按时间增长的账本时，必须写明「以顶部（或本段）为准，下方全部过时」
   - 理由：账本按时间追加会长出过时段落

- [ ] **Step 3: 写「接力 ↔ 委派」差异**

照 spec §7.1，差异仅三处，其余段落共用：

| 段 | 接力 | 委派 |
|---|---|---|
| 3 | 「别重复做」——已完成的事 | 「边界外别碰」——不属于本次任务的范围 |
| 7 | 「剩余工作」——按序编号 | 「任务 + 交付标准」——验收判据 |
| 附加 | 无 | **「结果怎么交回来」**——否则委派是单向断链 |

并写明委派模式为何不塞完整历史（spec §2）：硬塞完整历史是噪音，且会诱导接手方改动不该改的地方。
「结果怎么交回来」要具体到**落盘路径与格式**（spec §12.4）。

- [ ] **Step 4: 写反例清单**

每条一句话，说清「错在哪 + 代价」：

1. 把事实源的内容整段抄进 prompt —— 违反「只装指针」，且抄本会随原文更新而过时
2. 凭记忆写 HEAD / 测试数字 / 工作区状态 —— 这几样恰恰是记忆最易错、错了代价最高的（spec §3.2）
3. 项目没有方法论时用通用最佳实践填第 8 段 —— 违反 G5，接手方照做即走空
4. 第 9 段凑数：把没真正踩过的坑写成教训 —— 稀释真正的坑，且无法证伪
5. 写了「工作区干净」却是在回填提交前采集的 —— 违反 G7
6. 委派 prompt 里塞完整历史 —— 诱导接手方改动边界外的东西

- [ ] **Step 5: 自检清单**

- [ ] 十段齐全、段号与 SKILL.md 一致、🔒 四段（第 1、2、5、7 段）标注正确
- [ ] 每段都写了「不输出的条件」
- [ ] 三个非显然设计各有可套用的写法（自愈判定给了可执行命令片段）
- [ ] 接力↔委派三处差异表在，且「结果怎么交回来」含落盘路径与格式
- [ ] 反例清单 ≥6 条，每条带代价
- [ ] 无具体项目专有名（G6）

- [ ] **Step 6: 提交**

```bash
git add skills/handoff/references/prompt-skeleton.md
git commit -m "feat(handoff): 补十段骨架逐段写法与反例清单"
```

---

## Task 4：平台档案（claude-code.md + 空白模板）

**Files:**
- Create: `skills/handoff/references/platforms/claude-code.md`
- Create: `skills/handoff/references/platforms/_template.md`

🔴 **本任务最容易违规的地方（G3/G4）**：不写任何其他平台的档案；claude-code.md 里的每一条都必须带档位与出处，**凡是我只在语料里见过、本会话没实测的，一律标 ③（转抄未核）并写「请自己核」**，不得因为「这是 Claude Code，我应该懂」就标 ①。

- [ ] **Step 1: 写 claude-code.md 的条目表**

表头固定为：`| 条目 | 内容 | 档位 | 出处 / 证据 |`。至少覆盖三类（spec §6.3 的执行层与纪律层·平台）：

1. **执行层：方法论词汇**
   - skill 的调用方式（斜杠命令 / Skill 工具）——标 ①，证据：本会话可用工具列表
   - 可用的流程类 skill 名（如 superpowers 系列：brainstorming / writing-plans / subagent-driven-development / executing-plans / verification-before-completion）——标 ①，证据：本会话 skill 清单；**写明「该清单随用户安装情况变化，接手方应以自己会话里能看到的为准」**
   - 子任务派发方式（Agent 工具 / 后台任务）——标 ①

2. **纪律层·平台**
   - subagent 的工作目录**不随 worktree 切换**，仍是会话启动目录；简报里路径必须写绝对路径——标 ③，出处：使用者的 Git 协作规范文档「Worktree 与 subagent 协作」原文
   - subagent 的最终文本输出不一定回传，需显式回传机制——标 ③，出处：历史语料中的用户原话；**未实测，请自己核**
   - 会话启动目录在会话期内固定，删掉该目录会使其悬空——标 ③，出处同上；未实测

3. **不适用声明**
   - 明确写一行：本档案只描述 Claude Code。向其他平台交接时**不得套用本档案**，须按 `_template.md` 新建档案并经用户校对（G4）

- [ ] **Step 2: 写 _template.md**

内容为空白骨架 + 使用说明：

```markdown
# 平台档案：<platform>
> 由 handoff skill 于 <date> 首次向该平台交接时建立。
> ⚠️ 全部条目默认标 ②（我推断的，未实测）。经用户校对的条目改标 ④ 并锁定。
> 🔴 不得凭印象填写。不确定的条目留空并写「未探测到」，不要用别的平台的机制类推。

| 条目 | 内容 | 档位 | 出处 / 证据 |
|---|---|---|---|
| skill / 能力调用方式 |  | ② |  |
| 可用的流程类能力 |  | ② |  |
| 子任务派发方式 |  | ② |  |
| 平台特有纪律 |  | ② |  |
| 已知不支持的东西 |  | ② |  |
```

- [ ] **Step 3: 自检清单**

- [ ] claude-code.md 每一条都有档位与出处，**没有任何一条是无出处的 ①**
- [ ] 语料来源的条目全部标 ③ 且写了「未实测，请自己核」
- [ ] 有「不得套用到其他平台」的声明
- [ ] `ls skills/handoff/references/platforms/` 只有 `claude-code.md` 与 `_template.md`——**没有 codex 或任何其他平台的文件**（G4）
- [ ] _template.md 全部条目标 ②，且含「不得凭印象填写」

- [ ] **Step 4: 提交**

```bash
git add skills/handoff/references/platforms/claude-code.md skills/handoff/references/platforms/_template.md
git commit -m "feat(handoff): 建立 Claude Code 平台档案与新平台建档模板"
```

---

## 验证任务总则（Task 5–7 共用）

**执行者：全新 subagent**（用户 2026-08-04 裁决）。理由：我已完整读过 11 份历史交接 prompt，
自己跑回归验证会无意识照着黄金答案写，判别力被污染。

🔴 **判别力保障（三条，写进每份简报）**：

1. subagent **禁止读** `<本仓库绝对路径>/docs/**` 下任何文件
   （spec、语料、台账、本计划全在里面）。它只准读 `~/.claude/skills/handoff/**` 与被验证项目内的文件。
2. subagent **不知道**黄金 prompt 长什么样，也不知道自己在被拿来对照什么。简报只说「按 skill 执行交接」。
3. 黄金要素清单由**我**在 subagent 出结果**之前**写好并落盘，避免事后凑。

🔴 **subagent 协作纪律**（使用者的 Git 协作规范文档，G12）：

- 简报里所有路径写**绝对路径**
- 简报第一句要求它：先 `cd <目标绝对路径>`，再 `pwd` 与 `git log --oneline -1` 自检，不符**立即停下报告**，不要动手
- 简报中每条事实标注 ①实测 / ②推断未实测 / ③转抄未核；后两档附「请自己核，不符以实测为准并报回」
- 明确要求它做完**主动把结论写到指定绝对路径的报告文件**，并在最终消息里回传摘要
- 等待期间不盲等：按 AI 协作规范文档 §1.5，用「报告文件是否出现 + 目标目录 mtime 是否变化」两个信号交叉判活，连续两轮零变化即去查而不是继续等

---

## Task 5：降级验证（spec §10.2）

**判据（spec §10.2 原文）**：在一个仅含 README 的项目中运行，确认：档案自动瘦身、方法论栏留空、不报错、不编造结构。

**Files:**
- Create: `docs/verification/2026-08-04-degraded-check.md`（我写判据，subagent 不读）

- [ ] **Step 1: 我先建一次性的降级项目**

```bash
DEG=<临时目录>/degraded-demo
rm -rf "$DEG" && mkdir -p "$DEG" && cd "$DEG"
git init -q && printf '# demo\n\n一个只有 README 的项目。\n' > README.md
git add README.md && git commit -q -m "chore: 初始化仅含 README 的项目"
ls -a "$DEG"          # 期望：只有 . .. .git README.md
```

- [ ] **Step 2: 我先写好判据（在派 subagent 之前）**

写入 `docs/verification/2026-08-04-degraded-check.md`，五条通过判据：

1. `.handoff/project-profile.md` 生成成功
2. 「执行方法论」栏内容为空或写「未探测到」——**不得出现任何方法论描述**
3. 「硬约束」栏的测试命令写「未探测到」或「基线未取得」——**不得出现 npm test / pytest 等未实测的命令**
4. 生成的 prompt 中第 4 段（基线数字）与第 8 段（怎么做）**不输出**，或写明「未探测到 / 基线未知」
5. 反向检查（编造检测）：
   ```bash
   grep -nE "npm|pytest|CI|lint|最佳实践|建议使用|一般来说" "$DEG/.handoff/project-profile.md" "$DEG/.handoff/latest.md"
   ```
   **期望无输出**；任何一条命中即为「用通用最佳实践填充空缺」，判定失败（G5 / spec §5.6）

- [ ] **Step 3: 派 subagent 执行**

简报全文（派发时把 `$DEG` 替换成上面的绝对路径）：

```
第一步：cd <DEG 绝对路径>，然后 pwd && git log --oneline -1 自检。
期望 pwd 为该路径、只有一个提交「chore: 初始化仅含 README 的项目」。不符立即停下报告，不要动手。

任务：在这个项目里执行 handoff skill，为「下一段工作」产出一份交接件。
读 ~/.claude/skills/handoff/SKILL.md 并严格按它执行五个阶段。

会话上下文（你需要的「本会话产生的结论」就这些，没有别的）：
- 结论 1（①，我实测）：这个项目当前只有一个 README.md，没有任何代码。
- 待办 1（④，用户指定）：下一段工作是给它加第一个功能模块，模块名未定。

约束：
- 🔴 禁止读 <本仓库绝对路径>/ 下的任何文件。
- 🔴 探测不到的东西留空，禁止用通用最佳实践填充。
- 需要用户批准的环节（回填清单、profile 校对），你自己代为批准并在报告里说明你批了什么。
- 允许在该项目内提交（它是一次性的）。

做完把执行记录写到 <scratchpad>/degraded-agent-report.md（绝对路径），包含：
你跑了哪些命令、每个阶段的产出摘要、哪些栏位你留空了及原因。
然后在最终消息里回传三行摘要。
```

- [ ] **Step 4: 我逐条判定**

按 Step 2 的五条判据逐条打勾，结果写进 `docs/verification/2026-08-04-degraded-check.md`。
任何一条失败 → 回到 Task 1–3 修 skill，然后**重跑本任务**（改 skill 后旧结果作废）。

- [ ] **Step 5: 提交**

```bash
git add docs/verification/2026-08-04-degraded-check.md
git commit -m "test: 降级验证（仅含 README 的项目）执行记录与判定"
```

---

## Task 6：锁定验证（spec §10.3）

**判据（spec §10.3 原文）**：手动将 profile 中一条改为 ④ 并赋予与探测结果冲突的值，再次运行，确认 skill 报告冲突而非静默覆盖。

**Files:**
- Modify: `docs/verification/2026-08-04-degraded-check.md`（追加锁定验证一节）

- [ ] **Step 1: 我制造冲突**

在 Task 5 留下的降级项目里改 profile 的一条（该项目无 package.json，因此 `npm test` 必然与探测结果冲突）：

```bash
DEG=<同上绝对路径>
# 把「硬约束」栏的测试命令行改成 ④ 类且与现实冲突
# 改后确认：
grep -n "npm test" "$DEG/.handoff/project-profile.md"     # 期望有输出，且该行标 ④
md5 -q "$DEG/.handoff/project-profile.md" > "$DEG/../profile.md5.before"
git -C "$DEG" add .handoff/project-profile.md && git -C "$DEG" commit -q -m "chore: 手工把测试命令改为 ④ 类锁定条目"
```

- [ ] **Step 2: 派 subagent 再跑一次**

简报（关键差异：这次它会走到「① 定位 → 增量校验」路径）：

```
第一步：cd <DEG 绝对路径>，pwd && git log --oneline -2 自检，最新提交应为
「chore: 手工把测试命令改为 ④ 类锁定条目」。不符立即停下报告。

任务：在这个项目里再次执行 handoff skill（读 ~/.claude/skills/handoff/SKILL.md），
为「下一段工作」产出交接件。会话上下文与上次相同：项目只有 README，下一步是加第一个功能模块。

🔴 禁止读 <本仓库绝对路径>/ 下任何文件。

做完把执行记录写到 <scratchpad>/lock-agent-report.md，特别写明：
增量校验阶段你发现了什么、你是怎么处理的、你有没有修改 .handoff/project-profile.md。
最终消息回传三行摘要。
```

- [ ] **Step 3: 我逐条判定**

三条通过判据：

1. subagent 的报告中**出现冲突报告**（形如 spec §5.3 的话术：档案记 X（④，用户指定），但当前探测为 Y，请裁决）
2. profile 文件**未被自动改写**：
   ```bash
   md5 -q "$DEG/.handoff/project-profile.md"      # 与 profile.md5.before 一致
   git -C "$DEG" diff --stat HEAD -- .handoff/project-profile.md   # 期望无输出
   ```
3. 它**没有**把 `npm test` 当真去跑并伪造基线数字（报告里检查）

任何一条失败 → 修 Task 1/Task 2 中「④ 锁定」相关内容，重跑。

- [ ] **Step 4: 提交**

```bash
git add docs/verification/2026-08-04-degraded-check.md
git commit -m "test: 锁定验证（④ 类条目冲突不得静默覆盖）执行记录与判定"
```

---

## Task 7：回归验证（spec §10.1，主判据）

🔴🔴 **开工门禁（用户 2026-08-04 会话中明确要求）**：本任务会在用户正在使用的
`<历史项目>` 仓库上建 worktree。**动它之前必须停下来，把将要执行的命令逐条给用户确认，
得到明确许可后才开始。** 未获确认时，Task 5、6、8 可照常进行，Task 7 挂起。

**判据（spec §10.1 原文）**：挑选 2–3 个历史交接点，在**一次性 worktree** 中把仓库检出到当时的 commit，运行 skill，比对生成的 prompt 是否覆盖原版的全部关键要素（并检查是否掺入了原版没有的冗余内容）。

**已实测的事实（①，本会话 2026-08-04 跑过）**：

- 历史仓库存在：`<历史项目仓库绝对路径>`
- 语料点名的 commit 全部仍在：`<R3-commit>` / `<commit>` / `<commit>` / `<commit>` / `<R1-commit>` / `<commit>` / `<commit>` / `<commit>` / `<commit>`
- 该仓库当前有两个 worktree：主工作区（master `<R1-commit>`）与一个正在被使用的 feature worktree（`<commit>`，**有人正在用，不许碰**）

**选三个形态互不相同的交接点**（形态不同才验得出「段落取舍是否正确」）：

| 验证点 | commit | 形态 | 对应语料实例 |
|---|---|---|---|
| R1 | `<R1-commit>` | 主工作区、状态 idle、下一步是删 worktree + 开新版本；**入口文档全在 git 里** | 实例 7（2026-08-03） |
| R2 | `<R2-commit>`（**待核实存在**，不存在则退用基点 `<commit>`） | worktree 开工形态；**入口文档也全在 git 里**，与 R3 对照 | 实例 4（2026-07-31） |
| R3 | `<R3-commit>` | worktree 接力中段；**原版第一入口是 gitignored 的 SDD 台账，worktree 里不存在** | 实例 10（2026-08-03） |

选点理由（**我的判断**，可推翻）：三个点的形态互不相同——主工作区 / worktree 开工 / worktree 接力，
且 R1+R2 的入口文档在 git 里、R3 的入口在 git 外。形态相同的点验不出「段落取舍是否正确」，
而 R3 专门验一件别的点验不到的事：**账本不存在时 skill 会不会编造一个入口**。

**Files:**
- Create: `docs/verification/2026-08-04-regression-R1.md` / `-R2.md` / `-R3.md`

- [ ] **Step 1: 隔离环境（用户 2026-08-04 裁决：改用本地 clone，不用 worktree）**

🔴 **这是对 spec §10.1 字面的一处偏离，出处 = 用户当场裁决，理由记录在此**：
spec §10.1 写的是「在一次性 worktree 中检出」，其目的（与台账 D9 一致）是**主工作区零风险**。
`git worktree add` 会往用户仓库的 `.git/worktrees/` 写入元数据；而 `git clone --local --no-hardlinks`
对源仓库**纯读、零写入**，更彻底地达成同一目的。源仓库 `.git` 仅 11 MB，clone 成本可忽略。
⇒ 手段变了，spec 的目的不但没被削弱，而且被更严格地满足。

```bash
SIA="<历史项目仓库绝对路径>"
SD="<临时目录>"
# 动手之前先落盘存档「改之前的完整状态」（使用者的 AI 协作规范文档 §6）
mkdir -p "$SD/sia-before"
git -C "$SIA" worktree list  > "$SD/sia-before/worktree-list.txt"
git -C "$SIA" branch -vv     > "$SD/sia-before/branch.txt"
git -C "$SIA" status --short > "$SD/sia-before/status.txt"
git -C "$SIA" rev-parse HEAD > "$SD/sia-before/head.txt"

git clone --local --no-hardlinks --quiet "$SIA" "$SD/sia-mirror"

# 立即复核源仓库零改动
diff <(git -C "$SIA" worktree list) "$SD/sia-before/worktree-list.txt" && \
diff <(git -C "$SIA" branch -vv)     "$SD/sia-before/branch.txt" && \
diff <(git -C "$SIA" status --short) "$SD/sia-before/status.txt" && echo "源仓库零改动 ✅"
```

三个检出点在**镜像内**建（镜像是我自己的一次性副本，随便动）：

```bash
git -C "$SD/sia-mirror" worktree add --detach "$SD/wt-R<n>" <commit>
```

🔴 `--detach` 不可省（`<R3-commit>` 所在分支在镜像里是当前分支）。
🔴 全程不得对 `$SIA` 执行任何写操作（G8）。

**已实测（① 本会话 2026-08-04）**：clone 完成，18 MB；三个验证点在镜像里全部可达；
`<R2-commit>` 的提交标题与语料实例 4 描述的「治理状态已切为开工态（附 commit）」吻合
⇒ R2 用它，不必退用基点。

- [ ] **Step 2: 我先机械提取黄金要素清单（必须早于跑 skill）**

对 R1/R2/R3 各写一份 `docs/verification/2026-08-04-regression-R<n>.md`，
内容是从对应语料实例**逐段拆出的要素表**，每行一条，三列：

| # | 要素（原版写了什么） | 归类 |
|---|---|---|

「归类」填三种之一。前两种按 spec §10.1.1 划；第三种是**实际抽取要素时发现必须分出来的**
（否则会把 skill 的正确降级行为误判成缺陷，见下）：

- **A 仓库可得**——从当时的仓库状态就能得到（工作目录 / 分支 / HEAD / 工作区状态 /
  事实源文件名与读取顺序 / 硬约束原文 / 测试命令）
- **B 会话依赖**——只有当时的会话上下文才有（结论提炼、坑抓得准不准、待办排序、用户裁决原话）。
  按 spec §10.1.1，未覆盖**不计为失败**
- **C 环境不可得**——原版有、且理论上属仓库范畴，但在一次性 worktree 里拿不到：
  gitignored 的本地缓存、虚拟环境、外部系统状态（如生产配置版本号）。
  **此类的正确行为是如实标注「未取得（原因）」而非编造**——若 skill 反而写出了具体数字，
  是严重缺陷（编造），比未覆盖更糟

🔴 这一步必须在 subagent 出结果**之前**完成并提交，否则事后凑判据，验证失去判别力。

- [ ] **Step 3: 逐个验证点执行（R1 → R2 → R3，串行）**

对每个验证点：

```bash
git -C "$SD/sia-mirror" worktree add --detach "$SD/wt-R<n>" <commit>
git -C "$SD/wt-R<n>" log --oneline -1        # 确认检出点正确
```

派 subagent，简报全文（`<n>`、`<commit>`、路径按实替换）：

```
第一步：cd <SD>/wt-R<n>，然后 pwd && git log --oneline -1 自检，
期望 HEAD 为 <commit>。不符立即停下报告，不要动手。

任务：在这个项目里执行 handoff skill，为「下一段工作」产出一份交接件。
读 ~/.claude/skills/handoff/SKILL.md 并严格按它执行五个阶段。

关于会话上下文：你是刚接手这个仓库的，没有前序会话的结论可回填。
③ 回填审计阶段如实记「本会话无新增结论可回填」，不要编。
下一段工作是什么，请你自己从仓库里读出来（这正是被验证的能力）。

🔴 硬约束（违反即本次验证作废）：
- 禁止读 <本仓库绝对路径>/ 下任何文件
- 禁止在这个仓库里执行任何 git 提交、git checkout、git worktree 操作
- 禁止安装依赖（不要跑 uv sync / pip install / npm install）
- 测试命令最多尝试一次且限时 5 分钟，跑不起来就按 skill 说的记「基线未取得（原因）」，
  🔴 绝对不许写一个你没有实际跑出来的数字
- 产出的 .handoff/ 文件写在本 worktree 内即可，不要提交

做完把执行记录写到 <SD>/regression-R<n>-report.md（绝对路径），包含：
你跑了哪些命令及其输出、profile 的完整内容、生成的 prompt 全文、你留空了哪些栏位及原因。
最终消息回传三行摘要。
```

- [ ] **Step 4: 逐条比对判定**

对每个验证点，在 `docs/verification/2026-08-04-regression-R<n>.md` 里补三张表：

**正向覆盖**（黄金要素 → 是否覆盖）：逐条判 覆盖 / 未覆盖，未覆盖的必须注明归类。

**反向冗余**（生成的 prompt 里有、原版没有的内容）：逐条判
- **有害**（编造的结构、通用最佳实践填充、未验证却断言的事实）
- **中性**（多写了但无害）
- **更好**（原版漏了而这次抓到了，例如自愈判定命令）

**通过判据（三条全中才算通过）**：

1. 归类为「仓库可得」的要素**全部被覆盖**
2. 未覆盖的要素**全部落在「会话依赖」类**——若有一条「仓库可得」类未覆盖，判定失败并回去修 skill
3. 反向冗余中**没有「有害」项**——特别检查：prompt 里出现的任何测试数字，必须能在 subagent 的执行记录里找到对应的实际命令输出；找不到即为编造，直接判失败

- [ ] **Step 5: 清理该验证点（用完即弃）**

```bash
git -C "$SD/sia-mirror" worktree remove --force "$SD/wt-R<n>"
```

清理的是**镜像**里的 worktree，源仓库全程未被触碰。

- [ ] **Step 6: 三个验证点都跑完后，逐字节复核源仓库未被改动**

```bash
diff <(git -C "$SIA" worktree list) "$SD/sia-before/worktree-list.txt"
diff <(git -C "$SIA" branch -vv)     "$SD/sia-before/branch.txt"
diff <(git -C "$SIA" status --short) "$SD/sia-before/status.txt"
diff <(git -C "$SIA" rev-parse HEAD) "$SD/sia-before/head.txt"
rm -rf "$SD/sia-mirror"        # 镜像用完即弃
```

四个 `diff` 全部无输出才算通过。

- [ ] **Step 7: 提交**

```bash
git add docs/verification/2026-08-04-regression-R1.md docs/verification/2026-08-04-regression-R2.md docs/verification/2026-08-04-regression-R3.md
git commit -m "test: 回归验证（三个历史交接点，一次性 worktree）执行记录与判定"
```

---

## Task 8：验证结论落盘与收口

**Files:**
- Create: `docs/verification/2026-08-04-verification-report.md`
- Modify: `README.md`（目录表补 `skills/` 与 `docs/verification/`）

- [ ] **Step 1: 写总报告**

必须包含四节：

1. **三项验证的结论**（通过 / 未通过 / 修了什么后通过）
2. 🔴 **作用域边界声明**（spec §10.1.1，一字不得含糊）：
   > 本验证证明的是：**在给定仓库状态下，skill 从仓库能提取到的那部分与历史人工产出一致。**
   > 它**不能**证明 skill 整体正确。以下四项依赖会话上下文，历史 worktree 里不存在，只能在真实使用中由用户当场判断：
   > 会话结论提炼得准不准 / 回填审计的判断是否合理 / 「最容易出事的 N 点」是否抓住了真正的坑 / 待办清单的排序是否合理。
3. **本次验证自身的判别力边界**（我的补充，非 spec 要求）：验证由未读过语料的 subagent 执行，
   黄金要素清单在其出结果前落盘；但简报由我撰写，措辞仍可能带入倾向，此为残留风险。
4. **后续安排**：右列四项需在真实交接场景中逐次由用户反馈修正（spec §10.1.1 末段）

- [ ] **Step 2: 更新 README 目录表**

在现有表格中补两行：

```
| `skills/handoff/` | skill 本体源码 |          ← 已有，确认路径正确
| `docs/superpowers/plans/` | 实现计划 |
| `docs/verification/` | spec §10 三项验证的执行记录与判定 |
```

并把「判据顺序」第 3 条从「实现计划（待写）」改为实际路径。

- [ ] **Step 3: 提交**

```bash
git add docs/verification/2026-08-04-verification-report.md README.md
git commit -m "docs: 落盘验证总报告与作用域边界声明，更新 README 目录"
```

- [ ] **Step 4: 用 handoff skill 自己产出下一份交接件（dogfood）**

**出处：我的补充，不在 spec 里。** 理由：spec §10.1.1 明说右列四项「只能在真实使用中由用户当场判断」，
本会话结束正是一次真实交接场景，成本近乎为零，且能拿到 spec 验不了的那半边反馈。

执行：由我（而非 subagent）在本仓库跑一次完整的五阶段，产出 `.handoff/latest.md`。
**注意**：这次会覆盖现有的 `.handoff/latest.md`（那是手工产出的首份交接件）。
覆盖前先 `cp .handoff/latest.md .handoff/2026-08-04-manual-first-handoff.md` 留档，
因为它是「人工按十段骨架产出」的对照样本，有比对价值。

- [ ] **Step 5: 请用户裁决合并方式**

分支 `feature/handoff-skill-implementation` 是否合并回 `main`、何时合并，由用户定。
**不擅自合并、不擅自推送**（本仓库当前无远端时更不得擅自加远端）。

---

## 判据双向检查

使用者的 AI 协作规范文档 §4 明令：正向查「需求的每条判据都实现了吗」，反向查「实现里有没有需求从没说过的设计决策」。

### 正向：spec 每节 → 落在哪个任务

| spec 节 | 落点 |
|---|---|
| §3.1 只装指针不装内容 | Task 3 Step 2 第 1 条；Task 1 Step 10 第 4 条 |
| §3.2 事实一律实测 | Task 1 Step 6；Task 1 Step 10 第 3 条 |
| §3.3 不硬塞结构 | G6；Task 1 Step 12 的 grep 自检；Task 2 Step 6 的 grep 自检 |
| §3.4 分级标注 + 校对 + 锁定 | Task 1 Step 8；Task 2 Step 3、Step 4 |
| §4 五阶段 | Task 1 Step 3–7 |
| §4.1 顺序约束 | Task 1 Step 6（含理由）；Task 1 Step 12 自检 |
| §4.1.1 回填未完成的处置 | Task 1 Step 2 第 4 条 |
| §4.2 跳过条件 | Task 1 Step 4 |
| §5.1–5.4 profile | Task 2 Step 2、Step 3 |
| §5.5 探测四类 | Task 2 Step 1 |
| §5.6 探测不到留空 | G5；Task 2 Step 1；Task 5（降级验证专验此条） |
| §5.7 维护三操作 | Task 1 Step 11；Task 2 Step 5 |
| §6.1 对称原则 | G3；Task 1 Step 9 |
| §6.2 诚实约束 | G4；Task 4 全任务 |
| §6.3 翻译边界四层 | Task 1 Step 9 |
| §7 十段骨架 | Task 1 Step 7（清单）；Task 3 Step 1（逐段） |
| §7.1 两模式差异 | Task 3 Step 3 |
| §7.2 模式判定 | Task 1 Step 3 |
| §8 三份产出 | Task 1 Step 7 |
| §9.1 上下文紧张 | Task 1 Step 2 |
| §9.2 其余失败模式 | Task 1 Step 6（测试兜底）、Step 10（②/④）、Task 2 Step 4（脱节报告）、Task 3 Step 2（自愈判定） |
| §10.1 回归验证 | Task 7 |
| §10.1.1 作用域边界 | Task 7 Step 2 的「归类」列；Task 8 Step 1 第 2 节 |
| §10.2 降级验证 | Task 5 |
| §10.3 锁定验证 | Task 6 |
| §10.4 交付要求（可逐条执行） | Task 5/6/7 每步都写了「跑什么命令、看什么输出、什么算通过」 |
| §11 安装与版本管理 | 软链已建（本会话 2026-08-04 实测，`ls -la ~/.claude/skills/handoff` 指向本仓库） |
| §12 明确不做 | 本计划未实现任何一条：无接收端 skill、无上下文用量检测、无跨项目继承、无委派自动回流、无脱敏 |

### 反向：本计划中「非 spec 原文」的决策，逐条标出处

| # | 决策 | 出处 | 可否推翻 |
|---|---|---|---|
| P1 | SKILL.md / references 四文件分层 | **我的推断**。理由：spec §9.1 说本 skill 常在上下文紧张时运行，每次必读的内容应尽量小 | 可推翻。合并成单文件也满足 spec，代价是运行时上下文占用变大 |
| P2 | 十段骨架的**清单**留 SKILL.md、**逐段写法**放 references | **我的推断**，同 P1 理由 | 可推翻 |
| P3 | 验证由全新 subagent 执行 | **用户 2026-08-04 裁决**（本会话 AskUserQuestion） | 已定案 |
| P4 | 不写结构自检脚本 | **用户 2026-08-04 裁决**（本会话 AskUserQuestion）+ 使用者的 Python 规范文档 §8 | 已定案 |
| P5 | 回归验证选 R1/R2/R3 这三个点 | **我的选择**。判据：spec §10.1 说「2–3 个」；我按「形态互不相同」挑，因为形态相同验不出段落取舍 | 可推翻，可换别的历史点 |
| P6 | 在 feature 分支上实施 | **我的推断** + 使用者的 Git 协作规范文档分支命名要求 | 可推翻（直接在 main 上做也行，前两个提交就在 main 上） |
| P7 | Task 8 Step 4 的 dogfood | **我的补充**，不在 spec 里。理由见该步 | 可推翻，删掉不影响 spec 覆盖 |
| P8 | `_template.md` 空白平台模板 | **我的实现决策**，服务于 spec §6.2「首次向该平台交接时建立」 | 可推翻，改为在 SKILL.md 里内联描述亦可 |
| P9 | 采集命令清单里加 `git stash list` | **我的补充**。理由：stash 里的改动接手方看不见，漏报会让他在错误的起点上工作 | 可推翻 |

### 反向：spec 承诺了、但本计划**刻意不做**的

- spec §12 五条 YAGNI：全部不做，**不得在实现期偷偷加回来**（spec §12 开篇「记录以防实现期膨胀」）
- 其他平台档案（Codex CLI 等）：G4 明令不写，等真正需要时按 `_template.md` 探测建档
