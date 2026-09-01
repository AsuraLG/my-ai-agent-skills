---
name: handoff
description: Use when handing work off to a new session, another agent, or another platform — context is filling up, the session must be closed and reopened later, or another AI/role will take over implementation. Also triggers on 交接 / 开新会话 / 上下文快满了 / 这段会话要结束了 / 让 Codex 去实现. Writes conclusions into the project's durable docs and produces a one-time handoff prompt in .handoff/inbox for the next agent to consume.
metadata:
  version: v3
  last_updated: "2026-09-01"
---

# Handoff

一次交接要交两件产物，缺一不可：

1. **该落盘的落盘** —— 本会话产生的结论进项目既有的 durable 文档
2. **一份能直接粘贴的 prompt** —— 只装指针，不装内容

## 交接件生命周期（一次性）

handoff prompt 是一次性接力载体，不是项目长期上下文。只有 prompt 文件参与以下生命周期；
`project-profile`、事实账本和其他 durable 文档继续按本 skill 的原有规则保留、提交和维护。
`project-profile` 的事实源地图不得记录具体的 `.handoff` prompt、账本、`latest.md` 或其他一次性交接文件；
`.handoff/inbox/` 和 `.handoff/archive/` 只是交接操作目录，不是长期事实源。

| 状态 | 位置 | 规则 |
|---|---|---|
| 待消费 | `.handoff/inbox/<date>-<topic>-prompt.md` | 新生成的 handoff prompt 必须落在这里；文件名必须唯一，prompt 中写明该文件的绝对路径。 |
| 消费中 | 仍在 `inbox` | 接收方只读取用户明确指向的这一份文件，不扫描 `.handoff`，也不读取 `archive`。 |
| 已消费 | `.handoff/archive/<same-file-name>` | 接收方已经读完指定文件、完成路径/模式/边界自检并确认可以继续执行后，才把这个单文件移动到 `archive`。 |
| 中断或阻塞 | 仍在 `inbox` | 文件读取失败、路径不可达、信息不足、需要用户裁决或接力尚未完成时，不得归档。 |

归档使用可恢复的单文件移动，不使用目录级通配符，也不把 durable 文档一并移动。移动后必须复核：
源文件不存在、目标文件存在；复核失败时如实报告并保留原文件。普通非接力任务不应扫描
`inbox` 或 `archive`。

为兼容原有“一行指针”入口，新 handoff 可以在待消费期间保留一个临时的 `.handoff/latest.md` 镜像；
它必须与 `inbox` 中的权威 prompt 逐字节一致，且不能被当作第二份独立交接件。新生成的 prompt 始终
指向唯一的 `inbox` 绝对路径；接收方完成自检后先清理临时 `latest.md`，再归档 `inbox` 中的权威文件。
如果用户明确指向旧的 `.handoff/latest.md` 或旧路径下的 prompt 文件，仍按该指定路径完成一次消费；
消费成功后清理旧入口并将对应单文件移动到 `.handoff/archive/`。不能因为看到目录中有旧文件就主动扫描
或继承它。

## 首要约束：本 skill 常在上下文紧张时运行

- **产出立即落盘**，不在上下文里积攒。中途被打断时，已写的部分仍然有效。
- **prompt 是最关键产出。** 即使回填审计没做完，也要先把 prompt 交出去。
- **回填审计分两步走**：先列清单 → 用户批 → 再写。清单本身保持简短。

回填没做完就要交 prompt 时，按这三条处置（**不是简单跳过顺序约束**）：

1. **不得留下未提交的回填改动。** 已写入的必须提交完毕；未写的一律不写，转为待办列入 prompt。
2. prompt 中**显式声明**「回填审计未完成，以下 N 条结论尚未落盘，请接手方先补」，并逐条列出。
3. 采集仍在此之后进行，因此 HEAD 与工作区状态始终是真实终态。

被牺牲的是"回填的完整性"，不是"事实的准确性"。事实准确性无条件优先。

## 五阶段

### ① 定位

1. 取项目根：`git rev-parse --show-toplevel`。非 git 项目用当前工作目录，并在档案里记明「非 git 项目」。
2. 看 `.handoff/project-profile.md` 是否存在：
   - **存在** → 做增量校验（细则见 `references/detection.md` 的「增量校验」），通过后**跳至 ③**
   - **不存在** → 进 ②
3. 同时判定模式：

```
目标平台 == 当前平台，且未提及分工        → 接力
目标平台 != 当前平台，或用户明示"让 X 去实现" → 委派
边界模糊                                   → 询问用户，不猜
```

### ② 探测（仅首次）

扫四类：**事实源地图 / 执行方法论 / 硬约束 / 交接件落点**。
具体命令与判定规则见 `references/detection.md`，此处只讲三条铁律：

- 每条结论必须标档（见下文「分级标注」），并附证据
- **探测不到就留空**，在档案里显式写「未探测到」——禁止用通用最佳实践填充空缺
- 产出 `.handoff/project-profile.md` → **只把 ② 类条目列给用户校对** → 固化并提交

profile 已存在且增量校验通过时，**② 整段跳过**，探测成本为零。

### ③ 回填审计

扫的是**本会话产生的结论·裁决·发现·踩坑**——来自会话上下文，不是从仓库里扫。

逐条判两件事：**已落盘了吗？该进哪份文档？**（目标文档取自 profile 的事实源地图）

先出清单给用户批，每条一行：

```
结论摘要 | 目标文档 | 新增 / 修订
```

- 用户批准后才写入。**默认不改用户的长期事实源**——没批的不写。
- 写完**立即提交**：显式 `git add <path>`，commit 描述用项目既有语言。
- 被否决的条目不写，转为 prompt 里的待办。

### ④ 采集事实

🔴 **本阶段必须在 ③ 的提交完成之后执行，顺序不可调换。**
理由：③ 会写文件并产生提交，而本阶段要把 HEAD 写进 prompt。顺序反了，prompt 里的 HEAD 就是
回填前的旧值，接手方跑自愈判定时会与实际 HEAD 不符——要么停下追问仓库被谁动过，要么信了错值
继续执行。「工作区干净」这一断言同理，必须在回填提交完成后才采集。

**全部实测，不许凭记忆**（HEAD、测试数字、工作区状态、分支恰恰是记忆最易错、错了代价最高的）：

```bash
git rev-parse --show-toplevel     # 项目根绝对路径
git branch --show-current         # 分支；detached 时输出为空，需另记
git log --oneline -3              # HEAD 及其前两个提交
git status --short                # 工作区是否干净；有输出就不是"干净"
git worktree list                 # 是否在 worktree 中、还有哪些
git log @{u}..HEAD --oneline      # 未推送提交；报错说明无上游分支，如实记
git stash list                    # 有 stash 必须写进 prompt，否则接手方看不见
```

测试基线：从 profile 的「硬约束」栏取测试命令跑。**不得卡死**。分两种情形，处置不同：

| 情形 | 处置 |
|---|---|
| **项目根本没有测试命令**（profile 该栏实测为「未探测到」） | 基线记「不存在（项目无测试命令）」；prompt 的第 4 段**整段不输出**。别写「请先自行跑一遍」——没有可跑的东西，那句话是空的 |
| **有测试命令但跑不起来 / 超时 / 报错** | 基线记「未取得（原因）」；prompt 第 4 段**照常输出**，写明「起点基线未知，请先自行跑一遍」 |

- 最多尝试一次，超过 5 分钟即中止
- 🔴 **禁止写一个没有实际跑出来的数字**

### ⑤ 生成

三份产出，按序落盘：

1. **稳定交接文档** → 落到 profile 的「交接件落点」。只有 profile 指向项目内稳定 durable 文档时才**追加**；
   不得把 `.handoff/inbox/`、`.handoff/archive/` 或具体 handoff 文件当作长期账本。位置与顺序遵循该账本
   既有惯例；追加时必须带**显式失效声明**（如「以本段为准，下方全部过时」）。若未探测到稳定事实源，
   把缺口报告给用户，等待指定 durable 文档后再回填。
2. **完整 prompt** → 写入前先确认 `.handoff/inbox/<date>-<topic>-prompt.md` 不存在；确认无同名冲突后写入该路径，
   文件名必须唯一，**同时在终端打印全文**供用户过目。
3. **接力指针** → 在 prompt 中写入本次 inbox 文件的绝对路径；为兼容旧的一行入口，可建立逐字节一致的
   临时 `.handoff/latest.md` 镜像，并用 `diff` 复核。用户把 prompt 交给接收方后，接收方按「交接件生命周期」
   清理临时镜像并归档 inbox 中的权威单文件；不得留下长期有效的 `latest.md`。

🔴 **交接件镜像和归档移动一律走绝对路径的二进制并复核结果。** `cp` / `mv` 在很多环境里被 alias
成 `-i`，非交互执行时可能不按预期完成——你以为写入或归档成功了，实际文件仍未按协议变化。

生成阶段（兼容旧的一行入口时才执行）：

```bash
inbox_dir="/绝对路径/.handoff/inbox"
handoff_file="${inbox_dir}/<date>-<topic>-prompt.md"
latest_file="/绝对路径/.handoff/latest.md"
/bin/mkdir -p "${inbox_dir}"
if [ -e "${latest_file}" ] || [ -L "${latest_file}" ]; then
  printf '%s\n' "latest 镜像已存在，停止并报告冲突" >&2
  exit 1
fi
/bin/cp -f "${handoff_file}" "${latest_file}"
diff "${handoff_file}" "${latest_file}"
```

消费阶段（接手自检完成后执行）：

```bash
archive_dir="/绝对路径/.handoff/archive"
handoff_file="/绝对路径/.handoff/inbox/<date>-<topic>-prompt.md"
archive_file="${archive_dir}/<date>-<topic>-prompt.md"
latest_file="/绝对路径/.handoff/latest.md"
/bin/mkdir -p "${archive_dir}"
if [ -e "${archive_file}" ]; then
  printf '%s\n' "archive 目标已存在，停止并保留 inbox 文件" >&2
  exit 1
fi
if [ -e "${latest_file}" ] || [ -L "${latest_file}" ]; then
  diff "${handoff_file}" "${latest_file}"
  /bin/unlink "${latest_file}"
fi
/bin/mv "${handoff_file}" "${archive_file}"
test ! -e "${handoff_file}" && test -e "${archive_file}" && test ! -e "${latest_file}" && test ! -L "${latest_file}"
```

**判据是复核命令的输出，不是命令有没有报错。** 镜像或归档失败时不得把 handoff 说成已消费，
也不得删除 inbox 权威源文件来“补救”；如果是接力中断，保留 inbox 文件和（如存在的）latest 镜像供重试。

🔴 **交接件自身的提交会让 HEAD 再前进一个**——这不可避免（要提交就有新 commit；
把新 sha 写进去再提交，它又变了，会递归）。所以第 2 段的自愈判定**不许写「首行应为 `<sha>`」**，
要写成对提交条数不敏感的形式（`git merge-base --is-ancestor` + 「其后只动过交接件」，
写法见 `references/prompt-skeleton.md` 的「自愈判定」）。

若选择不提交交接件（留作未跟踪文件），HEAD 精确等于采集值，但**必须在 prompt 里写明
这些文件未进版本管理**，否则接手方在别的 worktree 或别的机器上会找不到它们。

接力 prompt 本身是交给新会话的唯一指针。新会话只应按 prompt 中的绝对路径读取本次 handoff，
新 prompt 的默认入口是 inbox 中的唯一文件；不要扫描 `.handoff` 或读取 `archive`。旧 prompt 若明确
指向 `.handoff/latest.md`，才使用该临时兼容入口：

```
读 /绝对路径/.handoff/inbox/<date>-<topic>-prompt.md 并严格按它执行；接手自检完成后清理 latest 镜像并归档该文件
```

跨平台交接仍按平台档案翻译；目标平台若无法访问该绝对路径，必须提供等价的可达交接路径或明确报告
无法消费，确认接收前不得把 inbox 文件归档。

prompt 用十段骨架（🔒 为必填；其余按探测结果决定是否输出）：

```
🔒 1. 接手 <项目> <主题>。这是接力 / 这是委派。接力件：/绝对路径/.handoff/inbox/<date>-<topic>-prompt.md
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

**逐段写什么、从哪取材、什么时候不输出，见 `references/prompt-skeleton.md`。**
接力与委派的差异只在第 3、7 段与一个附加段，同样在那份文件里。

## 分级标注

每条探测结论必须标明来源：

| 档 | 含义 | 用户是否需要校对 |
|---|---|---|
| ① | 实测（附命令/输出证据） | 否 |
| ② | 我推断的，未实测 | **是，重点校对** |
| ③ | 抄自项目规范原文 | 否 |
| ④ | 用户口述或手改 | 否，**且锁定** |

把校对成本收敛到只看 ② 类。一条 ② 类误判会被复制进后续每一份交接件，且越往后越无人回头核对。

## 平台翻译

**不存在"母语平台"与"降级平台"之分。** 本 skill 自身可能运行在任一平台上，两侧都应精准翻译。

| 层 | 内容 | 是否翻译 |
|---|---|---|
| 事实层 | 路径、commit、待办、判据 | 否——任何 agent 都能读 |
| 执行层 | 用什么方法论推进 | **是** |
| 纪律层·项目 | 项目特有纪律 | 否，照搬 |
| 纪律层·平台 | 平台特有纪律 | **是**；平台不匹配则整条不输出 |

平台档案在 `references/platforms/<platform>.md`，与 project-profile 走同一套机制
（探测 + 分级标注 + 用户校对 + ④ 锁定）。

🔴 **其他平台的机制不得凭印象编写**——那属于"转抄自别处、未核"。
未建立档案的平台：翻译一律降级为能力描述并标 ②，让接手方知道该条未经验证；
需要建档时用 `references/platforms/_template.md`，经用户校对后固化。

## 禁止事项

1. **探测不到就留空，禁止用通用最佳实践填充。** 代价：一个只有 README 的项目会被写出它根本
   没有的方法论，接手方照着走全是空。
2. **④ 类条目不得自动覆盖**，冲突时停下报告请用户裁决。代价：用户纠正过的条目会被推断值改回，
   同一处错误要反复纠正，且用户分不清是 skill 又错了还是自己记错。
3. **事实不许凭记忆**，HEAD / 测试数字 / 工作区状态 / 分支一律跑命令取。
4. **prompt 只装指针不装内容。** 判断标准：接手方不读那份文档也能干活，就说明内容被抄进来了。
5. **一次性消费。** handoff prompt 只服务于一次接力；消费完成后归档，后续普通任务不再读取它。
6. **③ 早于 ④，顺序不许换**（理由见 ④）。
7. **不得把某个具体项目的文档名 / 流程名 / 工具名写进本 skill。** 项目形态一律靠探测得出。

## profile 维护

除手改外（**手改内容优先于探测结果**），支持自然语言驱动的三种操作：

| 操作 | 触发 | 行为 |
|---|---|---|
| 定点修正 | 「X 那条不对，实际是 Y」 | 只动该条，不重探其他；改后标 ④ |
| 重新探测 | 「项目结构变了，重新扫」 | 全量重探，**保留所有 ④ 类**，冲突处报告 |
| 补充 | 「以后记住：动生产前必须先给我批」 | 新增条目，标 ④ |
