# hv-analysis 开发记录

> 本文件建立于 2026-08-10，早于此的内容从 git 提交信息与代码反推，已标注出处。

## 设计决策

### 来源与改造范围

来自 [khazix-skills](https://github.com/KKKKhazix/khazix-skills)，本仓库做了改造，主要是 Python 环境管理方式与 SKILL.md 内容（4840864、5b6a505、d8b2eb2）。

### 独立 .venv + 运行时自检（4840864，2026-04-15）

与 `nano-banana` 同一套约定：每个 skill 一个独立 `.venv`，用 `uv run --project <skill-root>` 调用，`scripts/_runtime.py` 校验解释器确实是本 skill 的 `.venv`，校验不过直接失败。

同一次提交同步更新了用户全局的 skill Python 使用规范，两者是配套的。

### Python 版本下限 3.10，高于 nano-banana

`pyproject.toml` 声明 `requires-python = ">=3.10"`，依赖 `weasyprint` 与 `markdown`。这与 `nano-banana` 的 3.9 下限不同——版本下限由各 skill 自己的依赖决定，不强求全仓库统一。

## 踩坑记录

<!-- 暂无记录 -->

## 版本变更

- **v1**（2026-04-15，d670d15 初版；同月 5b6a505、4840864、d8b2eb2 三次改动均未单独递增版本号——早于 2026-08-10 的版本规范，不回溯）
