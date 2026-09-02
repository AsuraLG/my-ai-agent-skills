---
name: nano-banana
description: 使用 Google Nano Banana系列模型生成图片。当用户要求根据描述（包括文字和图片）生成图片时，使用此 skill 调用图像生成 API。
metadata:
  version: v6
  last_updated: "2026-09-02"
---

# Nano Banana 图像生成

## 环境前置检查

执行前确认 `uv` 已安装，并在 skill 自己的虚拟环境中运行：

```bash
command -v uv
uv run --project /path/to/nano-banana python /path/to/nano-banana/scripts/generate_image.py --help
```

脚本会校验 `sys.prefix` 是否指向 `/path/to/nano-banana/.venv`；检查失败只会报错，不会自动安装依赖、修改配置或执行登录。首次使用请先在 skill 根目录运行 `uv sync`。

## 快速开始

当用户要求生成图片时，使用 `scripts/generate_image.py` 脚本。

skill 使用 `uv project` 管理依赖和虚拟环境：
- 依赖声明写在 skill 根目录下的 `pyproject.toml`
- 锁定结果写在 skill 根目录下的 `uv.lock`
- 实际运行时统一使用 skill 根目录下的 `.venv`
- 脚本不会自动切换虚拟环境；如果当前解释器不是这个 skill 自己的 `.venv`，会直接退出并提示正确命令

### 环境配置

首次使用前需要配置模型 API。

现在支持通过 `provider_type` 显式区分提供商。当前内置支持：
- `openrouter`：针对 OpenRouter 的专属适配逻辑
- `openrouter_images`：OpenRouter 专用图片生成 `/images` API
- `openai_compatible`：兼容当前默认的 OpenAI 风格接口，作为兜底分支

如未配置 `provider_type`，脚本会默认回退到 `openai_compatible`，以兼容已有配置；但推荐显式配置，避免不同 provider 混用时出现协议不兼容。

未开启代理时，脚本保持当前直连行为；开启代理后，模型请求和图片下载都会走同一个代理。当前支持 `http` 和 `socks5` 两种代理类型。

对 `openrouter` 和 `openrouter_images`，脚本内置 `https://openrouter.ai/api/v1` 作为默认 base URL，因此配置文件和环境变量无需再设置 `base_url`；如确有兼容网关需求，仍可显式覆盖。

**方式一：环境变量**
```bash
export NANOBANANA_PROVIDER_TYPE="openrouter"
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
  "provider_type": "openrouter_images",
  "api_key": "your-api-key",
  "model_id": "google/gemini-3.1-flash-image",
  "proxy_enabled": false,
  "proxy_type": "http",
  "proxy_host": "127.0.0.1",
  "proxy_port": 7890
}
```

配置项说明：
- `provider_type`: 提供商类型，支持 `openrouter`、`openrouter_images` 和 `openai_compatible`
- `base_url`: 模型接口地址；OpenRouter 两种 provider 默认内置 `https://openrouter.ai/api/v1`，无需配置
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
  "api_key": "your-openrouter-api-key",
  "model_id": "your-image-capable-model-id"
}
```

OpenRouter 当前会：
- 请求 `chat/completions` 接口
- 在 `messages[].content` 中传递文字与可选参考图（支持多张）
- 显式携带 `modalities: ["image", "text"]`
- 在 `provider_type=openrouter` 下始终向 `image_config` 显式传递 `aspect_ratio` 与 `image_size`
- `--aspect-ratio` 支持：`1:1`、`2:3`、`3:2`、`3:4`、`4:3`、`4:5`、`5:4`、`9:16`、`16:9`、`21:9`、`1:4`、`4:1`、`1:8`、`8:1`
- `--size` 支持：`0.5K`、`1K`、`2K`、`4K`
- 未传 `--aspect-ratio` 或 `--size` 时，脚本分别使用 `1:1` 和 `1K`，并显式传给 OpenRouter，不依赖远端默认值
- 优先从 `choices[0].message.images[*].image_url.url` 提取结果
- 同时兼容 data URL 与普通图片 URL 返回

请确认所选 OpenRouter 模型支持 image output；返回图片通常是 data URL，不应假设一定是裸 base64。

**OpenRouter Images 推荐配置：**
```json
{
  "provider_type": "openrouter_images",
  "api_key": "your-openrouter-api-key",
  "model_id": "google/gemini-3.1-flash-image"
}
```

该模式调用 `POST https://openrouter.ai/api/v1/images`。用户只需要传递两个图像参数：
- `--aspect-ratio`: `1:1`、`1:4`、`1:8`、`2:3`、`3:2`、`3:4`、`4:1`、`4:3`、`4:5`、`5:4`、`8:1`、`9:16`、`16:9`、`21:9`
- `--size`: `0.5K`、`1K`、`2K`、`4K` 或 `WIDTH*HEIGHT`（例如 `2048*2048`）

`WIDTH*HEIGHT` 会在 `openrouter_images` 中转换为 API 所需的 `WIDTHxHEIGHT`。如果显式尺寸与 `--aspect-ratio` 冲突，脚本会先提示；确认继续后以显式尺寸为准并忽略宽高比。

未传参数时显式使用 `--aspect-ratio 1:1` 和 `--size 1K`，并将这两个值发送给 OpenRouter。

参数与 provider 的处理规则：
- `openrouter`: 只支持 `0.5K/1K/2K/4K`。传入 `WIDTH*HEIGHT` 时会提示；确认继续后忽略该 `--size` 并使用默认 `1K`。
- `openrouter_images`: 支持分辨率档位和 `WIDTH*HEIGHT`；显式尺寸与宽高比冲突时会提示，确认继续后使用显式尺寸。
- `openai_compatible`: 不使用这两个参数。传入后会提示，确认继续才会忽略并发送请求；取消则停止。

与现有 `openrouter` provider 的差异：

| 项目 | `openrouter` | `openrouter_images` |
| --- | --- | --- |
| Endpoint | `/chat/completions` | `/images` |
| 请求协议 | `messages` + `modalities` + `image_config` | `model` + `prompt` 及 Images API 参数 |
| 参考图 | `messages[].content` 中的 `image_url` | `input_references[].image_url` |
| 图片响应 | `choices[0].message.images[].image_url.url` | `data[].b64_json` + `media_type` |
| 参数能力 | `--aspect-ratio` + `--size` 映射到 `image_config` | `--aspect-ratio` + `--size` 映射到 Images API |
| 适用场景 | 兼容 OpenAI chat 风格的图文模型 | OpenRouter 专用图像生成路由和参数探测 |

本次依据 [OpenRouter Images API reference](https://openrouter.ai/docs/api/api-reference/images/generate-an-image) 及模型 endpoint 能力接口测试；用户-facing CLI 仅保留实际需要的 `--aspect-ratio` 与 `--size`。

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

推荐初始化命令：
```bash
cd /path/to/nano-banana
uv sync
```

如果不能切换到 skill 根目录，也可以显式指定项目根：
```bash
uv sync --project /path/to/nano-banana
```

### 使用方法

推荐直接执行：
```bash
uv run --project /path/to/nano-banana python /path/to/nano-banana/scripts/generate_image.py --prompt "描述文字" [--image /path/to/image1.png /path/to/image2.png] [--output output.png] [--size 1K] [--aspect-ratio 16:9]
```

如果当前 shell 已经位于 skill 根目录，也可以简写为：
```bash
uv run python scripts/generate_image.py --prompt "描述文字" [--image /path/to/image1.png /path/to/image2.png] [--output output.png] [--size 1K] [--aspect-ratio 16:9]
```

参数说明：
- `--prompt`: 必填，图像描述
- `--image`: 可选，参考图片路径，支持传入多张（空格分隔），例如 `--image a.png b.png c.png`
- `--output`: 可选，输出文件名（默认 `output.png`）
- `--size`: 可选，`0.5K`、`1K`、`2K`、`4K` 或 `WIDTH*HEIGHT`
- `--aspect-ratio`: 可选，支持上述 14 种宽高比

专用 `openrouter_images` provider 的 CLI 参数只对该 provider 生效；旧 `openrouter` provider 继续使用 `modalities`、`messages` 和 `image_config` 的 chat/completions 协议。

### 示例

**纯文字生成：**
```bash
uv run --project /path/to/nano-banana python /path/to/nano-banana/scripts/generate_image.py --prompt "一只可爱的橘猫在阳光下打盹"
```

**图文生成（单张参考图+描述）：**
```bash
uv run --project /path/to/nano-banana python /path/to/nano-banana/scripts/generate_image.py --prompt "把这只猫变成卡通风格" --image /path/to/cat.png
```

**图文生成（多张参考图+描述）：**
```bash
uv run --project /path/to/nano-banana python /path/to/nano-banana/scripts/generate_image.py --prompt "融合这两张图片的风格，生成新的场景" --image /path/to/img1.png /path/to/img2.png
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
