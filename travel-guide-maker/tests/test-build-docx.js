const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const SKILL_ROOT = path.resolve(__dirname, '..');

describe('build_guide_docx.js — hardcoded text removal', () => {
  it('references routeMapDisclaimer from config', () => {
    const src = fs.readFileSync(
      path.join(SKILL_ROOT, 'template', 'docx-assets', 'build_guide_docx.js'),
      'utf8',
    );
    assert.ok(
      src.includes('routeMapDisclaimer'),
      'should reference routeMapDisclaimer from config',
    );
  });

  it('does not contain hardcoded route map disclaimer', () => {
    const src = fs.readFileSync(
      path.join(SKILL_ROOT, 'template', 'docx-assets', 'build_guide_docx.js'),
      'utf8',
    );
    assert.ok(
      !src.includes('路线图仅用于理解行程节奏与片区关系'),
      'should not contain hardcoded route map disclaimer',
    );
  });

  it('footer fallback does not mention 小红书', () => {
    const src = fs.readFileSync(
      path.join(SKILL_ROOT, 'template', 'docx-assets', 'build_guide_docx.js'),
      'utf8',
    );
    assert.ok(
      !src.includes("整理自公开高赞笔记'"),
      'footer fallback should not mention 小红书-specific text',
    );
  });
});

describe('build_guide_pandoc.js — hardcoded text removal', () => {
  it('references routeMapDisclaimer from config', () => {
    const src = fs.readFileSync(
      path.join(SKILL_ROOT, 'template', 'docx-assets', 'build_guide_pandoc.js'),
      'utf8',
    );
    assert.ok(
      src.includes('routeMapDisclaimer'),
      'should reference routeMapDisclaimer',
    );
  });

  it('does not contain hardcoded pandoc disclaimer', () => {
    const src = fs.readFileSync(
      path.join(SKILL_ROOT, 'template', 'docx-assets', 'build_guide_pandoc.js'),
      'utf8',
    );
    assert.ok(
      !src.includes('路线图为示意路线，游玩前请以现场交通与景区信息为准'),
      'should not contain hardcoded disclaimer',
    );
  });
});
