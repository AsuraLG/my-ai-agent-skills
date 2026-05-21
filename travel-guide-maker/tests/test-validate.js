const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const SKILL_ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');

function runValidate(destDir) {
  try {
    const stdout = execFileSync('node', [
      path.join(SKILL_ROOT, 'scripts', 'validate.js'),
      destDir,
    ], { encoding: 'utf8', timeout: 10000 });
    return { exitCode: 0, result: JSON.parse(stdout) };
  } catch (e) {
    const stdout = e.stdout || '';
    let result = null;
    try { result = JSON.parse(stdout); } catch {}
    return { exitCode: e.status, result };
  }
}

function setupDest(summaryFile, manifestFile) {
  const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-test-'));
  const mappingsDir = path.join(destDir, 'mappings');
  fs.mkdirSync(mappingsDir, { recursive: true });
  if (summaryFile) {
    fs.copyFileSync(summaryFile, path.join(mappingsDir, 'note-summary.json'));
  }
  if (manifestFile) {
    fs.copyFileSync(manifestFile, path.join(mappingsDir, 'image-manifest.json'));
  }
  return destDir;
}

describe('validate.js', () => {
  it('valid data passes', () => {
    const dest = setupDest(
      path.join(FIXTURES, 'valid-note-summary.json'),
      path.join(FIXTURES, 'valid-image-manifest.json'),
    );
    const { exitCode, result } = runValidate(dest);
    assert.equal(exitCode, 0);
    assert.equal(result.valid, true);
    assert.equal(result.error_count, 0);
    assert.equal(result.summary_count, 2);
    assert.equal(result.manifest_count, 2);
  });

  it('rejects string counts (e.g. "2.8万")', () => {
    const dest = setupDest(
      path.join(FIXTURES, 'invalid-string-counts.json'),
      path.join(FIXTURES, 'valid-image-manifest.json'),
    );
    const { exitCode, result } = runValidate(dest);
    assert.equal(exitCode, 1);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('likedCount')));
  });

  it('rejects duplicate feed_id', () => {
    const dest = setupDest(
      path.join(FIXTURES, 'invalid-duplicate-feedid.json'),
      path.join(FIXTURES, 'valid-image-manifest.json'),
    );
    const { exitCode, result } = runValidate(dest);
    assert.equal(exitCode, 1);
    assert.ok(result.errors.some(e => e.includes('feed_id') && e.includes('重复')));
  });

  it('rejects missing required fields', () => {
    const dest = setupDest(
      path.join(FIXTURES, 'invalid-missing-fields.json'),
      path.join(FIXTURES, 'valid-image-manifest.json'),
    );
    const { exitCode, result } = runValidate(dest);
    assert.equal(exitCode, 1);
    assert.ok(result.errors.some(e => e.includes('必填') || e.includes('required')));
  });

  it('rejects desc > 500 chars', () => {
    const dest = setupDest(
      path.join(FIXTURES, 'invalid-long-desc.json'),
      path.join(FIXTURES, 'valid-image-manifest.json'),
    );
    const { exitCode, result } = runValidate(dest);
    assert.equal(exitCode, 1);
    assert.ok(result.errors.some(e => e.includes('desc')));
  });

  it('rejects relative image paths', () => {
    const summaryData = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'valid-note-summary.json'), 'utf8'));
    const tmpSummary = path.join(os.tmpdir(), `rel-path-summary-${Date.now()}.json`);
    fs.writeFileSync(tmpSummary, JSON.stringify([summaryData[0]]), 'utf8');

    const dest = setupDest(
      tmpSummary,
      path.join(FIXTURES, 'invalid-relative-paths.json'),
    );
    const { exitCode, result } = runValidate(dest);
    assert.equal(exitCode, 1);
    assert.ok(result.errors.some(e => e.includes('绝对路径')));
  });

  it('detects cross-reference mismatch', () => {
    const dest = setupDest(
      path.join(FIXTURES, 'valid-note-summary.json'),
      path.join(FIXTURES, 'cross-ref-mismatch-manifest.json'),
    );
    const { exitCode, result } = runValidate(dest);
    assert.equal(exitCode, 1);
    assert.ok(result.errors.some(e => e.includes('ghost999')));
  });

  it('reports missing files (exit code 2)', () => {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-empty-'));
    fs.mkdirSync(path.join(dest, 'mappings'), { recursive: true });
    const { exitCode } = runValidate(dest);
    assert.equal(exitCode, 2);
  });

  it('rejects image_count_downloaded mismatch with paths length', () => {
    const summaryData = JSON.parse(
      fs.readFileSync(path.join(FIXTURES, 'valid-note-summary.json'), 'utf8')
    );
    const manifest = [{
      feed_id: summaryData[0].feed_id,
      title: "标题",
      image_count_downloaded: 5,
      local_image_paths: ["/tmp/a.jpg"],
      source_link: "",
    }];
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-count-'));
    const mappingsDir = path.join(dest, 'mappings');
    fs.mkdirSync(mappingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(mappingsDir, 'note-summary.json'),
      JSON.stringify([summaryData[0]]),
    );
    fs.writeFileSync(
      path.join(mappingsDir, 'image-manifest.json'),
      JSON.stringify(manifest),
    );
    const { exitCode, result } = runValidate(dest);
    assert.equal(exitCode, 1);
    assert.ok(result.errors.some(e => e.includes('image_count_downloaded')));
  });
});
