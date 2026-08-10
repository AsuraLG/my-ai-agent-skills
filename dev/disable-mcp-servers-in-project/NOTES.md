# disable-mcp-servers-in-project 开发记录

> 本文件建立于 2026-08-10。

## 设计决策

### description 里强制要求执行脚本，禁止 AI 自己写代码

`description` 结尾明确写了「此 skill 提供了一个现成的 Python 脚本，你必须执行这个脚本来完成任务，而不是自己写代码」。

这句话是刻意加的：改 MCP 配置属于改动本地配置文件，AI 临时写的脚本容易把 JSON 结构写坏。给一个经过验证的脚本，比让 AI 每次现写更可靠。

### 唯一声明 compatibility 的 skill

frontmatter 里有 `compatibility: Claude Code only`，因为它操作的是 Claude Code 特有的 MCP 配置结构，换 harness 无意义。本仓库其他 skill 都没有这个字段。

## 踩坑记录

<!-- 暂无记录 -->

## 版本变更

- **v1**（2026-04-15，b5efe95）初版。
