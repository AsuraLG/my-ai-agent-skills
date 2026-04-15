# 使用示例

## 场景1: 禁用单个MCP服务器

**用户请求**: "我想在这个项目中禁用github服务器"

**执行方式**:
```
/disable-mcp-servers-in-project github
```

**输出**:
```
============================================================
MCP 服务器禁用配置
============================================================

📁 项目路径: /Users/XXX/my-java-project
📝 配置文件: ~/.claude.json

修改前的禁用列表:
  (空)

修改后的禁用列表:
  ✓ github

✨ 新增禁用的服务器 (1):
  + github

============================================================
✅ 配置已成功更新
💡 提示: 建议重启 Claude Code 以确保配置生效
============================================================
```

## 场景2: 禁用多个MCP服务器

**用户请求**: "禁用filesystem、sequential-thinking和memory这三个mcp服务器"

**执行方式**:
```
/disable-mcp-servers-in-project filesystem sequential-thinking memory
```

或者:
```
/disable-mcp-servers-in-project filesystem,sequential-thinking,memory
```

或者:
```
/disable-mcp-servers-in-project filesystem，sequential-thinking，memory
```

**输出**:
```
============================================================
MCP 服务器禁用配置
============================================================

📁 项目路径: /Users/XXX/my-project
📝 配置文件: ~/.claude.json

修改前的禁用列表:
  (空)

修改后的禁用列表:
  ✓ filesystem
  ✓ sequential-thinking
  ✓ memory

✨ 新增禁用的服务器 (3):
  + filesystem
  + sequential-thinking
  + memory

============================================================
✅ 配置已成功更新
💡 提示: 建议重启 Claude Code 以确保配置生效
============================================================
```

## 场景3: 添加新的禁用服务器（已有部分禁用）

**用户请求**: "在当前项目中禁用github和puppeteer"

**前置状态**: 项目中已禁用github

**执行方式**:
```
/disable-mcp-servers-in-project github puppeteer
```

**输出**:
```
============================================================
MCP 服务器禁用配置
============================================================

📁 项目路径: /Users/XXX/my-project
📝 配置文件: ~/.claude.json

修改前的禁用列表:
  ✓ github

修改后的禁用列表:
  ✓ github
  ✓ puppeteer

✨ 新增禁用的服务器 (1):
  + puppeteer

ℹ️  已存在的服务器 (1):
  - github

============================================================
✅ 配置已成功更新
💡 提示: 建议重启 Claude Code 以确保配置生效
============================================================
```

## 场景4: 自然语言请求

**用户请求**: "在当前项目中禁用这些mcp：filesystem，sequential-thinking，memory"

Skill会自动解析用户的自然语言请求，提取MCP服务器名称，并执行禁用操作。

## 配置文件变化

### 修改前
```json
{
  "projects": {
    "/Users/XXX/my-project": {
      "disabledMcpServers": [],
      "...": "其他配置"
    }
  }
}
```

### 修改后
```json
{
  "projects": {
    "/Users/XXX/my-project": {
      "disabledMcpServers": [
        "filesystem",
        "sequential-thinking",
        "memory"
      ],
      "...": "其他配置"
    }
  }
}
```

## 常见问题

### Q: 如何撤销禁用？
A: 目前此skill不支持撤销功能。你可以手动编辑~/.claude.json文件，从disabledMcpServers数组中移除相应的服务器名称。

### Q: 修改后需要重启吗？
A: 建议重启Claude Code以确保配置生效。

### Q: 支持其他环境吗？
A: 目前仅支持Claude Code环境。如果在其他环境中使用，会显示错误提示。

### Q: 如果输入了不存在的MCP服务器名称会怎样？
A: Skill会直接添加到disabledMcpServers数组中。这不会导致错误，但可能不会产生预期的效果。

### Q: 支持哪些输入格式？
A: 支持以下格式：
- 空格分隔: `server1 server2 server3`
- 英文逗号分隔: `server1,server2,server3`
- 中文逗号分隔: `server1，server2，server3`
- 自然语言: "禁用这些mcp：server1，server2，server3"
