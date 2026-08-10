# my-ai-agent-skills 仓库规范

本仓库负责 skill 的**开发与维护**，不负责 skill 的安装、部署与分发。

## 目录约定

根目录的每个 `<skill-name>/` 是一个纯 skill，会被使用者整个复制走。`dev/<skill-name>/` 存放该 skill 的开发资产，不随 skill 分发。

分界判据只有一条：**使用者需要的进 skill 目录，使用者不需要的进 `dev/`**。

| 内容 | 位置 |
| --- | --- |
| `SKILL.md`、`scripts/`、`references/`、`assets/`、`schemas/`、`template/` | skill 目录内 |
| `evals/`、`tests/`、`tests/fixtures/` | skill 目录内（是 skill 的验证资产，跟着走才有意义） |
| 改该 skill 代码时必须遵守的约束 | `.claude/rules/<skill-name>.md` |
| 设计决策、踩坑记录、当前状态、版本变更 | `dev/<skill-name>/NOTES.md` |
| 调试产物、试验脚本、生成的样例文件 | `dev/<skill-name>/scratch/`（已 gitignore） |

判不准时问自己：使用者拿到这个 skill 后，少了这个文件能不能正常用？能，就不该在 skill 目录里。

`dev/NOTES.md`（`dev/` 根下那份）记录仓库自身的结构与规范决策，不属于任何单个 skill。

## 开发约束写 .claude/rules/，不写进 skill 目录

约束类内容（「现在该怎么做」）放 `.claude/rules/<skill-name>.md`，用 `paths` frontmatter 绑定到对应 skill 目录：

```markdown
---
paths:
  - "nano-banana/**"
---
```

这样一动 `nano-banana/` 下的文件，该约束自动进上下文；不动就不占 context；文件不在 skill 目录内，不会分发给使用者。

与 `NOTES.md` 的分工：

| | `.claude/rules/<skill>.md` | `dev/<skill>/NOTES.md` |
| --- | --- | --- |
| 内容 | 现在该怎么做（约束、禁止项、验证命令） | 当初为什么这么定、当前状态、已知问题、待办 |
| 加载 | 读到匹配文件时自动加载 | 不自动加载，需要时才查 |

**不要把开发约束写进 skill 目录内的 `CLAUDE.md`**——那个位置既会分发给使用者，又不会在开发时自动加载（子目录 CLAUDE.md 只在读取该子目录下的文件时才加载，而开发时读的是 skill 目录里的代码）。

已知限制：`/compact` 之后 path-scoped rules 不会自动重新注入，要重新读到匹配文件才 reload。必须每次都生效的规则写在本文件里。

## 新建一个 skill

1. 在根目录建 `<skill-name>/`，写 `SKILL.md`
2. 建 `dev/<skill-name>/NOTES.md`，套用下方模板
3. 更新 `README.md` 的 skill 表格（表格是使用者的入口，漏了等于没发布）

## SKILL.md frontmatter

必填：

```yaml
---
name: <与目录名一致>
description: <触发条件描述，决定 skill 何时被激活>
metadata:
  version: v1
  last_updated: "YYYY-MM-DD"
---
```

可选：`compatibility`（例如 `Claude Code only`，仅在 skill 依赖特定 harness 时写）。

`description` 是 skill 的对外接口，决定它何时被触发。改动 `description` 属于影响执行结果的变更，必须递增版本号。

## 版本号

**构成 skill 的任何一部分发生变化，都递增 `version`**，包括 `SKILL.md` 正文的措辞调整——正文就是执行指令，改措辞就可能改变 agent 行为。

不按「大改升版本、小修不升」判断：「小修」无法客观划界，一旦版本号与实际内容脱钩，版本号就失去对账价值。

递增 `version` 时同步更新 `last_updated`。

## NOTES.md 模板

```markdown
# <skill-name> 开发记录

## 设计决策
<!-- 为什么选 A 不选 B。写决策与理由，不写实现细节——实现细节看代码 -->

## 踩坑记录
<!-- 什么方案试过不行、失败现象是什么 -->

## 版本变更
<!-- v2（YYYY-MM-DD）改了什么、为什么 -->
```

三个章节固定。没内容就空着，不要填占位文字——空的比编的好。
