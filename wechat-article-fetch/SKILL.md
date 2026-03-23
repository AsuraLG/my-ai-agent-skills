---
name: wechat-article-fetch
description: Use when the user wants to search, locate, or extract content from WeChat public account articles, including requests like 搜微信文章、获取公众号内容、微信搜索、查公众号文章正文.
---

# WeChat Article Fetch

## Overview
Use this skill when the user wants微信公众号文章原始内容，而不是普通网页摘要。这个 skill 会通过搜狗微信搜索获取第一页文章结果，解析真实 `mp.weixin.qq.com` 链接，并抓取文章完整正文文本和基础元信息。

## When to Use
- 用户明确要搜微信公众号文章
- 用户要某个主题下的公众号文章原文
- 用户要文章标题、原始链接、正文内容

Do not use this skill for:
- 普通网页搜索
- 不限定微信公众号来源的信息检索
- 需要登录公众号后台的管理操作

## Workflow
1. 提取用户搜索关键词。
2. 运行脚本：`python scripts/fetch.py --keyword "<关键词>" --limit <数量>`。
3. 读取 JSON 结果。
4. 默认回复用户：
   - 抓取到的全部文章标题
   - 每篇文章的原始微信链接
   - 如有需要可补充说明公众号名、发布时间、作者
5. 只有当用户明确要求“摘要 / 总结 / 提炼”时，再基于抓取到的正文生成摘要。
6. 只有当用户明确要求正文内容时，再直接展开正文文本。

## Commands

```bash
python scripts/fetch.py --keyword "人工智能"
python scripts/fetch.py --keyword "美团 技术" --limit 5
```

## Parameters
- `--keyword`: 必填，搜索关键词
- `--limit`: 可选，最大返回条数；默认 10，最大 10

## Environment Variables
- `WECHAT_ARTICLE_FETCH_PROXY`: 可选代理地址。未设置时默认直连；设置后会同时作为 HTTP/HTTPS 代理使用。

## Output Contract
脚本返回 JSON：

```json
{
  "keyword": "人工智能",
  "count": 2,
  "articles": [
    {
      "title": "...",
      "url": "https://mp.weixin.qq.com/...",
      "account_name": "示例公众号",
      "publish_time": "2024-03-10 00:00:00",
      "author": "示例作者",
      "content": "完整正文纯文本"
    }
  ]
}
```

其中：
- `title`: 文章标题
- `url`: 原始微信公众号文章链接
- `account_name`: 公众号名称
- `publish_time`: 发布时间；如果能解析 Unix 时间戳，会格式化为 `YYYY-MM-DD HH:MM:SS`
- `author`: 文章作者
- `content`: 提取后的正文纯文本

## Failure Handling
- 如果搜索页没有解析出可用文章，明确告知未抓取到结果，并建议调整关键词。
- 如果跳转链接解析失败，跳过该条结果，继续抓取其他文章。
- 如果某篇文章正文提取失败，仍返回标题和链接，`content` 为空字符串。
- 如果脚本执行失败，直接报告失败原因，不要编造抓取结果。

## Response Style
- 默认不主动贴出所有正文，避免回复过长。
- 默认输出标题 + 原始链接。
- 用户要求摘要时，再输出摘要。
- 用户要求正文时，再输出正文。
