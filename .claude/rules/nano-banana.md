---
paths:
  - "nano-banana/**"
---

# nano-banana 开发约束

改这个 skill 的代码时必须遵守。决策背景见 `dev/nano-banana/NOTES.md`。

## 技术约束

- Python 版本下限 `3.9`（见 `pyproject.toml`）。不要用 `dict | None`、`str | None` 这类 3.10+ 类型语法，一律 `Optional[...]` / `Dict[...]` / `List[...]`。
- 依赖用 `uv` 管理。不要依赖 `source .venv/bin/activate`。
- 调用一律走 `uv run --project <skill-root> python <skill-root>/scripts/...`。
- 脚本必须校验自己跑在 skill 根目录的 `.venv` 里，校验不过直接失败，不允许自动 `uv sync` 后重进虚拟环境。

## 代码结构

| 文件 | 职责 |
| --- | --- |
| `scripts/_runtime.py` | 校验当前解释器是 `<skill-root>/.venv` |
| `scripts/generate_image.py` | 通用层：CLI 解析、配置加载、代理构造、图片读取编码、响应落盘、错误处理 |
| `scripts/providers/__init__.py` | provider 分发入口 |
| `scripts/providers/openrouter.py` | OpenRouter 专属适配 |
| `scripts/providers/openai_compatible.py` | OpenAI-compatible 兜底分支 |

## Provider 分层

不要把所有 provider 当成同一种 OpenAI chat completions 协议。

- 通用层只做：参数解析、配置合并、通用输入输出处理、provider dispatch
- provider 层负责：endpoint 选择、payload 构造、response 解析、provider 特有字段处理

新增 provider 或新增某个 provider 的参数支持，一律在对应 provider 文件里实现，不要污染通用层。

`openai_compatible` 是兜底分支，保留历史逻辑（`messages` + `response_format: {"type": "image"}`）。若新 provider 与 openrouter 差异明显，拆新的 adapter，不要往这个分支堆。

## openrouter 行为约定

- endpoint `.../chat/completions`，用 `messages` 发请求
- `modalities` 固定传 `["image", "text"]`
- 输出图片优先从 `choices[0].message.images[*].image_url.url` 提取；返回值可能是 data URL 或普通 URL
- CLI 映射：`--aspect-ratio` → `image_config.aspect_ratio`，`--size` → `image_config.image_size`
- `aspect_ratio` 支持 `1:1` `2:3` `3:2` `3:4` `4:3` `4:5` `5:4` `9:16` `16:9` `21:9` `1:4` `4:1` `1:8` `8:1`，默认 `1:1`
- `image_size` 支持 `0.5K` `1K` `2K` `4K`，默认 `1K`
- 命中默认值可不显式透传给 provider
- 请求前终端打印本次生效的 `image_config`，便于调试

## 配置

优先级：环境变量 > `~/.config/nano-banana/config.json`。

关键配置项：`provider_type`、`base_url`、`api_key`、`model_id`。

`provider_type` 未配置时回退 `openai_compatible`（兼容老用户）。**新文档和新示例必须显式写 `provider_type`**。

## 改动要求

- 改 provider 行为时同步检查并更新 `SKILL.md`，配置项有变则同步 `scripts/config.example.json`
- 不要引入重型抽象，保持「通用层 + provider 适配器」的轻量结构，不为假设需求做类层级
- 改完 Python 代码至少跑静态语法检查：

  ```bash
  uv run python -m py_compile scripts/_runtime.py scripts/generate_image.py scripts/providers/__init__.py scripts/providers/openrouter.py scripts/providers/openai_compatible.py
  ```

- 改了 OpenRouter 参数行为，优先验证：纯文本生图、文本+单图生图、`image_config` 是否按预期打印
- 用户手测通过可不补自动化测试；要补则先保持最小范围
- `SKILL.md` 面向使用者写使用说明，实现约束写本文件，演进背景写 `dev/nano-banana/NOTES.md`
