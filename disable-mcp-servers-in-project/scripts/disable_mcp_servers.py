#!/usr/bin/env python3
"""
禁用项目中的MCP服务器脚本
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Tuple


def detect_environment() -> str:
    """
    检测当前运行的AI agent环境

    Returns:
        str: 'claude-code', 'codex-cli', 'gemini-cli', 或 'unknown'
    """
    # 检查环境变量
    if os.getenv('CLAUDE_CODE_ENV'):
        return 'claude-code'
    if os.getenv('CODEX_CLI_ENV'):
        return 'codex-cli'
    if os.getenv('GEMINI_CLI_ENV'):
        return 'gemini-cli'

    # 检查是否存在Claude Code特定的配置文件
    claude_json_path = Path.home() / '.claude.json'
    if claude_json_path.exists():
        return 'claude-code'

    return 'unknown'


def get_current_project_path() -> str:
    """
    获取当前项目的真实路径（使用当前工作目录）

    Returns:
        str: 当前工作目录的绝对路径
    """
    return os.path.abspath(os.getcwd())


def parse_mcp_servers(input_str: str) -> List[str]:
    """
    从用户输入中解析MCP服务器名称
    支持多种格式：
    - 逗号分隔：octo,mafka,lion
    - 空格分隔：octo mafka lion
    - 中文逗号分隔：octo，mafka，lion

    Args:
        input_str: 用户输入的字符串

    Returns:
        List[str]: 解析后的MCP服务器名称列表
    """
    # 替换中文逗号为英文逗号
    input_str = input_str.replace('，', ',')

    # 尝试按逗号分隔
    if ',' in input_str:
        servers = [s.strip() for s in input_str.split(',')]
    else:
        # 按空格分隔
        servers = input_str.split()

    # 过滤空字符串
    servers = [s for s in servers if s]

    return servers


def load_claude_json() -> Dict:
    """
    加载~/.claude.json配置文件

    Returns:
        Dict: 配置文件内容

    Raises:
        FileNotFoundError: 如果文件不存在
        json.JSONDecodeError: 如果JSON格式错误
    """
    claude_json_path = Path.home() / '.claude.json'

    if not claude_json_path.exists():
        raise FileNotFoundError(f"配置文件不存在: {claude_json_path}")

    with open(claude_json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_claude_json(config: Dict) -> None:
    """
    保存配置到~/.claude.json

    Args:
        config: 配置字典
    """
    claude_json_path = Path.home() / '.claude.json'

    with open(claude_json_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def disable_mcp_servers(
    project_path: str,
    servers_to_disable: List[str]
) -> Tuple[List[str], List[str], List[str], List[str]]:
    """
    在指定项目中禁用MCP服务器

    Args:
        project_path: 项目路径
        servers_to_disable: 要禁用的服务器列表

    Returns:
        Tuple[List[str], List[str], List[str], List[str]]:
            - 修改前的disabledMcpServers列表
            - 修改后的disabledMcpServers列表
            - 新增的服务器列表
            - 已存在的服务器列表
    """
    # 加载配置
    config = load_claude_json()

    # 确保projects字段存在
    if 'projects' not in config:
        config['projects'] = {}

    # 确保项目配置存在
    if project_path not in config['projects']:
        config['projects'][project_path] = {}

    project_config = config['projects'][project_path]

    # 获取修改前的列表
    disabled_before = project_config.get('disabledMcpServers', [])
    disabled_before_copy = disabled_before.copy()

    # 确保disabledMcpServers字段存在
    if 'disabledMcpServers' not in project_config:
        project_config['disabledMcpServers'] = []

    # 添加新的服务器（去重）
    new_servers = []
    existing_servers = []
    for server in servers_to_disable:
        if server not in project_config['disabledMcpServers']:
            project_config['disabledMcpServers'].append(server)
            new_servers.append(server)
        else:
            existing_servers.append(server)

    # 保存配置
    save_claude_json(config)

    # 获取修改后的列表
    disabled_after = project_config['disabledMcpServers']

    return disabled_before_copy, disabled_after, new_servers, existing_servers


def format_output(
    project_path: str,
    disabled_before: List[str],
    disabled_after: List[str],
    new_servers: List[str],
    existing_servers: List[str]
) -> str:
    """
    格式化输出信息

    Args:
        project_path: 项目路径
        disabled_before: 修改前的列表
        disabled_after: 修改后的列表
        new_servers: 新增的服务器
        existing_servers: 已存在的服务器

    Returns:
        str: 格式化后的输出
    """
    output = []
    output.append("=" * 60)
    output.append("MCP 服务器禁用配置")
    output.append("=" * 60)
    output.append("")

    output.append(f"📁 项目路径: {project_path}")
    output.append(f"📝 配置文件: ~/.claude.json")
    output.append("")

    output.append("修改前的禁用列表:")
    if disabled_before:
        for server in disabled_before:
            output.append(f"  ✓ {server}")
    else:
        output.append("  (空)")
    output.append("")

    output.append("修改后的禁用列表:")
    if disabled_after:
        for server in disabled_after:
            output.append(f"  ✓ {server}")
    else:
        output.append("  (空)")
    output.append("")

    if new_servers:
        output.append(f"✨ 新增禁用的服务器 ({len(new_servers)}):")
        for server in new_servers:
            output.append(f"  + {server}")
        output.append("")

    if existing_servers:
        output.append(f"ℹ️  已存在的服务器 ({len(existing_servers)}):")
        for server in existing_servers:
            output.append(f"  - {server}")
        output.append("")

    output.append("=" * 60)
    output.append("✅ 配置已成功更新")
    output.append("💡 提示: 建议重启 Claude Code 以确保配置生效")
    output.append("=" * 60)

    return "\n".join(output)


def main():
    """主函数"""
    # 检测环境
    env = detect_environment()

    if env != 'claude-code':
        print("❌ 错误: 此skill仅支持在Claude Code中使用")
        print(f"   当前环境: {env}")
        sys.exit(1)

    # 获取命令行参数
    if len(sys.argv) < 2:
        print("❌ 错误: 请指定要禁用的MCP服务器")
        print("用法: python disable_mcp_servers.py <server1> [server2] [server3] ...")
        print("例如: python disable_mcp_servers.py octo mafka lion")
        sys.exit(1)

    # 过滤掉以--开头的参数（这些是脚本参数，不是服务器名称）
    args = [arg for arg in sys.argv[1:] if not arg.startswith('--')]

    if not args:
        print("❌ 错误: 请指定要禁用的MCP服务器")
        print("用法: python disable_mcp_servers.py <server1> [server2] [server3] ...")
        print("例如: python disable_mcp_servers.py octo mafka lion")
        sys.exit(1)

    # 解析服务器列表
    servers_input = ' '.join(args)
    servers_to_disable = parse_mcp_servers(servers_input)

    if not servers_to_disable:
        print("❌ 错误: 无法解析MCP服务器名称")
        sys.exit(1)

    # 获取项目路径
    project_path = get_current_project_path()

    try:
        # 禁用服务器
        disabled_before, disabled_after, new_servers, existing_servers = disable_mcp_servers(
            project_path,
            servers_to_disable
        )

        # 输出结果
        output = format_output(
            project_path,
            disabled_before,
            disabled_after,
            new_servers,
            existing_servers
        )
        print(output)

    except FileNotFoundError as e:
        print(f"❌ 错误: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ 错误: 配置文件格式错误: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 错误: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
