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

<!-- 暂无记录 -->

## 后续可演进方向

- 增加更多 provider adapter
- 为 provider payload/response 增加轻量测试
- 如确有需求，再把更多 OpenRouter 专属参数通过 CLI 暴露

## 版本变更

- **v2**（2026-09-01）：OpenRouter 请求始终显式发送 `aspect_ratio` 与 `image_size`；用户未指定时填充 `1:1` 与 `1K`，不再依赖远端默认值。
- **v1**（2026-03-13，611a56b 初版；后续 61deec8 加多图、4840864 改环境管理方式，均未单独递增版本号——早于 2026-08-10 的版本规范，不回溯）
