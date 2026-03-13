#!/bin/bash
# Nano Banana 依赖安装脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Nano Banana 图像生成工具 ==="
echo ""

# 检查 uv
if ! command -v uv &> /dev/null; then
    echo "错误: 未找到 uv，请先安装"
    echo "安装方式: brew install uv"
    exit 1
fi

# 创建虚拟环境
if [ ! -d ".venv" ]; then
    echo "创建虚拟环境..."
    uv venv
fi

# 安装依赖
echo "安装依赖..."
source .venv/bin/activate
uv pip install requests

echo ""
echo "✅ 安装完成！"
echo ""
echo "请配置 API："
echo ""
echo "方式一（环境变量）:"
echo '  export NANOBANANA_BASE_URL="https://your-endpoint.com/v1"'
echo '  export NANOBANANA_API_KEY="your-key"'
echo ""
echo "方式二（配置文件）:"
echo '  mkdir -p ~/.config/nano-banana'
echo '  cp scripts/config.example.json ~/.config/nano-banana/config.json'
echo '  # 然后编辑配置文件填入你的 API 信息'
echo ""
echo "使用示例:"
echo '  python scripts/generate_image.py --prompt "一只可爱的猫"'
