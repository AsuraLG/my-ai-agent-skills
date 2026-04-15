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
