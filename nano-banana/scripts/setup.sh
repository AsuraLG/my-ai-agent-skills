#!/bin/bash
# Nano Banana 依赖安装脚本

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$SKILL_ROOT"

echo "=== Nano Banana 图像生成工具 ==="
echo ""

if ! command -v uv >/dev/null 2>&1; then
    echo "错误: 未找到 uv，请先安装"
    echo "安装方式: brew install uv"
    exit 1
fi

echo "同步虚拟环境和依赖..."
uv sync

echo ""
echo "✅ 安装完成！"
echo ""
echo "后续请使用 skill 内的虚拟环境解释器执行脚本："
echo "  $SKILL_ROOT/.venv/bin/python scripts/generate_image.py --prompt \"一只可爱的猫\""
echo ""
echo "请配置 API："
echo ""
echo "方式一（环境变量）:"
echo '  export NANOBANANA_BASE_URL="https://your-endpoint.com/v1"'
echo '  export NANOBANANA_API_KEY="your-key"'
echo '  export NANOBANANA_MODEL_ID="your-model-id"'
echo ""
echo "方式二（配置文件）:"
echo '  mkdir -p ~/.config/nano-banana'
echo '  cp scripts/config.example.json ~/.config/nano-banana/config.json'
echo '  # 然后编辑配置文件填入你的 API 信息'
