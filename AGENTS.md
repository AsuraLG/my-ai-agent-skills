# my-ai-agent-skills 仓库规范

本仓库负责 skill 的**开发与维护**，不负责 skill 的安装、部署与分发。

## 目录约定

根目录的每个 `<skill-name>/` 是一个纯 skill，会被使用者整个复制走。`dev/<skill-name>/` 存放该 skill 的开发资产，不随 skill 分发。

分界判据只有一条：**使用者需要的进 skill 目录，使用者不需要的进 `dev/`**。

| 内容 | 位置 |
| --- | --- |
| `SKILL.md`、`scripts/`、`references/`、`assets/`、`schemas/`、`template/` | skill 目录内 |
| `agents/openai.yaml`（通用和 Codex/OpenAI 专用 skill 必需） | skill 目录内 |
| `evals/`、`tests/`、`tests/fixtures/` | skill 目录内（是 skill 的验证资产，跟着走才有意义） |
| 改该 skill 代码时必须遵守的约束 | `.claude/rules/<skill-name>.md` |
| 设计决策、踩坑记录、当前状态、版本变更 | `dev/<skill-name>/NOTES.md` |
| 调试产物、试验脚本、生成的样例文件 | `dev/<skill-name>/scratch/`（已 gitignore） |

判不准时问自己：使用者拿到这个 skill 后，少了这个文件能不能正常用？能，就不该在 skill 目录里。

`dev/NOTES.md`（`dev/` 根下那份）记录仓库自身的结构与规范决策，不属于任何单个 skill。

## 开发约束与 Agent 读取

约束类内容（「现在该怎么做」）放 `.claude/rules/<skill-name>.md`，用 `paths` frontmatter 绑定到对应 skill 目录。该目录属于本仓库的开发约束，不随 skill 分发：

```markdown
---
paths:
  - "nano-banana/**"
---
```

Codex CLI 不会自动发现 `.claude/rules/`；处理或修改对应 skill 时，必须根据本 `AGENTS.md` 主动读取匹配的规则文件。文件不在 skill 目录内，不会分发给使用者。

与 `NOTES.md` 的分工：

| | `.claude/rules/<skill>.md` | `dev/<skill>/NOTES.md` |
| --- | --- | --- |
| 内容 | 现在该怎么做（约束、禁止项、验证命令） | 当初为什么这么定、当前状态、已知问题、待办 |
| 加载 | Claude Code 按自身规则机制加载；Codex 处理对应 skill 时主动读取 | 不自动加载，需要时才查 |

不要把开发约束写进 skill 目录内的 `CLAUDE.md`。它属于分发内容，不是本仓库的开发约束文件。

## Skill 规范

### 适用范围与 Agent 平台

- 如果用户没有明确说明 skill 只适用于某个或某些 Agent，且 skill 自身的 `description`、`compatibility` 等说明也没有限定 Agent，则视为**通用 skill**。
- 通用 skill 和明确面向 Codex/OpenAI 的专用 skill，都必须提供 `agents/openai.yaml`。
- 本仓库当前只定义通用 skill 与 Codex/OpenAI 专用 skill 的 OpenAI 元数据要求；其他 Agent 的专属规则在实际引入时再补充。

### 分发文件

使用者需要的文件放在 skill 目录内，开发过程专用的约束、决策记录和调试产物放在仓库外层对应目录：

- 必需：`SKILL.md`
- 通用或 Codex/OpenAI 专用 skill 必需：`agents/openai.yaml`
- 按功能需要添加：`scripts/`、`references/`、`assets/`、`schemas/`、`template/`、`evals/`、`tests/`
- 不随 skill 分发：`.claude/rules/<skill-name>.md`、`dev/<skill-name>/NOTES.md`、`dev/<skill-name>/scratch/`

### SKILL.md

`SKILL.md` frontmatter 必须包含：

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

`description` 是 skill 的对外接口，决定它何时被触发；`name` 必须与 skill 目录名一致。

### agents/openai.yaml

通用 skill 和明确面向 Codex/OpenAI 的专用 skill 都必须创建该文件，且至少包含以下非空字符串字段：

```yaml
interface:
  display_name: "Skill 的界面名称"
  short_description: "Skill 的简短说明"
  default_prompt: "使用 $skill-name ..."
```

`interface.default_prompt` 应明确使用对应的 `$<skill-name>` 调用该 skill。其他界面字段和调用策略字段按实际需要添加。

`interface.display_name` 就是 skill 名称，必须与 `SKILL.md` 的 `name` 和 skill 目录名一致，不使用其他展示名称。

### 版本管理

构成 skill 的任何一部分发生变化，都必须递增 `SKILL.md` 的 `metadata.version`，并同步更新 `metadata.last_updated`。这包括但不限于：

- `SKILL.md` 的正文或 frontmatter
- `description`、`compatibility` 等触发和适用范围字段
- `agents/openai.yaml` 的任意配置
- `scripts/`、`references/`、`assets/`、`schemas/`、`template/`、`evals/`、`tests/` 中的 skill 文件

不按「大改升版本、小修不升」判断；只要 skill 内容发生变化，就必须升级版本，避免版本号与实际内容脱钩。

### 新建或修改 Skill 的检查清单

1. 判断 skill 的适用范围和 Agent 平台。
2. 创建或确认 `<skill-name>/SKILL.md`。
3. 通用 skill 或 Codex/OpenAI 专用 skill 创建或确认 `agents/openai.yaml`。
4. 创建或更新 `dev/<skill-name>/NOTES.md`。
5. 创建或更新 `.claude/rules/<skill-name>.md` 中的开发约束。
6. 更新 `metadata.version` 和 `metadata.last_updated`。
7. 更新 `README.md` 的 skill 表格（表格是使用者的入口，漏了等于没发布）。
8. 执行该 skill 对应的验证命令，并检查分发目录中没有开发专用文件。

## 开发记录

`dev/<skill-name>/NOTES.md` 记录设计决策、踩坑记录、当前状态和版本变更；该文件不随 skill 分发。

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
