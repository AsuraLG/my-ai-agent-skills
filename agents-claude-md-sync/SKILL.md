---
name: agents-claude-md-sync
description: 在当前项目根目录同步 AGENTS.md 与 CLAUDE.md：以 AGENTS.md 为权威源，安全创建、备份或重写文件，并报告所有实际改动。
disable-model-invocation: true
metadata:
  version: v7
  last_updated: "2026-09-04"
---

## 环境前置检查

在执行前确认本 skill 自带脚本存在，并确认 `sh`、`cmp`、`cp`、`cat`、`ln`、`mktemp`、`mv`、`rm`、`chmod`、`awk`、`sed` 可用。检查只报告事实，不安装依赖、不修改配置：

```sh
test -f "$SKILL_DIR/scripts/sync_agent_docs.sh" || printf 'missing: sync_agent_docs.sh\n'
for required_cmd in sh cmp cp cat ln mktemp mv rm chmod awk sed; do
  command -v "$required_cmd" >/dev/null 2>&1 || printf 'missing: %s\n' "$required_cmd"
done
```

若检查失败，停止并告知缺失项；修复环境后重新运行本 skill。

## 工作流

1. 使用 agent 当前会话已经判定的“当前项目根目录”。不要向用户索取 `AGENTS.md` 或 `CLAUDE.md` 路径，也不要递归搜索其他目录。
2. 将终端工作目录切换到该项目根目录，使用本 skill 加载时提供的 skill 根目录（记为 `SKILL_DIR`）运行：

   ```sh
   sh "$SKILL_DIR/scripts/sync_agent_docs.sh"
   ```

   脚本也接受一个目录参数，但通常不需要传入；不要把具体项目绝对路径写进本 skill。
3. 读取脚本输出的单行 JSON，并按其中的 `status`、`state`、`actions`、`backup_path`、`reason`、`verification` 生成中文审阅报告。报告必须包含：
   - 实际检查的项目根目录；
   - 检测到的文件状态；
   - 每个实际动作（创建、备份、重写）；
   - 跳过或停止的原因；
   - 最终验证结果。
4. 脚本返回非零状态时，不要自行重试或手工继续写文件；如为内容冲突，明确提醒用户先手动调整为一致后再次运行本 skill。

## 固定行为

- `CLAUDE.md` 的目标引用是严格的单行 `@AGENTS.md`，并带一个末尾换行。
- 内容比较使用字节级 `cmp`，不忽略换行、BOM 或编码差异。
- 两者都不存在时不创建文件，只报告。
- 只有 `AGENTS.md` 时创建 `CLAUDE.md` 并写入目标引用。
- 两者都存在且 `CLAUDE.md` 已是目标引用时视为已同步，不创建备份。
- 两者都存在且内容完全一致时，先备份原 `CLAUDE.md`，再原子重写为目标引用。
- 两者都存在但内容不一致时不改动，报告冲突。
- 只有 `CLAUDE.md` 时：若它已是指向缺失 `AGENTS.md` 的目标引用则不改动；否则先备份，再逐字节创建 `AGENTS.md`，最后原子重写 `CLAUDE.md`。
- 备份名从 `CLAUDE.md.bak` 开始；已有备份中取最大数字后加一（`.bak` 视为 0），不回填空档、不覆盖已有路径。
- 只处理普通文件。目录、符号链接、设备文件等异常状态不覆盖、不删除。
- 备份成功后才允许重写；新文件使用当前用户 umask，重写已有 `CLAUDE.md` 保留原权限位。
