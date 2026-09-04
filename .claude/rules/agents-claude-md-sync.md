---
paths:
  - "agents-claude-md-sync/**"
---

# agents-claude-md-sync 开发约束

- `SKILL.md` 必须保留“环境前置检查”章节，并同步递增 `metadata.version` 与 `metadata.last_updated`。
- 该 skill 面向通用 Agent，必须同时保留 Claude Code 的 `disable-model-invocation: true` 与 Codex/OpenAI 的 `agents/openai.yaml` 调用限制。
- `scripts/sync_agent_docs.sh` 必须保持无第三方依赖、可由 POSIX `sh` 解析；修改后至少运行 `sh -n scripts/sync_agent_docs.sh`。
- 变更前先在临时目录验证：两者缺失、仅有 `AGENTS.md`、已同步、内容一致、内容冲突、仅有 `CLAUDE.md`、缺失源引用和非普通文件等状态。
- 备份不得覆盖已有路径；重写前必须先完成备份，写入失败时报告已完成动作，不擅自回滚用户文件。
