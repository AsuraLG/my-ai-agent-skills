# github-tool-research 开发记录

> 本文件建立于 2026-08-10。

## 设计决策

<!-- 暂无记录。初版一次成型（3c145fc，2026-07-25），设计过程未留档 -->

## 踩坑记录

### 调研产物混进了分发单元（2026-08-10 发现并清理）

`reports/claude-code-statusline-hud-20260725.html` 是一次真实调研的输出（46KB），被 git 跟踪，会跟着 skill 分发给使用者。对使用者没有价值——`assets/report-skeleton.html` 才是模板。

已删除。以后调试产物一律进 `dev/github-tool-research/scratch/`（已 gitignore）。

**判据**：使用者拿到这个 skill 后，少了这个文件能不能正常用？能，就不该在 skill 目录里。

## 版本变更

- **v1**（2026-07-25，3c145fc）初版。产出结论先行、证据分级、手机友好的 HTML 选型对比报告。
