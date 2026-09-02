# nano-banana 开发记录

> 本文件建立于 2026-08-10，早于此的内容从 git 提交信息与原 `nano-banana/CLAUDE.md`（已删除）反推，已标注出处。
> 当前必须遵守的实现约束迁到了 `.claude/rules/nano-banana.md`，改该 skill 文件时自动加载。

## 设计决策

### provider 分层：通用层不假设 OpenAI 协议（见 nano-banana/CLAUDE.md）

早期把所有 provider 都当成同一种 OpenAI chat completions 协议，这个假设站不住。改为两层：

| 层 | 职责 |
| --- | --- |
| 通用层 `scripts/generate_image.py` | 参数解析、配置合并、通用输入输出处理、provider dispatch |
| provider 层 `scripts/providers/*` | endpoint 选择、payload 构造、response 解析、provider 特有字段处理 |

新增 provider 时一律在 `scripts/providers/` 下做 provider-specific 适配，不往通用层塞条件分支。

当前主适配 `openrouter`，保留 `openai_compatible` 作为兼容兜底。

### Python 版本下限锁 3.9（见 nano-banana/CLAUDE.md）

`pyproject.toml` 声明 `>=3.9`，因此代码不能用 `dict | None`、`str | None` 这类 3.10+ 类型语法，一律用 `Optional[...]` / `Dict[...]` / `List[...]`。

### 独立 .venv + 运行时自检，不允许自动 uv sync 重进（4840864，2026-04-15）

依赖用 `uv` 管理，每个 skill 一个独立 `.venv`。调用方式统一为 `uv run --project <skill-root> python <skill-root>/scripts/...`，不依赖 `source .venv/bin/activate`。

`scripts/_runtime.py` 负责校验当前解释器确实是 `<skill-root>/.venv`，校验不过直接失败，不自动 `uv sync` 后重进虚拟环境。理由是静默修复环境会掩盖配置问题，让人以为跑对了。

### 多参考图支持保持向后兼容（61deec8，2026-03-24）

`--image` 从单值改为 `nargs='+'`，`build_image_input` → `build_image_inputs`（返回 `List[Dict]`），通用层 `build_provider_request` 签名统一为 `image_inputs: List[Dict[str, str]]`，两个 provider adapter 都改为循环追加多图到 `content[]`。单张图片的使用方式不变。

### provider_type 未配置时回退 openai_compatible

回退目标是兜底分支而不是当前主力 `openrouter`，理由是兼容老用户——他们的配置文件里没有 `provider_type`，行为不应因为新增主力 provider 而改变。

代价是新用户容易踩到「没显式写 provider_type，结果走了兜底分支」。因此约定新文档和新示例必须显式写 `provider_type`。

## 踩坑记录

- OpenRouter 专用 `/images` API 的模型能力不能只看统一文档枚举；`/api/v1/images/models/{model}/endpoints` 才是 endpoint 级权威清单。2026-09-01 读取到：Flash 支持 `resolution`（`512/1K/2K/4K`）、14 个宽高比、`n=1`、最多 14 张参考图；Pro 支持 `resolution`（`1K/2K/4K`）、10 个宽高比、`n=1`、最多 14 张参考图；两者均不支持流式，passthrough 仅列出 `cachedContent`。
- 使用配置 key 和 HTTP 代理完成了 Flash 的首轮 28 条、第二轮 29 条真实成功请求（累计约 `$4.055959`）。`size` 会改变实际 PNG 尺寸；`resolution` 四档、14 个 accepted aspect ratio、HTTP/data URL 参考图、provider sort/allow_fallbacks/order/ignore/options 等均有成功响应证据。`background`、`output_format`、`quality`、`output_compression`、`seed`、`stream` 虽被网关接受，但返回始终为 PNG，不能认定为模型生效。
- 首轮后 key 日限额曾归零（`403 Key limit exceeded`）；临时提高 key 上限后余额又耗尽（`402 Insufficient credits`）。充值后已补齐剩余矩阵，最终不再有额度阻断。
- 在额度归零后追加验证了两个模型全部“文档通用枚举但模型未声明”的宽高比（Flash 8 个、Pro 12 个），均返回 400，并回显模型实际 accepted 列表；这些请求未生成图片。
- OpenRouter 的 `/images` 响应是 `data[*].b64_json`/`media_type`，与 chat/completions 的 `choices[0].message.images[*].image_url.url` 不同，必须使用独立 provider adapter；SSE 解析应优先 `image_generation.completed`，没有完成事件时才回退 partial。
- 真实矩阵显示 Gemini 的 `stream=true` 会被忽略并返回 `application/json`；不能仅按请求参数选择 SSE，必须检查响应 `Content-Type`，否则会误报解析失败。
- 最终补测 60 项：Flash 6 项中 4 项成功、2 项组合冲突 400；Pro 54 项中 52 项成功、2 项组合冲突 400，另有 Pro 基线成功 1 项。成功请求均返回单张 PNG；一致的 resolution/size 组合成功，显式像素尺寸与 aspect 或 resolution/size 不一致时返回 400。
- 新 agent 在安装目录完成 5 条实际 CLI 验收：Flash/Pro 基线、两模型 `resolution+aspect_ratio`、参考图加全参数组合均退出码 0 且输出非空；组合请求的 `--output-format jpeg` 实际仍得到 PNG，确认该目标模型忽略输出格式字段。至此本次请求列出的参数与选项均有真实 API 结果或明确 400/404 结论。
- 追加的 `provider.options[provider_slug].cachedContent` targeted 请求在 Flash/Pro 上均到达 Google provider 并返回 `Gemini could not generate an image (STOP)` 400；证明 passthrough 路径生效，但无效缓存值本身不能作为可用参数示例。
- Endpoint 级能力存在 provider 差异：Flash 的 Vertex/AI Studio 都支持 `512/1K/2K/4K`；Pro 的 Vertex 仅支持 `1K/2K`，AI Studio 支持 `1K/2K/4K`。未指定 provider 的 Pro `4K` 实测路由到 Vertex 时返回 400；强制 AI Studio 的 `4K` 在当前账户因隐私/数据策略返回 404，因此不能宣称该账户当前可用。
- 参考图数量边界已补测：Flash/Pro 各传 14 张合法 data URL 均返回 200、单张 PNG；此前 0 张（基线）和 1 张 data/HTTP URL 也均成功。两模型当前 endpoint 的 `input_references` 实测范围因此覆盖 0、1、14。

## 后续可演进方向

- 增加更多 provider adapter
- 为 provider payload/response 增加轻量测试
- 保持用户 CLI 只暴露已验证且实际生效的图像参数

## 版本变更

- **v6**（2026-09-02）：移除 `provider-json` 和所有不会对 Gemini 实际生效的复杂 CLI 参数；用户入口只保留 `--aspect-ratio` 与 `--size`，增加按 provider 的忽略/冲突确认逻辑，并让 `openrouter_images` 缺省时显式发送 `1:1`/`1K`。

- **v5**（2026-09-01）：补充 Pro 各 provider 的 resolution 差异和账户 guardrail 对 AI Studio `4K` 的影响。

- **v4**（2026-09-01）：补齐 Flash/Pro 专用 `/images` 参数矩阵和组合关系的真实验证；更新 `stream` 的 JSON/SSE 判断、provider 对比和测试结论。

- **v3**（2026-09-01）：内置 OpenRouter API 根地址；新增 `openrouter_images` provider，对接专用 `/images` API，支持专用请求字段、参考图和 JSON/SSE 图片响应；补充模型能力与 chat provider 的差异说明。

- **v2**（2026-09-01）：OpenRouter 请求始终显式发送 `aspect_ratio` 与 `image_size`；用户未指定时填充 `1:1` 与 `1K`，不再依赖远端默认值。
- **v1**（2026-03-13，611a56b 初版；后续 61deec8 加多图、4840864 改环境管理方式，均未单独递增版本号——早于 2026-08-10 的版本规范，不回溯）
