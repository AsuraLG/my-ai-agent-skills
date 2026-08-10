---
paths:
  - "handoff/**"
---

# handoff 开发约束

改这个 skill 前先读 `dev/handoff/NOTES.md`，那里有判据顺序与完整的裁决台账指引。

## 判据顺序

1. `dev/handoff/specs/2026-08-04-handoff-skill-design.md` —— **spec 是判据**
2. `dev/handoff/decisions/2026-08-04-brainstorm-裁决台账.md` —— 已定案 vs 可推翻的推断
3. `dev/handoff/research/` —— 验证基准（语料原文因脱敏未随附）
4. `dev/handoff/plans/` —— 实现计划

**spec 与实现冲突时以 spec 为准。spec 本身有疑问时找用户裁决，不自行解释。**

这些文档写于迁入本仓库之前，里面的路径（`skills/handoff/`、`docs/superpowers/…`）指向当时的目录结构，未随迁移改写。映射表见 `dev/handoff/NOTES.md` 的「读旧文档时的路径映射」。

裁决台账里标「已定案」的不要重新提案；标「我的推断」的可以推翻，但推翻前先读它的理由。引用任何历史裁决前，先检查其成立前提是否仍然有效——该台账里已有两条裁决因前提失效而被重新裁定。

## 硬约束

- **skill 本体不得含任何具体项目的信息**。项目形态一律靠探测得出（spec §3.3）。这是设计约束，不是脱敏的结果。
- **其他平台的机制不得凭印象编写**。没实测过就标注为「转抄自别处、未核」，不要写成确定事实。
- **不设「母语平台」**。Claude Code 与其他平台两侧都走「探测 + 分级标注 + 用户校对 + 锁定」，对称精准。
- **回填审计必须早于事实采集**。顺序反了，prompt 里的 HEAD 就是旧值，接手方的自愈判定会对不上。
- **上下文告急时优先交付 prompt**，牺牲回填完整性而非准确性。标明「还有 N 条没落盘」的 prompt 可用，HEAD 写错的不可用。
- **未定项清单可以写，但禁止给建议值**，必须标注「这是需要裁决的空缺，不是既有需求」。

## 验证

- spec §10 三项验证由**全新 subagent** 执行，不由改动它的会话内联跑——读过设计的会话会无意识照着黄金答案写，判别力被污染。
- 回归验证用 `git clone --local --no-hardlinks` 到临时目录做隔离，不用 worktree（`worktree add` 会往源仓库写元数据，clone 对源仓库纯读）。**clone 后必须摘除 `origin` 远端**，防误 push。
- 语料原文已因脱敏移除，回归验证无法原样重跑。重建方法见 `dev/handoff/research/`。

## 改动后

改了行为、阶段顺序、产出形态或触发条件，递增 `SKILL.md` frontmatter 的 `metadata.version` 并更新 `last_updated`，同时在 `dev/handoff/NOTES.md` 的「版本变更」记一条。

注意本 skill 存在多份副本（`environment` 仓库的源目录、已部署副本），改本仓库不会自动同步过去。
