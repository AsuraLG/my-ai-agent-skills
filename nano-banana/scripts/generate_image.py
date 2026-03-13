#!/usr/bin/python3
"""
Nano Banana 图像生成脚本
使用 Google Nano Banana 系列模型生成图片
"""

import argparse
import base64
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from providers import (
    build_provider_request,
    parse_provider_image_response,
    resolve_provider_endpoint,
    resolve_provider_type,
)

SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent
VENV_DIR = SKILL_ROOT / ".venv"
VENV_PYTHON = VENV_DIR / "bin" / "python"
PYPROJECT_FILE = SKILL_ROOT / "pyproject.toml"
requests = None


def find_command(command: str) -> Optional[str]:
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        candidate = Path(directory) / command
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


def sync_dependencies() -> None:
    """使用 uv sync 同步 skill 依赖"""
    if not PYPROJECT_FILE.exists():
        print(f"错误: 未找到项目文件: {PYPROJECT_FILE}", file=sys.stderr)
        sys.exit(1)

    subprocess.run(["uv", "sync"], check=True, cwd=str(SKILL_ROOT))


def ensure_venv() -> None:
    """确保 skill 根目录下的 uv 虚拟环境和依赖已就绪"""
    if VENV_PYTHON.exists():
        return

    if not find_command("uv"):
        print("错误: 未找到 uv，请先安装 uv 后再使用 nano-banana skill", file=sys.stderr)
        print("可参考: brew install uv", file=sys.stderr)
        sys.exit(1)

    print("检测到 nano-banana 虚拟环境不存在，正在初始化...")

    try:
        sync_dependencies()
    except subprocess.CalledProcessError as exc:
        print(f"错误: 初始化虚拟环境失败: {exc}", file=sys.stderr)
        sys.exit(1)


def reexec_in_venv() -> None:
    """确保脚本始终在 skill 自身虚拟环境中执行"""
    ensure_venv()

    current_python = Path(sys.executable).resolve()
    if current_python == VENV_PYTHON.resolve():
        return

    os.execv(str(VENV_PYTHON), [str(VENV_PYTHON), str(Path(__file__).resolve()), *sys.argv[1:]])


def parse_bool(value: Any) -> bool:
    """解析布尔配置值"""
    if isinstance(value, bool):
        return value

    if value is None:
        return False

    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off", ""}:
        return False

    raise ValueError(
        "代理开关配置无效: proxy_enabled / NANOBANANA_PROXY_ENABLED 只支持 true/false/1/0/yes/no"
    )


def build_proxies(config: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """根据配置构造 requests 代理参数"""
    proxy_enabled = parse_bool(config.get("proxy_enabled"))
    if not proxy_enabled:
        return None

    proxy_type = str(config.get("proxy_type") or "").strip().lower()
    if not proxy_type:
        raise ValueError("代理已开启，但缺少 proxy_type / NANOBANANA_PROXY_TYPE 配置")
    if proxy_type not in {"http", "socks5"}:
        raise ValueError("代理类型不支持: 仅支持 http 和 socks5")

    proxy_host = str(config.get("proxy_host") or "").strip()
    if not proxy_host:
        raise ValueError("代理已开启，但缺少 proxy_host / NANOBANANA_PROXY_HOST 配置")

    proxy_port = str(config.get("proxy_port") or "").strip()
    if not proxy_port:
        raise ValueError("代理已开启，但缺少 proxy_port / NANOBANANA_PROXY_PORT 配置")
    if not proxy_port.isdigit():
        raise ValueError("代理端口配置无效: proxy_port / NANOBANANA_PROXY_PORT 必须为数字")

    proxy_url = f"{proxy_type}://{proxy_host}:{proxy_port}"
    return {
        "http": proxy_url,
        "https": proxy_url,
    }


def load_config() -> Dict[str, Any]:
    """加载配置，支持环境变量和配置文件"""
    config: Dict[str, Any] = {}
    config_path = Path.home() / ".config" / "nano-banana" / "config.json"

    if config_path.exists():
        with open(config_path, encoding="utf-8") as file:
            config = json.load(file)

    provider_type = os.environ.get("NANOBANANA_PROVIDER_TYPE") or config.get(
        "provider_type", "openai_compatible"
    )
    base_url = os.environ.get("NANOBANANA_BASE_URL") or config.get("base_url")
    api_key = os.environ.get("NANOBANANA_API_KEY") or config.get("api_key")
    model_id = os.environ.get("NANOBANANA_MODEL_ID") or config.get("model_id")

    proxy_enabled = os.environ.get("NANOBANANA_PROXY_ENABLED")
    if proxy_enabled is None:
        proxy_enabled = config.get("proxy_enabled")

    proxy_type = os.environ.get("NANOBANANA_PROXY_TYPE") or config.get("proxy_type")
    proxy_host = os.environ.get("NANOBANANA_PROXY_HOST") or config.get("proxy_host")
    proxy_port = os.environ.get("NANOBANANA_PROXY_PORT") or config.get("proxy_port")

    if not (base_url and api_key and model_id):
        print("错误: 请先配置 API", file=sys.stderr)
        print("", file=sys.stderr)
        print("方式一（环境变量）:", file=sys.stderr)
        print('  export NANOBANANA_PROVIDER_TYPE="openai_compatible"  # 推荐，可选值: openrouter / openai_compatible', file=sys.stderr)
        print('  export NANOBANANA_BASE_URL="https://your-api-endpoint.com/v1"', file=sys.stderr)
        print('  export NANOBANANA_API_KEY="your-api-key"', file=sys.stderr)
        print('  export NANOBANANA_MODEL_ID="your-model-id"', file=sys.stderr)
        print('  export NANOBANANA_PROXY_ENABLED="true"  # 可选', file=sys.stderr)
        print('  export NANOBANANA_PROXY_TYPE="http"     # 可选: http 或 socks5', file=sys.stderr)
        print('  export NANOBANANA_PROXY_HOST="127.0.0.1" # 可选', file=sys.stderr)
        print('  export NANOBANANA_PROXY_PORT="7890"      # 可选', file=sys.stderr)
        print("", file=sys.stderr)
        print("方式二（配置文件）:", file=sys.stderr)
        print('  mkdir -p ~/.config/nano-banana', file=sys.stderr)
        print(
            "  cat > ~/.config/nano-banana/config.json <<'EOF'\n"
            "  {\n"
            '    "provider_type": "openai_compatible",\n'
            '    "base_url": "...",\n'
            '    "api_key": "...",\n'
            '    "model_id": "...",\n'
            '    "proxy_enabled": false,\n'
            '    "proxy_type": "http",\n'
            '    "proxy_host": "127.0.0.1",\n'
            '    "proxy_port": 7890\n'
            "  }\n"
            "  EOF",
            file=sys.stderr,
        )
        sys.exit(1)

    return {
        "provider_type": resolve_provider_type(provider_type),
        "base_url": base_url.rstrip("/"),
        "api_key": api_key,
        "model_id": model_id,
        "proxy_enabled": proxy_enabled,
        "proxy_type": proxy_type,
        "proxy_host": proxy_host,
        "proxy_port": proxy_port,
    }


def detect_mime_type(image_path: str) -> str:
    """根据文件扩展名推断 MIME 类型"""
    ext = Path(image_path).suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }.get(ext, "image/png")


def encode_image(image_path: str) -> str:
    """将图片编码为 base64"""
    with open(image_path, "rb") as file:
        return base64.b64encode(file.read()).decode("utf-8")


def build_image_input(image_path: Optional[str]) -> Optional[Dict[str, str]]:
    """构造 provider 可复用的图片输入结构"""
    if not image_path:
        return None

    if not os.path.exists(image_path):
        print(f"错误: 图片不存在: {image_path}", file=sys.stderr)
        sys.exit(1)

    mime_type = detect_mime_type(image_path)
    image_b64 = encode_image(image_path)
    data_url = f"data:{mime_type};base64,{image_b64}"
    return {
        "mime_type": mime_type,
        "base64": image_b64,
        "data_url": data_url,
    }


def decode_data_url(data_url: str) -> bytes:
    """解析 data URL 并提取图片二进制内容"""
    prefix, _, payload = data_url.partition(",")
    if not prefix.startswith("data:image/") or not payload:
        raise ValueError("返回的 data URL 格式无效")
    return base64.b64decode(payload)


def is_probable_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def decode_image_result(image_data: str, proxies: Optional[Dict[str, str]]) -> bytes:
    """将 provider 返回的图片结果解析为字节流"""
    if image_data.startswith("data:image/"):
        return decode_data_url(image_data)

    if is_probable_url(image_data):
        img_response = requests.get(image_data, timeout=120, proxies=proxies)
        img_response.raise_for_status()
        return img_response.content

    return base64.b64decode(image_data)


def generate_image(
    prompt: str,
    image_path: str = None,
    output: str = "output.png",
    size: Optional[str] = None,
    aspect_ratio: Optional[str] = None,
):
    """调用 Nano Banana API 生成图片"""
    config = load_config()
    config["size"] = size
    config["aspect_ratio"] = aspect_ratio
    proxies = build_proxies(config)
    endpoint = resolve_provider_endpoint(config)
    provider_type = config["provider_type"]
    image_input = build_image_input(image_path)

    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }
    payload = build_provider_request(config, prompt, image_input)

    print("正在生成图片...")
    print(f"Provider: {provider_type}")
    print(f"Prompt: {prompt}")
    if image_path:
        print(f"参考图: {image_path}")
    if provider_type == "openrouter":
        image_config = payload.get("image_config")
        if image_config:
            print(f"OpenRouter image_config: {json.dumps(image_config, ensure_ascii=False)}")
        else:
            print("OpenRouter image_config: <default>")

    try:
        response = requests.post(
            endpoint,
            headers=headers,
            json=payload,
            timeout=120,
            proxies=proxies,
        )

        if response.status_code != 200:
            print(f"API 错误: {response.status_code}", file=sys.stderr)
            print(response.text, file=sys.stderr)
            sys.exit(1)

        result = response.json()
        image_data = parse_provider_image_response(provider_type, result)
        if image_data:
            image_bytes = decode_image_result(image_data, proxies)
            with open(output, "wb") as file:
                file.write(image_bytes)

            print(f"✅ 图片已保存: {output}")
            print(output)
            return

        print("错误: 无法解析 API 响应", file=sys.stderr)
        print(json.dumps(result, indent=2, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

    except requests.exceptions.Timeout:
        print("错误: 请求超时", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"错误: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    reexec_in_venv()

    import requests as requests_module

    requests = requests_module

    parser = argparse.ArgumentParser(description="使用 Nano Banana 系列模型生成图片")
    parser.add_argument("--prompt", "-p", required=True, help="图像描述文字")
    parser.add_argument("--image", "-i", help="参考图片路径（可选）")
    parser.add_argument("--output", "-o", default="output.png", help="输出文件名")
    parser.add_argument("--size", help="OpenRouter image_size，可选值: 0.5K / 1K / 2K / 4K")
    parser.add_argument("--aspect-ratio", help="OpenRouter aspect_ratio，例如 16:9 / 1:1 / 9:16")

    arguments = parser.parse_args()
    generate_image(
        arguments.prompt,
        arguments.image,
        arguments.output,
        arguments.size,
        arguments.aspect_ratio,
    )
