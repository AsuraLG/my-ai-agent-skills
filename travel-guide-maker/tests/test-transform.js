const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const SKILL_ROOT = path.resolve(__dirname, '..');
const TRANSFORM = path.join(SKILL_ROOT, 'scripts', 'adapters', 'xhs', 'transform.js');
const FIXTURES = path.join(__dirname, 'fixtures');

function runTransform(destDir, flags = []) {
  try {
    const stdout = execFileSync('node', [TRANSFORM, destDir, ...flags], {
      encoding: 'utf8', timeout: 10000,
    });
    return { exitCode: 0, stdout };
  } catch (e) {
    return { exitCode: e.status, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

const tmpDirs = [];
function makeTmpDest() {
  const dest = path.join(os.tmpdir(), `xfm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(path.join(dest, 'note-details'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'mappings'), { recursive: true });
  tmpDirs.push(dest);
  return dest;
}

afterEach(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  tmpDirs.length = 0;
});

describe('adapters/xhs/transform.js', () => {
  it('transforms XHS feed detail to standard format', () => {
    const dest = makeTmpDest();
    fs.copyFileSync(
      path.join(FIXTURES, 'xhs-feed-detail-sample.json'),
      path.join(dest, 'note-details', 'sample001.json'),
    );
    runTransform(dest);

    const summary = JSON.parse(fs.readFileSync(path.join(dest, 'mappings', 'note-summary.json'), 'utf8'));
    assert.equal(summary.length, 1);
    assert.equal(summary[0].feed_id, 'sample001');
    assert.equal(summary[0].author, '测试博主');
    assert.equal(summary[0].likedCount, 28000);
    assert.equal(summary[0].collectedCount, 12000);
    assert.equal(summary[0].commentCount, 368);
    assert.equal(typeof summary[0].likedCount, 'number');
  });

  it('extracts top 3 comments sorted by likeCount', () => {
    const dest = makeTmpDest();
    fs.copyFileSync(
      path.join(FIXTURES, 'xhs-feed-detail-sample.json'),
      path.join(dest, 'note-details', 'sample001.json'),
    );
    runTransform(dest);

    const summary = JSON.parse(fs.readFileSync(path.join(dest, 'mappings', 'note-summary.json'), 'utf8'));
    assert.equal(summary[0].top_comments.length, 3);
    assert.equal(summary[0].top_comments[0], '好详细！已收藏');
  });

  it('generates image-manifest with 0 images when no images dir', () => {
    const dest = makeTmpDest();
    fs.copyFileSync(
      path.join(FIXTURES, 'xhs-feed-detail-sample.json'),
      path.join(dest, 'note-details', 'sample001.json'),
    );
    runTransform(dest);

    const manifest = JSON.parse(fs.readFileSync(path.join(dest, 'mappings', 'image-manifest.json'), 'utf8'));
    assert.equal(manifest[0].image_count_downloaded, 0);
    assert.deepEqual(manifest[0].local_image_paths, []);
  });

  it('dry-run does not write files', () => {
    const dest = makeTmpDest();
    fs.copyFileSync(
      path.join(FIXTURES, 'xhs-feed-detail-sample.json'),
      path.join(dest, 'note-details', 'sample001.json'),
    );
    runTransform(dest, ['--dry-run']);

    const summaryPath = path.join(dest, 'mappings', 'note-summary.json');
    if (fs.existsSync(summaryPath)) {
      const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      assert.ok(Array.isArray(data) && data.length === 0, 'summary should be empty or not exist');
    }
  });

  it('parseCount handles 万 suffix correctly', () => {
    const dest = makeTmpDest();
    const detail = {
      note: {
        noteId: 'count-test',
        title: '计数测试',
        desc: '',
        user: { nickname: '作者' },
        interactInfo: { likedCount: '3.5万', collectedCount: '100+', commentCount: '0' },
      },
      comments: [],
    };
    fs.writeFileSync(
      path.join(dest, 'note-details', 'count-test.json'),
      JSON.stringify(detail),
    );
    runTransform(dest);

    const summary = JSON.parse(fs.readFileSync(path.join(dest, 'mappings', 'note-summary.json'), 'utf8'));
    assert.equal(summary[0].likedCount, 35000);
    assert.equal(summary[0].collectedCount, 100);
    assert.equal(summary[0].commentCount, 0);
  });

  it('fails when note-details/ is empty', () => {
    const dest = makeTmpDest();
    const { exitCode } = runTransform(dest);
    assert.equal(exitCode, 1);
  });
});
