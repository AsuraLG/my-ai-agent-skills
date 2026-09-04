# my-ai-agent-skills

AI Agent 自用 skill 合集。

## 当前收录 skills

| skill名称（目录名） | 主要功能 | 来源 |
| --- | --- | --- |
| `nano-banana` | 基于 Google Nano Banana 系列模型进行图像生成，支持文本生图与参考图生图。 | 本人开发 |
| `yt-dlp-video-downloader` | 基于 yt-dlp 下载 YouTube、Bilibili 等多平台视频，并支持提取音频、字幕、Cookies 登录下载等能力。 | 本人开发 |
| `wechat-article-fetch` | 搜索并抓取微信公众号文章原始内容，提取标题、原始链接、公众号信息与正文文本。 | 网络搜集&本人修改 |
| `travel-guide-maker` | 将旅游笔记原始素材（小红书或手动整理）加工成结构化旅游攻略，输出为带目录、路线图、来源附录的 Word 文档（.docx）。支持与 xiaohongshu-skills 联动实现全流程自动化。 | 本人开发 |
| `hv-analysis` | 横纵分析法深度研究 Skill，自动联网收集信息，纵向追时间深度 + 横向追竞争广度，最终输出排版精美的 PDF 研究报告。 | 网络搜集&本人修改 |
| `disable-mcp-servers-in-project` | 在项目下禁用某些MCP服务器，仅适用于claude code | 本人开发 |
| `kb.example` | 业务知识库 + CodeGraph 协作 skill 的**可复制模板**（非直接可用的功能 skill）：定义本地业务知识库与已配置 CodeGraph 项目索引的协作协议，支持 `kb-only`/`codegraph-only`/`hybrid` 三种模式。复制目录后按文末占位符说明替换为自己的业务信息即可使用。 | 本人开发 |
| `github-tool-research` | 深度调研并对比 GitHub 上的多个工具/开源项目，围绕用户的取舍标准做证据分级调研，产出结论先行、手机友好的 HTML 选型报告，并支持后续迭代更新。 | 本人开发 |
| `mermaid-beautify` | 将普通 Mermaid 图表代码美化为带主题、配色与节点分组样式的版本，输出始终保持合法 Mermaid 语法（不转 SVG/图片）。 | 本人开发 |
| `handoff` | 跨会话、跨 Agent、跨平台的工作交接技能。先把本次会话的结论回填进项目的长期文档，再产出一份「只装指针不装内容」的可粘贴 prompt，避免开新会话或上下文压缩后讨论结果丢失。骨架从真实历史交接产物归纳而来。 | 本人开发 |
| `eli5-visual` | 面向指定受众，将主题、代码、报错或技术文档转化为图文并茂的单文件 HTML 解释内容。 | 本人开发 |

## 致谢

感谢这些 skill 所依赖或受益的开源项目、平台与工具的开发者和维护者。

特别感谢：
- `nano-banana` 相关的图像生成模型接口、兼容协议与 Python 工具链开发者
- `yt-dlp-video-downloader` 背后的 `yt-dlp`、FFmpeg 及相关生态开发者
- `wechat-article-fetch` 所参考思路、相关抓取工具链与测试基础设施的贡献者
- `travel-guide-maker` 所依赖的 `docx`、`pandoc` 及相关文档生成工具链开发者
- `xiaohongshu-skills` 的开发者，`travel-guide-maker` 可与其协作实现从小红书搜索采集到攻略文档输出的全流程自动化，原始地址 [xiaohongshu-skills](https://github.com/autoclaw-cc/xiaohongshu-skills)
- `hv-analysis` 的开发者，原始地址 [khazix-skills](https://github.com/KKKKhazix/khazix-skills)

也感谢所有为这些软件、库、协议和社区持续投入的开发者，让这些 skill 能够被整理、复用并持续演进。
