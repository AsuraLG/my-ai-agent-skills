#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveFromRoot(rootDir, maybeRelativePath) {
  return path.isAbsolute(maybeRelativePath)
    ? maybeRelativePath
    : path.join(rootDir, maybeRelativePath);
}

function loadGuideConfig(configPath) {
  const absoluteConfigPath = path.resolve(configPath);
  const rootDir = path.dirname(absoluteConfigPath);
  const config = readJson(absoluteConfigPath);

  return {
    rootDir,
    title: config.title,
    subtitle: config.subtitle,
    date: config.date,
    markdownPath: resolveFromRoot(rootDir, config.markdownPath),
    routeMapPath: resolveFromRoot(rootDir, config.routeMapPath),
    noteSummaryPath: resolveFromRoot(rootDir, config.noteSummaryPath),
    imageManifestPath: resolveFromRoot(rootDir, config.imageManifestPath),
    outputDocxPath: resolveFromRoot(rootDir, config.outputDocxPath),
  };
}

function buildAppendix(notes, manifest) {
  const sourceLines = notes.map((note, index) => {
    const title = note.title && note.title.trim() ? note.title.trim() : '无标题笔记';
    const author = note.author && note.author.trim() ? note.author.trim() : '未知作者';
    const stats = `点赞：${note.likedCount || '-'}｜收藏：${note.collectedCount || '-'}｜评论：${note.commentCount || '-'}`;
    const excerptRaw = (note.desc || '').replace(/\s+/g, ' ').trim();
    const excerpt = excerptRaw ? excerptRaw.slice(0, 140) + (excerptRaw.length > 140 ? '…' : '') : '无摘要';
    return [
      `### ${index + 1}. ${title}`,
      `- 作者：${author}`,
      `- ${stats}`,
      `- 摘要：${excerpt}`,
      `- 来源：${note.source_link || ''}`,
      '',
    ].join('\n');
  }).join('\n');

  const imageLines = manifest.map((item, index) => {
    const title = item.title && item.title.trim() ? item.title.trim() : '无标题笔记';
    const count = item.image_count_downloaded ?? 0;
    const sample = (item.local_image_paths || []).slice(0, 3).map((itemPath) => path.basename(itemPath)).join('、');
    return [
      `### ${index + 1}. ${title}`,
      `- feed_id：${item.feed_id}`,
      `- 下载图片数：${count}`,
      `- 来源：${item.source_link || ''}`,
      `- 本地文件示例：${sample || '无'}`,
      '',
    ].join('\n');
  }).join('\n');

  return [
    '',
    '',
    '# 附录｜来源摘要',
    '',
    sourceLines,
    '',
    '# 附录｜图片映射摘要',
    '',
    imageLines,
    '',
  ].join('\n');
}

const configPath = process.argv[2] || path.join(process.cwd(), 'guide.config.json');
const guide = loadGuideConfig(configPath);
const notes = readJson(guide.noteSummaryPath);
const manifest = readJson(guide.imageManifestPath);
const mainMd = fs.readFileSync(guide.markdownPath, 'utf8');
const appendix = buildAppendix(notes, manifest);
const outputDir = path.dirname(guide.outputDocxPath);
const appendixMd = path.join(outputDir, 'appendix.md');
const combinedMd = path.join(outputDir, 'combined.md');
const pandoc = '/opt/homebrew/bin/pandoc';

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(appendixMd, appendix, 'utf8');

const combined = [
  '---',
  `title: "${guide.title}"`,
  `subtitle: "${guide.subtitle}"`,
  `date: "${guide.date}"`,
  'lang: "zh-CN"',
  'toc: true',
  'toc-depth: 3',
  'geometry: margin=1in',
  'fontsize: 11pt',
  'mainfont: "PingFang SC"',
  '---',
  '',
  mainMd,
  '',
  '## 示意路线图',
  '',
  `![示意路线图](${guide.routeMapPath})`,
  '',
  '> 注：路线图为示意路线，游玩前请以现场交通与景区信息为准。',
  '',
  appendix,
].join('\n');

fs.writeFileSync(combinedMd, combined, 'utf8');
execFileSync(pandoc, [combinedMd, '-o', guide.outputDocxPath, '--from', 'markdown+yaml_metadata_block', '--toc'], { stdio: 'inherit' });
console.log(guide.outputDocxPath);
