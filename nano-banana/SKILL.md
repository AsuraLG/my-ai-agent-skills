---
name: nano-banana
description: 使用 Google Nano Banana Pro 模型生成图片。当用户要求根据描述（包括文字和图片）生成图片时，使用此 skill 调用图像生成 API。
---

# Nano Banana 图像生成

## 快速开始

当用户要求生成图片时，使用 `scripts/generate_image.py` 脚本。

### 环境配置

首次使用前需要配置模型 API：

**方式一：环境变量**
```bash
export NANOBANANA_BASE_URL="https://your-api-endpoint.com/v1"
export NANOBANANA_API_KEY="your-api-key"
```

**方式二：配置文件**
创建 `~/.config/nano-banana/config.json`:
```json
{
  "base_url": "https://your-api-endpoint.com/v1",
  "api_key": "your-api-key"
}
```

### 使用方法

```bash
python scripts/generate_image.py --prompt "描述文字" [--image base64图片] [--output output.png]
```

- `--prompt`: 必填，图像描述
- `--image`: 可选，参考图片（base64 编码）
- `--output`: 可选，输出文件名（默认 `output.png`）

### 示例

**纯文字生成：**
```bash
python scripts/generate_image.py --prompt "一只可爱的橘猫在阳光下打盹"
```

**图文生成（参考图+描述）：**
```bash
python scripts/generate_image.py --prompt "把这只猫变成卡通风格" --image /path/to/cat.png
```

## 配置优先级

1. 环境变量（优先级最高）
2. 配置文件 `~/.config/nano-banana/config.json`
3. 默认值（如果都未设置，会报错提示）

## 输出

图片会保存在当前目录下，默认命名为 `output.png`。脚本会返回图片路径。
