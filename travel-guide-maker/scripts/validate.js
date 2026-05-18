#!/usr/bin/env node
/**
 * validate.js — 数据契约强校验脚本
 *
 * 对 mappings/note-summary.json 和 mappings/image-manifest.json
 * 进行 schema 级别的严格校验，确保数据符合 data-spec.md 定义的契约。
 *
 * 用法：
 *   node validate.js <dest-dir>
 *
 * 退出码：
 *   0 — 全部通过
 *   1 — 存在校验错误
 *   2 — 文件缺失或无法解析
 */

const fs   = require('fs');
const path = require('path');

// ── Schema 定义 ───────────────────────────────────

const NOTE_SUMMARY_SCHEMA = {
  feed_id:        { type: 'string',  required: true },
  title:          { type: 'string',  required: true },
  author:         { type: 'string',  required: true },
  likedCount:     { type: 'number',  required: true, integer: true },
  collectedCount: { type: 'number',  required: true, integer: true },
  commentCount:   { type: 'number',  required: true, integer: true },
  desc:           { type: 'string',  required: true, maxLength: 500 },
  top_comments:   { type: 'array',   required: true, itemType: 'string', maxItems: 3 },
  source_link:    { type: 'string',  required: true },
};

const IMAGE_MANIFEST_SCHEMA = {
  feed_id:                { type: 'string',  required: true },
  title:                  { type: 'string',  required: true },
  image_count_downloaded: { type: 'number',  required: true, integer: true, min: 0 },
  local_image_paths:      { type: 'array',   required: true, itemType: 'string' },
  source_link:            { type: 'string',  required: true },
};

// ── 校验函数 ──────────────────────────────────────

function validateField(obj, fieldName, rule, itemIndex) {
  const errors = [];
  const prefix = `[${itemIndex}].${fieldName}`;
  const value = obj[fieldName];

  if (rule.required && (value === undefined || value === null)) {
    errors.push(`${prefix}: 缺少必填字段`);
    return errors;
  }

  if (value === undefined || value === null) return errors;

  // 类型校验
  if (rule.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${prefix}: 期望 array，实际 ${typeof value}`);
      return errors;
    }
    if (rule.maxItems !== undefined && value.length > rule.maxItems) {
      errors.push(`${prefix}: 数组长度 ${value.length} 超过最大值 ${rule.maxItems}`);
    }
    if (rule.itemType) {
      value.forEach((item, i) => {
        if (typeof item !== rule.itemType) {
          errors.push(`${prefix}[${i}]: 期望 ${rule.itemType}，实际 ${typeof item}`);
        }
      });
    }
  } else if (typeof value !== rule.type) {
    errors.push(`${prefix}: 期望 ${rule.type}，实际 ${typeof value}（值: ${JSON.stringify(value).slice(0, 50)}）`);
    return errors;
  }

  // 整数校验
  if (rule.integer && typeof value === 'number' && !Number.isInteger(value)) {
    errors.push(`${prefix}: 期望整数，实际 ${value}`);
  }

  // 字符串类型的数字检测（常见错误："2.8万" 未转换）
  if (rule.type === 'number' && typeof value === 'string') {
    errors.push(`${prefix}: 值为字符串 "${value}"，需要转换为整数`);
  }

  // 最大长度
  if (rule.maxLength !== undefined && typeof value === 'string' && value.length > rule.maxLength) {
    errors.push(`${prefix}: 字符串长度 ${value.length} 超过最大值 ${rule.maxLength}`);
  }

  // 最小值
  if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
    errors.push(`${prefix}: 值 ${value} 小于最小值 ${rule.min}`);
  }

  return errors;
}

function validateArray(data, schema, fileName) {
  const errors = [];

  if (!Array.isArray(data)) {
    errors.push(`${fileName}: 顶层结构必须是数组，实际 ${typeof data}`);
    return errors;
  }

  if (data.length === 0) {
    errors.push(`${fileName}: 数组为空，至少需要 1 条记录`);
    return errors;
  }

  // feed_id 唯一性检查
  const feedIds = new Set();
  const duplicates = [];

  data.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      errors.push(`${fileName}[${index}]: 期望对象，实际 ${typeof item}`);
      return;
    }

    // 逐字段校验
    for (const [fieldName, rule] of Object.entries(schema)) {
      errors.push(...validateField(item, fieldName, rule, index));
    }

    // feed_id 唯一性
    const fid = item.feed_id;
    if (fid) {
      if (feedIds.has(fid)) {
        duplicates.push({ index, feed_id: fid });
      }
      feedIds.add(fid);
    }
  });

  if (duplicates.length > 0) {
    for (const d of duplicates) {
      errors.push(`${fileName}[${d.index}]: feed_id "${d.feed_id}" 重复`);
    }
  }

  return errors;
}

function validateImagePaths(data) {
  const errors = [];
  data.forEach((item, index) => {
    if (!Array.isArray(item.local_image_paths)) return;

    const count = item.image_count_downloaded;
    const paths = item.local_image_paths;

    // image_count_downloaded 与实际路径数量一致
    if (typeof count === 'number' && paths.length !== count) {
      errors.push(`[${index}].image_count_downloaded: 声明 ${count} 张，实际路径 ${paths.length} 条`);
    }

    // 绝对路径检查
    paths.forEach((p, i) => {
      if (typeof p === 'string' && !path.isAbsolute(p)) {
        errors.push(`[${index}].local_image_paths[${i}]: 必须是绝对路径，实际 "${p}"`);
      }
    });
  });
  return errors;
}

function validateCrossReference(summaryData, manifestData) {
  const errors = [];

  const summaryIds = new Set(summaryData.map(s => s.feed_id).filter(Boolean));
  const manifestIds = new Set(manifestData.map(m => m.feed_id).filter(Boolean));

  // manifest 中的 feed_id 必须都在 summary 中
  for (const id of manifestIds) {
    if (!summaryIds.has(id)) {
      errors.push(`image-manifest.json 包含 feed_id "${id}"，但 note-summary.json 中不存在`);
    }
  }

  // summary 中的 feed_id 最好都在 manifest 中（警告级别）
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

const destDir     = path.resolve(rawDestDir);
const mappingsDir = path.join(destDir, 'mappings');
const summaryPath  = path.join(mappingsDir, 'note-summary.json');
const manifestPath = path.join(mappingsDir, 'image-manifest.json');

const allErrors = [];
let summaryData = null;
let manifestData = null;

// 校验 note-summary.json
if (!fs.existsSync(summaryPath)) {
  allErrors.push(`文件不存在: ${summaryPath}`);
} else {
  try {
    summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    allErrors.push(...validateArray(summaryData, NOTE_SUMMARY_SCHEMA, 'note-summary.json'));
  } catch (e) {
    allErrors.push(`note-summary.json 解析失败: ${e.message}`);
  }
}

// 校验 image-manifest.json
if (!fs.existsSync(manifestPath)) {
  allErrors.push(`文件不存在: ${manifestPath}`);
} else {
  try {
    manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    allErrors.push(...validateArray(manifestData, IMAGE_MANIFEST_SCHEMA, 'image-manifest.json'));

    if (Array.isArray(manifestData)) {
      allErrors.push(...validateImagePaths(manifestData));
    }
  } catch (e) {
    allErrors.push(`image-manifest.json 解析失败: ${e.message}`);
  }
}

// 交叉引用校验
if (Array.isArray(summaryData) && Array.isArray(manifestData)) {
  allErrors.push(...validateCrossReference(summaryData, manifestData));
}

// 输出结果
const result = {
  valid: allErrors.length === 0,
  summary_count: Array.isArray(summaryData) ? summaryData.length : 0,
  manifest_count: Array.isArray(manifestData) ? manifestData.length : 0,
  error_count: allErrors.length,
  errors: allErrors,
};

console.log(JSON.stringify(result, null, 2));
process.exit(allErrors.length > 0 ? 1 : 0);
