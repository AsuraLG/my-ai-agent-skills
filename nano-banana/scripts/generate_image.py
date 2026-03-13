#!/usr/bin/env python3
"""
Nano Banana 图像生成脚本
使用 Google Nano Banana Pro 模型生成图片
"""

import argparse
import base64
import json
import os
import sys
from pathlib import Path

import requests


def load_config():
    """加载配置，支持环境变量和配置文件"""
    # 1. 环境变量（优先级最高）
    base_url = os.environ.get("NANOBANANA_BASE_URL")
    api_key = os.environ.get("NANOBANANA_API_KEY")
    
    if base_url and api_key:
        return base_url.rstrip("/"), api_key
    
    # 2. 配置文件
    config_path = Path.home() / ".config" / "nano-banana" / "config.json"
    if config_path.exists():
        with open(config_path) as f:
            config = json.load(f)
            base_url = config.get("base_url")
            api_key = config.get("api_key")
            if base_url and api_key:
                return base_url.rstrip("/"), api_key
    
    # 3. 未配置
    print("错误: 请先配置 API", file=sys.stderr)
    print("", file=sys.stderr)
    print("方式一（环境变量）:", file=sys.stderr)
    print('  export NANOBANANA_BASE_URL="https://your-api-endpoint.com/v1"', file=sys.stderr)
    print('  export NANOBANANA_API_KEY="your-api-key"', file=sys.stderr)
    print("", file=sys.stderr)
    print("方式二（配置文件）:", file=sys.stderr)
    print('  mkdir -p ~/.config/nano-banana', file=sys.stderr)
    print('  echo \'{"base_url": "...", "api_key": "..."}\' > ~/.config/nano-banana/config.json', file=sys.stderr)
    sys.exit(1)


def encode_image(image_path: str) -> str:
    """将图片编码为 base64"""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def generate_image(prompt: str, image_path: str = None, output: str = "output.png"):
    """调用 Nano Banana API 生成图片"""
    base_url, api_key = load_config()
    
    # 构建请求
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # 组装消息
    messages = []
    
    # 如果有参考图，添加图片
    if image_path:
        if not os.path.exists(image_path):
            print(f"错误: 图片不存在: {image_path}", file=sys.stderr)
            sys.exit(1)
        
        image_b64 = encode_image(image_path)
        # 尝试识别图片类型
        ext = Path(image_path).suffix.lower()
        mime_type = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp"
        }.get(ext, "image/png")
        
        messages.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime_type};base64,{image_b64}"
            }
        })
    
    # 添加文字描述
    messages.append({
        "type": "text",
        "text": prompt
    })
    
    # API 请求体（OpenAI 兼容格式）
    payload = {
        "model": "nano-banana-pro",
        "messages": [
            {
                "role": "user",
                "content": messages
            }
        ],
        "response_format": {
            "type": "image"  # 指定输出为图片
        }
    }
    
    # 调用 API
    print(f"正在生成图片...")
    print(f"Prompt: {prompt}")
    if image_path:
        print(f"参考图: {image_path}")
    
    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
            timeout=120
        )
        
        if response.status_code != 200:
            print(f"API 错误: {response.status_code}", file=sys.stderr)
            print(response.text, file=sys.stderr)
            sys.exit(1)
        
        result = response.json()
        
        # 解析返回的图片（根据实际 API 响应格式调整）
        # 假设返回 base64 图片
        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0].get("message", {}).get("content", {})
            
            # 处理不同的返回格式
            if isinstance(content, dict):
                # 可能是 {"image": "base64..."} 或 {"url": "..."}
                image_data = content.get("image") or content.get("url") or content.get("b64_json")
            else:
                image_data = content
            
            if image_data:
                # 如果是 URL，直接下载
                if image_data.startswith("http"):
                    img_response = requests.get(image_data)
                    image_bytes = img_response.content
                # 如果是 base64，解码
                else:
                    image_bytes = base64.b64decode(image_data)
                
                # 保存图片
                with open(output, "wb") as f:
                    f.write(image_bytes)
                
                print(f"✅ 图片已保存: {output}")
                print(output)  # 输出路径供脚本调用
                return
        
        print("错误: 无法解析 API 响应", file=sys.stderr)
        print(json.dumps(result, indent=2, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
        
    except requests.exceptions.Timeout:
        print("错误: 请求超时", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)


def init_venv():
    """初始化 uv 虚拟环境"""
    venv_path = Path(__file__).parent / ".venv"
    
    if not venv_path.exists():
        print("正在创建虚拟环境...")
        os.system("uv venv")
        print("正在安装依赖...")
        os.system("uv pip install requests")
    else:
        print("虚拟环境已存在")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="使用 Nano Banana Pro 生成图片")
    parser.add_argument("--prompt", "-p", required=True, help="图像描述文字")
    parser.add_argument("--image", "-i", help="参考图片路径（可选）")
    parser.add_argument("--output", "-o", default="output.png", help="输出文件名")
    
    args = parser.parse_args()
    
    # 检查并提示 uv 虚拟环境
    script_dir = Path(__file__).parent
    venv_python = script_dir / ".venv" / "bin" / "python"
    
    if not venv_python.exists():
        print("提示: 首次使用将自动创建虚拟环境并安装依赖")
        # 不自动创建，提示用户手动确认
        # init_venv()
    
    generate_image(args.prompt, args.image, args.output)
