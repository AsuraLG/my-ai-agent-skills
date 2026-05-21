#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SKILL_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(SKILL_ROOT, 'template');

// ── 来源类型预设 ─────────────────────────────────

const SOURCE_PRESETS = {
  xhs: {
    subtitle: '小红书高赞笔记整理版',
    coverTagline: '适合短途出行的出行参考',
    footerText: '整理自小红书公开高赞笔记',
    sourceLabel: '小红书公开笔记',
    guideDisclaimer: '本攻略基于小红书公开内容整理，请以现场信息为准。',
  },
  manual: {
    subtitle: '旅游攻略整理版',
    coverTagline: '出行参考',
    footerText: '整理自公开资料',
    sourceLabel: '公开资料',
    guideDisclaimer: '本攻略基于公开内容整理，请以现场信息为准。',
  },
  other: {
    subtitle: '旅游攻略整理版',
    coverTagline: '出行参考',
    footerText: '整理自公开资料',
    sourceLabel: '外部来源素材',
    guideDisclaimer: '本攻略基于公开内容整理，请以现场信息为准。',
  },
};

// ── 工具函数 ─────────────────────────────────────

function daysToChinese(n) {
  const map = { 1: '一', 2: '两', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十' };
  if (n <= 10) return map[n] || String(n);
  if (n <= 19) return `十${map[n - 10] || ''}`;
  return String(n);
}

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function clearDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const result = { destinationName: null, dest: null, days: 2, source: 'manual', force: false };
  const args = argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dest' && args[i + 1]) {
      result.dest = args[i + 1];
      i++;
    } else if (args[i] === '--days' && args[i + 1]) {
      result.days = parseInt(args[i + 1], 10);
      if (isNaN(result.days) || result.days < 1 || result.days > 30) {
        console.error(`✗ --days 值无效（需要 1~30 的整数）：${args[i + 1]}`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--source' && args[i + 1]) {
      result.source = args[i + 1];
      if (!SOURCE_PRESETS[result.source]) {
        console.error(`✗ --source 值无效：${result.source}`);
        console.error(`  可选值：${Object.keys(SOURCE_PRESETS).join(', ')}`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--force') {
      result.force = true;
    } else if (!args[i].startsWith('--') && !result.destinationName) {
      result.destinationName = args[i];
    }
  }

  return result;
}

function generateGuideMd(days, sourceType, date) {
  const preset = SOURCE_PRESETS[sourceType];
  const lines = [];

  lines.push(`> 适合人群：xxx。数据来源：${preset.sourceLabel}整理，整理时间 ${date}。`);
  lines.push('');
  lines.push('## 数据来源说明');
  lines.push('');
  lines.push('- 采集时间：');
  if (sourceType === 'xhs') {
    lines.push('- 关键词：');
    lines.push('- 入选笔记：X 篇（筛选标准：点赞 ≥ 500）');
  } else {
    lines.push('- 入选素材：X 条');
  }
  lines.push('');

  for (let d = 1; d <= days; d++) {
    lines.push(`# Day ${d}｜行程标题`);
    lines.push('');
    lines.push('## 上午：景点 / 活动');
    lines.push('');
    lines.push('- 推荐地点：');
    lines.push('- 参考时长：');
    lines.push('- 注意事项：');
    lines.push('');
    lines.push('## 中午：餐饮建议');
    lines.push('');
    lines.push('## 下午：景点 / 活动');
    lines.push('');
  }

  lines.push('# 实用信息');
  lines.push('');
  lines.push('## 交通');
  lines.push('');
  lines.push('- 到达方式：');
  lines.push('- 市内交通：');
  lines.push('');
  lines.push('## 住宿推荐');
  lines.push('');
  lines.push('- 位置建议：');
  lines.push('- 参考价位：');
  lines.push('');
  lines.push('## 费用参考');
  lines.push('');
  lines.push('- 门票：');
  lines.push('- 餐饮：');
  lines.push('- 交通：');
  lines.push('');
  lines.push('# 使用说明');
  lines.push('');
  lines.push(`- ${preset.guideDisclaimer}`);
  lines.push('- 景点开放时间、票价等信息可能变化，建议出发前再次确认。');
  lines.push('');

  return lines.join('\n');
}

// ── 主流程 ─────────────────────────────────────

const opts = parseArgs(process.argv);

if (!opts.destinationName) {
  console.error('用法：node init-guide.js <目的地名称> [--dest dir] [--days N] [--source xhs|manual|other] [--force]');
  process.exit(1);
}

const absDestDir = path.resolve(opts.dest || path.join(process.cwd(), 'travel-guide'));
const workflowStatePath = path.join(absDestDir, 'workflow-state.json');

// ── 目录状态检测 ──────────────────────────────────

let cleared = false;

if (fs.existsSync(absDestDir)) {
  if (fs.existsSync(workflowStatePath) && !opts.force) {
    const state = JSON.parse(fs.readFileSync(workflowStatePath, 'utf8'));
    console.log(JSON.stringify({
      status: 'resumable',
      dest: absDestDir,
      current_phase: state.current_phase,
    }));
    process.exit(0);
  }

  clearDir(absDestDir);
  cleared = true;
  console.error(`⚠ 已清空目录：${absDestDir}`);
}

// ── 执行初始化 ──────────────────────────────────

const preset = SOURCE_PRESETS[opts.source];
const slug = slugify(opts.destinationName) || 'my-destination';
const today = new Date().toISOString().slice(0, 10);
const chineseDays = daysToChinese(opts.days);

console.error(`\n正在初始化旅游攻略项目...`);
console.error(`  目的地：${opts.destinationName}`);
console.error(`  行程天数：${opts.days} 天（${chineseDays}日）`);
console.error(`  素材来源：${opts.source}（${preset.sourceLabel}）`);
console.error(`  目标目录：${absDestDir}\n`);

copyDir(TEMPLATE_DIR, absDestDir);

const configPath = path.join(absDestDir, 'guide.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

config.slug = slug;
config.destinationName = opts.destinationName;
config.days = opts.days;
config.sourceType = opts.source;
config.title = `${opts.destinationName}${chineseDays}日旅游攻略`;
config.subtitle = preset.subtitle;
config.coverTagline = preset.coverTagline;
config.date = today;
config.docx.headerText = `${opts.destinationName}旅游攻略｜整理版`;
config.docx.footerText = preset.footerText;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

const guideMdPath = path.join(absDestDir, 'markdown', 'guide.md');
fs.mkdirSync(path.dirname(guideMdPath), { recursive: true });
fs.writeFileSync(guideMdPath, generateGuideMd(opts.days, opts.source, today), 'utf8');

fs.mkdirSync(path.join(absDestDir, 'note-details'), { recursive: true });
fs.mkdirSync(path.join(absDestDir, 'raw-search-snapshots'), { recursive: true });
fs.mkdirSync(path.join(absDestDir, 'images'), { recursive: true });

console.error('✓ 项目初始化完成');

console.log(JSON.stringify({
  status: 'initialized',
  dest: absDestDir,
  cleared,
  destinationName: opts.destinationName,
  days: opts.days,
  sourceType: opts.source,
}));
