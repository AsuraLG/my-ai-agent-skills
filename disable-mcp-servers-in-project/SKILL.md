---
name: disable-mcp-servers-in-project
description: 在Claude Code项目中禁用指定的MCP服务器。当用户要求禁用某些MCP服务器时，使用此skill。此skill提供了一个现成的Python脚本，你必须执行这个脚本来完成任务，而不是自己写代码
compatibility: Claude Code only
---

# 禁用项目中的MCP服务器

此skill提供了一个现成的Python脚本来禁用Claude Code项目中的MCP服务器。**你必须执行这个脚本，而不是自己写代码。**

## 执行步骤（必须遵循）

1. **获取脚本路径**：`scripts/disable_mcp_servers.py`
2. **运行脚本**：使用python执行脚本，传入要禁用的服务器名称作为参数
3. **脚本会自动处理**：
   - 检测当前项目路径
   - 读取 ~/.claude.json 配置文件
   - 在 `projects.当前项目路径.disabledMcpServers` 下添加服务器
   - 保存配置并显示结果

## 使用示例

**禁用单个服务器：**
```bash
python scripts/disable_mcp_servers.py fetch
```

**禁用多个服务器：**
```bash
python scripts/disable_mcp_servers.py fetch fetch1 fetch2
```

**支持的参数格式：**
- 空格分隔：`server1 server2 server3`
- 逗号分隔：`server1,server2,server3`
- 中文逗号分隔：`server1，server2，server3`

## 重要提示

⚠️ **不要自己写Python代码来修改配置文件。** 直接使用提供的脚本。

脚本会正确地：
- 在 `projects.当前项目路径` 下创建 `disabledMcpServers` 数组
- 处理去重和错误情况

## 输出信息

脚本执行完成后会显示：
- 当前项目路径
- 修改前的禁用列表
- 修改后的禁用列表
- 新增的服务器列表
- 已存在的服务器列表

## 注意事项

- 此skill仅在Claude Code中可用
- 如果指定的MCP服务器已在disabledMcpServers中，将被跳过（不重复添加）
- 修改会立即写入~/.claude.json文件
- 建议在修改后重启Claude Code以确保配置生效
