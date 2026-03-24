#!/usr/bin/env node
/**
 * init-guide.js
 * 从 skill 内置模板初始化一个新的目的地攻略项目目录。
 *
 * 用法：
 *   node init-guide.js <destination-dir> [destinationName]
 *
 * 示例：
 *   node init-guide.js ~/Documents/ningbo-guide 宁波
 */

const fs = require('fs');
const path = require('path');

const SKILL_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(SKILL_ROOT, 'template');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

const destDir = process.argv[2];
const destinationName = process.argv[3] || '目的地名称';

if (!destDir) {
  console.error('用法：node init-guide.js <destination-dir> [destinationName]');
  process.exit(1);
}

const absDestDir = path.resolve(destDir);

if (fs.existsSync(absDestDir)) {
  console.error(`✗ 目标目录已存在：${absDestDir}`);
  console.error('→ 请指定一个不存在的目录，或先手动删除它');
  process.exit(1);
}

console.log(`\n正在初始化旅游攻略项目...`);
console.log(`  模板来源：${TEMPLATE_DIR}`);
console.log(`  目标目录：${absDestDir}`);
console.log(`  目的地：${destinationName}\n`);

// 复制模板
copyDir(TEMPLATE_DIR, absDestDir);

// 更新 guide.config.json
const configPath = path.join(absDestDir, 'guide.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const slug = slugify(destinationName) || 'my-destination';
const today = new Date().toISOString().slice(0, 10);

config.slug = slug;
config.destinationName = destinationName;
config.title = `${destinationName}两日旅游攻略`;
config.subtitle = '小红书高赞笔记整理版';
config.date = today;
config.docx.headerText = `${destinationName}旅游攻略｜整理版`;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

// 更新 markdown/guide.md（替换占位符日期）
const guideMdPath = path.join(absDestDir, 'markdown', 'guide.md');
let guideMd = fs.readFileSync(guideMdPath, 'utf8');
guideMd = guideMd.replace('YYYY-MM-DD', today);
fs.writeFileSync(guideMdPath, guideMd, 'utf8');

console.log('✓ 项目初始化完成');
console.log('');
console.log('目录结构：');
console.log(`  ${absDestDir}/`);
console.log('  ├── guide.config.json         ← 已预填目的地信息，可继续编辑');
console.log('  ├── markdown/guide.md         ← 攻略正文模板，待填充内容');
console.log('  ├── mappings/                 ← 待生成 note-summary.json / image-manifest.json');
console.log('  ├── route-map/                ← 待放入路线图 PNG');
console.log('  └── docx-assets/             ← 构建脚本已就绪');
console.log('');
console.log('下一步：');
console.log(`  1. 将路线图放入 ${path.join(absDestDir, 'route-map', 'route-map.png')}`);
console.log('  2. 填充 mappings/note-summary.json 和 mappings/image-manifest.json');
console.log('  3. 编写 markdown/guide.md 攻略正文');
console.log('  4. 运行构建：');
console.log(`     cd ${absDestDir}`);
console.log('     NODE_PATH="$(npm root -g)" node docx-assets/build_guide_docx.js');
