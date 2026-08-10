# yt-dlp-video-downloader 开发记录

> 本文件建立于 2026-08-10。

## 设计决策

### description 用「应该触发 / 不应触发」的正反例来写

`description` 里列了两组具体例句：应该触发的（「帮我下载这个 YouTube 视频」「把这个视频保存到本地」「extract audio from this」）和不应触发的（「upload video」「edit video」「compress video」「convert video format」「analyze video content」）。

反例这一组是关键——「视频 + 动词」的句式很容易误触发，只给正例挡不住。

### 触发准确率单独建了 eval 集

`evals/` 下有两份：`evals.json` 测执行行为（是否真的调用了 yt-dlp、是否给出成功确认），`trigger_eval_set.json` 测触发判断（每条 query 标注 `should_trigger` 真假 + 理由）。

两件事分开测，因为它们会因不同原因失败：触发不了是 description 的问题，触发了但做错是脚本或 SKILL.md 正文的问题。

## 踩坑记录

<!-- 暂无记录 -->

## 版本变更

- **v1**（2026-03-13，0985187）初版。
