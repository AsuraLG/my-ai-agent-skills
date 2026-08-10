# 平台档案：Claude Code

> 由 handoff skill 于 2026-08-04 建立（首次实现时随本 skill 一起写）。
> 标注：① 实测（附证据） ② 我推断的（请重点校对） ③ 转抄自别处、未核 ④ 用户说的（锁定）
>
> 🔴 **本档案只描述 Claude Code。向其他平台交接时不得套用本档案**——
> 请按 `_template.md` 新建该平台的档案，经用户校对后固化。凭印象类推别的平台，
> 等于把"转抄未核"的东西当成事实写进交接件。

## 执行层：方法论词汇（翻译第 8 段「怎么做」时用）

| 条目 | 内容 | 档位 | 出处 / 证据 |
|---|---|---|---|
| skill 的调用方式 | 用 `Skill` 工具，参数为 skill 名（插件内的写 `plugin:skill`）；用户在输入框打 `/<skill-name>` 也是同一件事 | ① | 本会话实测调用过 `superpowers:writing-plans` |
| skill 的安装位置 | `~/.claude/skills/<name>/SKILL.md`；**软链有效**，改源文件即刻生效，无需重启会话 | ① | 本会话建 `~/.claude/skills/handoff` 软链后，harness 当场把 handoff 列入可用 skill |
| 流程类 skill（若已安装） | superpowers 系列：`brainstorming` / `writing-plans` / `executing-plans` / `subagent-driven-development` / `systematic-debugging` / `test-driven-development` / `verification-before-completion` / `requesting-code-review` / `using-git-worktrees` | ① | 本会话的可用 skill 清单 |
| ⚠️ 上一行的作用域 | 该清单**随用户的安装情况变化**。写进交接件时应说明「以你自己会话里能看到的为准」，不要断言接手方一定有 | ① | 同上——清单本身就是会话级的 |
| 子任务派发 | `Agent` 工具派 subagent，可指定 agent 类型；默认后台运行，完成时通知派发方 | ③ | 本会话的工具说明；**未实测，请自己核** |
| 待办跟踪 | `TaskCreate` / `TaskUpdate` 等任务工具（是否可用取决于 harness 配置） | ② | 我从本会话的提示中推断，未实测 |
| 自动化 | hooks 配置在 `.claude/settings.json`；由 harness 执行，不是由模型执行 | ③ | 本会话的 harness 说明；未实测 |

## 纪律层·平台（翻译时整条照搬；平台不匹配则整条不输出）

| 条目 | 内容 | 档位 | 出处 / 证据 |
|---|---|---|---|
| subagent 的工作目录 | **不随 worktree 切换**。用工具切进 worktree 后，派出的 subagent 的工作目录仍是**会话启动目录**。简报里写 "Work from: <路径>" 只是文字说明，不改变它的实际 cwd | ③ | 使用者的 Git 协作规范文档「Worktree 与 subagent 协作」原文；**我未实测** |
| 派 subagent 的路径纪律 | 简报里所有路径一律写**绝对路径**；要求它第一步先切到目标路径并自检（`pwd` / `git branch --show-current`），不符就停下报告 | ③ | 同上 |
| subagent 的结果回传 | subagent 的最终文本输出不一定自动送达派发方，需要显式的回传动作 | ③ | 历史交接语料中的用户原话（多次重复）；**未实测，请自己核** |
| 会话启动目录 | 会话启动时固定。若该目录被删除（如删掉正在其中工作的 worktree），后续工具调用会出错 | ③ | 历史交接语料中的用户原话；**未实测，请自己核** |
| 上下文管理 | 会话过长时上下文会被压缩/摘要。**这正是本 skill 存在的理由**：结论必须落盘，不能只留在上下文里 | ③ | 本会话的 harness 说明 |

## 已知不适用 / 别写进给本平台的 prompt

| 条目 | 内容 | 档位 |
|---|---|---|
| 自动检测上下文用量 | skill 无法读取上下文用量，也不能常驻监听。别在 prompt 里要求接手方「上下文到 X% 时自动做 Y」——那是 hook 层的事 | ③（本 skill 的 spec §12.2 明确不做） |

## 维护

本档案与 project-profile 走同一套机制：探测 + 分级标注 + 用户校对 + ④ 锁定。

- 用户校对过的条目 → 改标 ④ 并锁定，后续不得被推断值覆盖
- 实测过的 ③ / ② 条目 → 升为 ①，并把证据（命令 + 输出摘要）写进「出处」列
- **降级方向不允许**：不要把标 ③ 的东西因为"看起来很确定"就改成 ①
