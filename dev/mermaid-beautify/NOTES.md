# mermaid-beautify 开发记录

> 本文件建立于 2026-08-10。

## 设计决策

### 输出必须保持合法 Mermaid 语法，不转 SVG 或图片

这条边界写进了 `description`（"while keeping the output as valid Mermaid syntax (not SVG or images)"）。

美化图表最容易滑向「渲染成图片」，但那样产物就不可再编辑、不能嵌进 Markdown 继续版本管理。这个 skill 刻意只做主题、配色、节点分组样式，产物仍是文本。

### description 同时收中英文触发语

列了「让这个图好看一点」「美化这个 mermaid」「给图加上主题」和 "beautify mermaid"、"style this diagram" 两套。

## 踩坑记录

<!-- 暂无记录 -->

## 版本变更

- **v1**（2026-07-25，3c145fc）初版。
