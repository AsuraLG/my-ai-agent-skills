#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');
const Ajv  = require('ajv/dist/2020');

const SKILL_ROOT  = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(SKILL_ROOT, 'schemas');

function loadSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, name), 'utf8'));
}

function schemaErrorToChinese(error, fileName) {
  const loc = error.instancePath || '/';
  switch (error.keyword) {
    case 'required':
      return `${fileName}${loc}: 缺少必填字段 "${error.params.missingProperty}"`;
    case 'type':
      return `${fileName}${loc}: 期望 ${error.params.type}，实际值: ${JSON.stringify(error.data).slice(0, 50)}`;
    case 'maxLength':
      return `${fileName}${loc}: 字符串长度 ${String(error.data).length} 超过最大值 ${error.params.limit}`;
    case 'maxItems':
      return `${fileName}${loc}: 数组长度 ${error.data?.length} 超过最大值 ${error.params.limit}`;
    case 'minimum':
      return `${fileName}${loc}: 值 ${error.data} 小于最小值 ${error.params.limit}`;
    case 'minItems':
      return `${fileName}${loc}: 数组为空，至少需要 ${error.params.limit} 条记录`;
    default:
      return `${fileName}${loc}: ${error.message}`;
  }
}

function validateFeedIdUniqueness(data, fileName) {
  const errors = [];
  const seen = new Set();
  data.forEach((item, index) => {
    const fid = item.feed_id;
    if (fid && seen.has(fid)) {
      errors.push(`${fileName}[${index}]: feed_id "${fid}" 重复`);
    }
    if (fid) seen.add(fid);
  });
  return errors;
}

function validateImagePaths(data) {
  const errors = [];
  data.forEach((item, index) => {
    if (!Array.isArray(item.local_image_paths)) return;
    const count = item.image_count_downloaded;
    const paths = item.local_image_paths;

    if (typeof count === 'number' && paths.length !== count) {
      errors.push(
        `image-manifest.json[${index}].image_count_downloaded: 声明 ${count} 张，实际路径 ${paths.length} 条`
      );
    }
    paths.forEach((p, i) => {
      if (typeof p === 'string' && !path.isAbsolute(p)) {
        errors.push(
          `image-manifest.json[${index}].local_image_paths[${i}]: 必须是绝对路径，实际 "${p}"`
        );
      }
    });
  });
  return errors;
}

function validateCrossReference(summaryData, manifestData) {
  const errors = [];
  const summaryIds = new Set(summaryData.map(s => s.feed_id).filter(Boolean));
  const manifestIds = new Set(manifestData.map(m => m.feed_id).filter(Boolean));

  for (const id of manifestIds) {
    if (!summaryIds.has(id)) {
      errors.push(`image-manifest.json 包含 feed_id "${id}"，但 note-summary.json 中不存在`);
    }
  }
  for (const id of summaryIds) {
    if (!manifestIds.has(id)) {
      errors.push(`note-summary.json 包含 feed_id "${id}"，但 image-manifest.json 中缺失（可能导致图片附录不完整）`);
    }
  }
  return errors;
}

// ── 主流程 ────────────────────────────────────────

const [,, rawDestDir] = process.argv;

if (!rawDestDir) {
  console.error('用法：node validate.js <dest-dir>');
  process.exit(2);
}

const destDir      = path.resolve(rawDestDir);
const mappingsDir  = path.join(destDir, 'mappings');
const summaryPath  = path.join(mappingsDir, 'note-summary.json');
const manifestPath = path.join(mappingsDir, 'image-manifest.json');

const ajv = new Ajv({ allErrors: true, verbose: true });
const summarySchema  = loadSchema('note-summary.schema.json');
const manifestSchema = loadSchema('image-manifest.schema.json');

const allErrors = [];
let summaryData  = null;
let manifestData = null;
let hasMissingFile = false;

if (!fs.existsSync(summaryPath)) {
  allErrors.push(`文件不存在: ${summaryPath}`);
  hasMissingFile = true;
} else {
  try {
    summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const valid = ajv.validate(summarySchema, summaryData);
    if (!valid) {
      allErrors.push(
        ...ajv.errors.map(e => schemaErrorToChinese(e, 'note-summary.json'))
      );
    }
    if (Array.isArray(summaryData)) {
      allErrors.push(...validateFeedIdUniqueness(summaryData, 'note-summary.json'));
    }
  } catch (e) {
    allErrors.push(`note-summary.json 解析失败: ${e.message}`);
  }
}

if (!fs.existsSync(manifestPath)) {
  allErrors.push(`文件不存在: ${manifestPath}`);
  hasMissingFile = true;
} else {
  try {
    manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const valid = ajv.validate(manifestSchema, manifestData);
    if (!valid) {
      allErrors.push(
        ...ajv.errors.map(e => schemaErrorToChinese(e, 'image-manifest.json'))
      );
    }
    if (Array.isArray(manifestData)) {
      allErrors.push(...validateFeedIdUniqueness(manifestData, 'image-manifest.json'));
      allErrors.push(...validateImagePaths(manifestData));
    }
  } catch (e) {
    allErrors.push(`image-manifest.json 解析失败: ${e.message}`);
  }
}

if (Array.isArray(summaryData) && Array.isArray(manifestData)) {
  allErrors.push(...validateCrossReference(summaryData, manifestData));
}

const result = {
  valid: allErrors.length === 0,
  summary_count: Array.isArray(summaryData) ? summaryData.length : 0,
  manifest_count: Array.isArray(manifestData) ? manifestData.length : 0,
  error_count: allErrors.length,
  errors: allErrors,
};

console.log(JSON.stringify(result, null, 2));

if (hasMissingFile && allErrors.length > 0) {
  process.exit(2);
} else if (allErrors.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
