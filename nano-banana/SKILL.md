---
name: nano-banana
description: 使用 Google Nano Banana系列模型生成图片。当用户要求根据描述（包括文字和图片）生成图片时，使用此 skill 调用图像生成 API。
---

# Nano Banana 图像生成

## 快速开始

当用户要求生成图片时，使用 `scripts/generate_image.py` 脚本。

skill 首次运行时会自动检查 skill 根目录下的 `.venv` 是否存在：
- 如果不存在，会自动使用 `uv sync` 创建虚拟环境并安装 `pyproject.toml` 中声明的依赖
- 如果已存在，后续会直接复用该虚拟环境
- 脚本会自动切换到这个虚拟环境中执行，无需手动 `source`

### 环境配置

首次使用前需要配置模型 API。

现在支持通过 `provider_type` 显式区分提供商。当前内置支持：
- `openrouter`：针对 OpenRouter 的专属适配逻辑
- `openai_compatible`：兼容当前默认的 OpenAI 风格接口，作为兜底分支

如未配置 `provider_type`，脚本会默认回退到 `openai_compatible`，以兼容已有配置；但推荐显式配置，避免不同 provider 混用时出现协议不兼容。

未开启代理时，脚本保持当前直连行为；开启代理后，模型请求和图片下载都会走同一个代理。当前支持 `http` 和 `socks5` 两种代理类型。

**方式一：环境变量**
```bash
export NANOBANANA_PROVIDER_TYPE="openrouter"
export NANOBANANA_BASE_URL="https://openrouter.ai/api/v1"
export NANOBANANA_API_KEY="your-api-key"
export NANOBANANA_MODEL_ID="your-model-id"

# 代理配置（可选）
export NANOBANANA_PROXY_ENABLED="true"
export NANOBANANA_PROXY_TYPE="http"      # 支持 http / socks5
export NANOBANANA_PROXY_HOST="127.0.0.1"
export NANOBANANA_PROXY_PORT="7890"
```

**方式二：配置文件**
创建 `~/.config/nano-banana/config.json`:
```json
{
  "provider_type": "openai_compatible",
  "base_url": "https://your-api-endpoint.com/v1",
  "api_key": "your-api-key",
  "model_id": "your-model-id",
  "proxy_enabled": false,
  "proxy_type": "http",
  "proxy_host": "127.0.0.1",
  "proxy_port": 7890
}
```

配置项说明：
- `provider_type`: 提供商类型，当前支持 `openrouter` 和 `openai_compatible`
- `base_url`: 模型接口地址
- `api_key`: 模型接口凭证
- `model_id`: 模型 ID
- `proxy_enabled`: 是否启用代理，支持 `true/false/1/0/yes/no`
- `proxy_type`: 代理类型，仅支持 `http` 和 `socks5`
- `proxy_host`: 代理主机名或 IP
- `proxy_port`: 代理端口

配置优先级保持不变：环境变量优先，其次是 `~/.config/nano-banana/config.json`。

### Provider 示例

**OpenRouter 推荐配置：**
```json
{
  "provider_type": "openrouter",
  "base_url": "https://openrouter.ai/api/v1",
  "api_key": "your-openrouter-api-key",
  "model_id": "your-image-capable-model-id"
}
```

OpenRouter 当前会：
- 请求 `chat/completions` 接口
- 在 `messages[].content` 中传递文字与可选参考图
- 显式携带 `modalities: ["image", "text"]`
- 当传入 `--size` 或 `--aspect-ratio` 时，仅在 `provider_type=openrouter` 下透传到 `image_config`
- `--aspect-ratio` 支持：`1:1`、`2:3`、`3:2`、`3:4`、`4:3`、`4:5`、`5:4`、`9:16`、`16:9`、`21:9`、`1:4`、`4:1`、`1:8`、`8:1`
- `--size` 支持：`0.5K`、`1K`、`2K`、`4K`
- `1:1` 和 `1K` 是 OpenRouter 默认值；不传时由 provider 使用默认值
- 优先从 `choices[0].message.images[*].image_url.url` 提取结果
- 同时兼容 data URL 与普通图片 URL 返回

请确认所选 OpenRouter 模型支持 image output；返回图片通常是 data URL，不应假设一定是裸 base64。

**OpenAI Compatible 推荐配置：**
```json
{
  "provider_type": "openai_compatible",
  "base_url": "https://your-api-endpoint.com/v1",
  "api_key": "your-api-key",
  "model_id": "your-model-id"
}
```

该模式会继续沿用当前兼容逻辑：
- 使用 `messages` + `response_format: {"type": "image"}` 请求
- 保留现有多种响应结构的图片提取兼容逻辑

### 依赖管理

skill 根目录下维护 `pyproject.toml`，所有 Python 依赖都应写在这里。

当前初始化流程会：
1. 检查 skill 根目录下是否存在 `.venv`
2. 若不存在，执行 `uv sync`
3. 使用 `<skill-root>/.venv/bin/python` 重新执行当前脚本

### 使用方法

推荐直接执行：
```bash
python scripts/generate_image.py --prompt "描述文字" [--image /path/to/image.png] [--output output.png] [--size 1024x1024] [--aspect-ratio 16:9]
```

参数说明：
- `--prompt`: 必填，图像描述
- `--image`: 可选，参考图片路径
- `--output`: 可选，输出文件名（默认 `output.png`）
- `--size`: 可选，输出尺寸，例如 `1024x1024`；当前仅在 `provider_type=openrouter` 时有值才透传
- `--aspect-ratio`: 可选，宽高比，例如 `16:9`；当前仅在 `provider_type=openrouter` 时有值才透传

### 示例

**纯文字生成：**
```bash
python scripts/generate_image.py --prompt "一只可爱的橘猫在阳光下打盹"
```

**图文生成（参考图+描述）：**
```bash
python scripts/generate_image.py --prompt "把这只猫变成卡通风格" --image /path/to/cat.png
```

**手动预初始化环境（可选）：**
```bash
bash scripts/setup.sh
```

## 配置优先级

1. 环境变量（优先级最高）
2. 配置文件 `~/.config/nano-banana/config.json`
3. 默认值（如果都未设置，会报错提示）

## 输出

图片会保存在当前目录下，默认命名为 `output.png`。脚本会返回图片路径。
