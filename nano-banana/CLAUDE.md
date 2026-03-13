# CLAUDE.md

## 项目概述
- 这是一个 Claude Code skill 项目，用于调用图像生成 provider 生成图片。
- 当前核心脚本是 `scripts/generate_image.py`。
- 当前重点适配 provider：`openrouter`。
- 同时保留 `openai_compatible` 作为兼容兜底分支。

## 技术约束
- Python 版本下限：`3.9`，见 `pyproject.toml`。
- 因此代码必须兼容 Python 3.9：
  - 不要使用 `dict | None`、`str | None` 这类 Python 3.10+ 类型语法。
  - 优先使用 `Optional[...]`、`Dict[...]`、`List[...]`。
- 依赖管理使用 `uv`。
- 运行脚本时使用 `python`，不要假设有 `python3.10+`。

## 当前代码结构
- `scripts/generate_image.py`
  - 通用流程层。
  - 负责 CLI 参数解析、配置加载、代理构造、图片读取与编码、响应落盘、错误处理。
- `scripts/providers/__init__.py`
  - provider 分发入口。
- `scripts/providers/openrouter.py`
  - OpenRouter 专属请求/响应适配。
- `scripts/providers/openai_compatible.py`
  - OpenAI-compatible 兼容分支。
- `scripts/config.example.json`
  - 示例配置。
- `SKILL.md`
  - 用户文档，改动行为时必须同步更新。

## Provider 设计原则
- 不要再把所有 provider 都当成同一种 OpenAI chat completions 协议。
- 新增 provider 时，优先放到 `scripts/providers/` 下做 provider-specific 适配。
- 通用层只做：
  - 参数解析
  - 配置合并
  - 通用输入输出处理
  - provider dispatch
- provider 层负责：
  - endpoint 选择
  - payload 构造
  - response 解析
  - provider 特有字段处理

## 当前 provider 行为约定
### openrouter
- endpoint: `.../chat/completions`
- 使用 `messages` 发送请求。
- 支持纯文本生图，也支持“文本 + 单张参考图”。
- `modalities` 固定传 `[
  "image",
  "text"
]`。
- 输出图片优先从 `choices[0].message.images[*].image_url.url` 提取。
- 返回值可能是：
  - data URL
  - 普通 URL
- 当前支持的 OpenRouter 图像参数：
  - `aspect_ratio`
  - `image_size`
- CLI 参数映射：
  - `--aspect-ratio` -> `image_config.aspect_ratio`
  - `--size` -> `image_config.image_size`
- 当前支持的 `aspect_ratio`：
  - `1:1` `2:3` `3:2` `3:4` `4:3` `4:5` `5:4` `9:16` `16:9` `21:9` `1:4` `4:1` `1:8` `8:1`
- 当前支持的 `image_size`：
  - `0.5K` `1K` `2K` `4K`
- 默认值：
  - `aspect_ratio=1:1`
  - `image_size=1K`
- 若命中默认值，可不显式透传给 provider。
- OpenRouter 请求前，终端会打印本次实际生效的 `image_config`，便于调试。

### openai_compatible
- 这是兜底兼容分支。
- 当前保留历史逻辑：
  - `messages`
  - `response_format: {"type": "image"}`
- 如果后续某个 provider 与 openrouter 差异明显，不要继续堆到这个分支里，应该拆新的 provider adapter。

## 配置约定
- 配置优先级：
  1. 环境变量
  2. `~/.config/nano-banana/config.json`
- 当前关键配置：
  - `provider_type`
  - `base_url`
  - `api_key`
  - `model_id`
- `provider_type` 当前支持：
  - `openrouter`
  - `openai_compatible`
- 为了兼容老用户，未配置 `provider_type` 时默认回退到 `openai_compatible`。
- 新文档和新示例必须显式写 `provider_type`。

## 修改代码时的要求
- 修改 provider 行为时，必须同时检查并更新：
  - `SKILL.md`
  - `scripts/config.example.json`（如果配置项有变化）
- 不要随意引入重型抽象；优先保持“通用层 + provider 适配器”的轻量结构。
- 不要为了未来假设需求过度设计类层级。
- 如果只是新增某个 provider 的参数支持，优先在对应 provider 文件中实现，而不是污染通用层。

## 测试与验证
- 每次改完 Python 代码，至少做静态语法检查：
  ```bash
  python -m py_compile scripts/generate_image.py scripts/providers/__init__.py scripts/providers/openrouter.py scripts/providers/openai_compatible.py
  ```
- 如果改了 JSON 示例，校验 JSON 合法性。
- 如果改了 OpenRouter 参数行为，优先验证：
  - 纯文本生图
  - 文本 + 单图生图
  - `image_config` 是否按预期打印
- 若用户自己手测通过，可不主动补自动化测试；如要补测试，先保持最小范围。

## 文档维护要求
- `SKILL.md` 需要面向使用者，写法偏使用说明。
- `CLAUDE.md` 记录实现约束、架构约定、演进背景。
- 当 provider 行为与文档不一致时，先修行为或修文档，不能让两者长期漂移。

## 后续可演进方向
- 增加更多 provider adapter。
- 为 provider payload/response 增加轻量测试。
- 如确有需求，再支持多参考图。
- 如确有需求，再把更多 OpenRouter 专属参数通过 CLI 暴露出来。
