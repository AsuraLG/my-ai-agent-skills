#!/usr/bin/env node
/**
 * adapters/xhs/transform.js
 *
 * ⚠️  这是一个【xiaohongshu-skills 专用适配器】。
 *     它将 xiaohongshu-skills `get-feed-detail` CLI 的原始输出转换为
 *     travel-guide-maker 的标准中间产物格式。
 *
 *     如果你的素材来自其他来源（手动整理、其他平台等），
 *     请直接按照 SKILL.md「数据规范」章节的格式生成 note-summary.json
 *     和 image-manifest.json，不需要使用本脚本。
 *
 * 输入约定（xiaohongshu-skills 输出格式）：
 *   - note-details/<noteId>.json   每篇笔记的 get-feed-detail 原始输出
 *   - images/<noteId>/             对应已下载的图片（可选）
 *   - raw-search-snapshots/selected-feeds.json  （可选）用于补充 xsecToken
 *
 * 用法：
 *   node transform-xhs.js <dest-dir>
 *   node transform-xhs.js <dest-dir> --dry-run   仅预览，不写入文件
 */

const fs   = require('fs');
const path = require('path');

// ── 辅助函数 ─────────────────────────────────────

/** 解析小红书格式化互动数字（"2.8万" → 28000，"368" → 368） */
function parseCount(val) {
  if (typeof val === 'number') return val;
  const s = String(val || '0').trim();
  if (s.includes('万')) return Math.round(parseFloat(s) * 10000);
  if (s.endsWith('+')) return parseInt(s, 10);
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

/** 拼接小红书笔记链接 */
function buildSourceLink(noteId, xsecToken) {
  if (!noteId) return '';
  const base = `https://www.xiaohongshu.com/explore/${noteId}`;
  return xsecToken ? `${base}?xsec_token=${xsecToken}` : base;
}

/** 从 selected-feeds.json 建立 noteId → xsecToken 的映射表 */
function loadXsecTokenMap(destDir) {
  const selectedPath = path.join(destDir, 'raw-search-snapshots', 'selected-feeds.json');
  if (!fs.existsSync(selectedPath)) return {};

  try {
    const feeds = JSON.parse(fs.readFileSync(selectedPath, 'utf8'));
    const map = {};
    for (const feed of feeds) {
      const id = feed.id || feed.noteId || feed.note_id || '';
      const token = feed.xsecToken || feed.xsec_token || '';
      if (id && token) map[id] = token;
    }
    return map;
  } catch {
    return {};
  }
}

/** 扫描 images/<noteId>/ 目录，返回绝对路径列表 */
function scanImages(destDir, noteId) {
  const imgDir = path.join(destDir, 'images', noteId);
  if (!fs.existsSync(imgDir)) return [];

  return fs.readdirSync(imgDir)
    .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
    .sort()
    .map(f => path.join(imgDir, f));  // 绝对路径
}

/** 处理单篇笔记的原始 JSON → note-summary 条目 */
function buildNoteSummary(raw, xsecTokenMap) {
  // 兼容两种结构：{ note: {...}, comments: [...] } 或直接是 note 对象
  const note     = raw.note || raw;
  const comments = Array.isArray(raw.comments) ? raw.comments : [];

  const noteId  = note.noteId || note.note_id || note.id || '';
  const token   = xsecTokenMap[noteId] || note.xsecToken || note.xsec_token || '';

  // 取高赞评论：按 likeCount 降序，最多 3 条
  const topComments = [...comments]
    .sort((a, b) => parseCount(b.likeCount) - parseCount(a.likeCount))
    .slice(0, 3)
    .map(c => (c.content || '').trim())
    .filter(Boolean);

  // 正文摘要：去除多余空白，截取前 500 字符
  const desc = (note.desc || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 500);

  return {
    feed_id:        noteId,
    title:          (note.title || '').trim() || '无标题笔记',
    author:         (note.user?.nickname || note.user?.nick_name || '').trim() || '未知作者',
    likedCount:     parseCount(note.interactInfo?.likedCount),
    collectedCount: parseCount(note.interactInfo?.collectedCount),
    commentCount:   parseCount(note.interactInfo?.commentCount),
    desc,
    top_comments:   topComments,
    source_link:    buildSourceLink(noteId, token),
  };
}

/** 处理单篇笔记 → image-manifest 条目 */
function buildImageManifest(noteSummary, destDir) {
  const paths = scanImages(destDir, noteSummary.feed_id);
  return {
    feed_id:               noteSummary.feed_id,
    title:                 noteSummary.title,
    image_count_downloaded: paths.length,
    local_image_paths:     paths,
    source_link:           noteSummary.source_link,
  };
}

// ── 主流程 ─────────────────────────────────────────

const [,, rawDestDir, flag] = process.argv;
const dryRun = flag === '--dry-run';

if (!rawDestDir) {
  console.log('用法：');
  console.log('  node transform-xhs.js <dest-dir>           转换并写入文件');
  console.log('  node transform-xhs.js <dest-dir> --dry-run 仅预览，不写入');
  process.exit(0);
}

const destDir     = path.resolve(rawDestDir);
const detailsDir  = path.join(destDir, 'note-details');
const mappingsDir = path.join(destDir, 'mappings');

// 检查 note-details 目录
if (!fs.existsSync(detailsDir)) {
  console.error(`✗ 找不到 note-details 目录：${detailsDir}`);
  console.error('→ 请先对候选笔记调用 get-feed-detail，将输出保存为 note-details/<noteId>.json');
  process.exit(1);
}

const jsonFiles = fs.readdirSync(detailsDir)
  .filter(f => f.endsWith('.json'))
  .sort();

if (!jsonFiles.length) {
  console.error(`✗ note-details/ 目录为空，未找到任何 JSON 文件`);
  process.exit(1);
}

console.log(`找到 ${jsonFiles.length} 个笔记详情文件，开始转换...\n`);

const xsecTokenMap = loadXsecTokenMap(destDir);
const tokenCount   = Object.keys(xsecTokenMap).length;
if (tokenCount > 0) {
  console.log(`✓ 从 selected-feeds.json 加载了 ${tokenCount} 个 xsecToken\n`);
} else {
  console.log('⚠ 未找到 selected-feeds.json，source_link 将不含 xsec_token\n');
}

const summaries  = [];
const manifests  = [];
const errors     = [];

for (const file of jsonFiles) {
  const filePath = path.join(detailsDir, file);
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const summary  = buildNoteSummary(raw, xsecTokenMap);
    const manifest = buildImageManifest(summary, destDir);

    summaries.push(summary);
    manifests.push(manifest);

    console.log(`  ✓ ${summary.feed_id}  ${summary.title.slice(0, 25)}  点赞:${summary.likedCount}  图片:${manifest.image_count_downloaded}张`);
  } catch (e) {
    errors.push({ file, error: e.message });
    console.log(`  ✗ ${file}  ${e.message}`);
  }
}

// 按点赞数降序排列
summaries.sort((a, b) => b.likedCount - a.likedCount);
// manifest 与 summary 顺序保持一致
const feedOrder = summaries.map(s => s.feed_id);
manifests.sort((a, b) => feedOrder.indexOf(a.feed_id) - feedOrder.indexOf(b.feed_id));

console.log('');
console.log(`转换完成：${summaries.length} 成功 / ${errors.length} 失败`);
console.log('');

if (dryRun) {
  console.log('── DRY RUN 预览（未写入文件）──────────────────');
  console.log('\nnote-summary.json 样本（前 2 条）：');
  console.log(JSON.stringify(summaries.slice(0, 2), null, 2));
  console.log('\nimage-manifest.json 样本（前 2 条）：');
  console.log(JSON.stringify(manifests.slice(0, 2), null, 2));
  process.exit(0);
}

// 写入文件
fs.mkdirSync(mappingsDir, { recursive: true });

const summaryPath  = path.join(mappingsDir, 'note-summary.json');
const manifestPath = path.join(mappingsDir, 'image-manifest.json');

fs.writeFileSync(summaryPath,  JSON.stringify(summaries, null, 2)  + '\n', 'utf8');
fs.writeFileSync(manifestPath, JSON.stringify(manifests, null, 2)  + '\n', 'utf8');

console.log(`✓ 写入 note-summary.json    ${summaryPath}`);
console.log(`✓ 写入 image-manifest.json  ${manifestPath}`);
console.log('');

if (errors.length) {
  console.log(`⚠ 以下文件转换失败（已跳过）：`);
  errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
  console.log('');
}

console.log('下一步：');
console.log('  1. 检查 mappings/note-summary.json 内容是否符合预期');
console.log('  2. 编写/填充 markdown/guide.md 攻略正文');
console.log('  3. 准备路线图 route-map/route-map.png');
console.log('  4. 运行构建：NODE_PATH="$(npm root -g)" node docx-assets/build_guide_docx.js');
