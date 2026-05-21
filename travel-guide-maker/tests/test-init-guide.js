const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const SKILL_ROOT = path.resolve(__dirname, '..');
const INIT_SCRIPT = path.join(SKILL_ROOT, 'scripts', 'init-guide.js');
const WORKFLOW_SCRIPT = path.join(SKILL_ROOT, 'scripts', 'workflow.js');

function runInit(args) {
  try {
    const stdout = execFileSync('node', [INIT_SCRIPT, ...args], {
      encoding: 'utf8',
      timeout: 10000,
    });
    return { exitCode: 0, stdout };
  } catch (e) {
    return { exitCode: e.status, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

function parseOutput(stdout) {
  try { return JSON.parse(stdout); } catch { return null; }
}

const tmpDirs = [];
function makeTmpDest() {
  const dest = path.join(os.tmpdir(), `init-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  tmpDirs.push(dest);
  return dest;
}

afterEach(() => {
  for (const d of tmpDirs) {
    fs.rmSync(d, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe('init-guide.js', () => {
  it('creates project with default params (days=2, source=manual)', () => {
    const dest = makeTmpDest();
    const { exitCode, stdout } = runInit(['测试目的地', '--dest', dest]);
    assert.equal(exitCode, 0);

    const output = parseOutput(stdout);
    assert.equal(output.status, 'initialized');
    assert.equal(output.cleared, false);

    const config = JSON.parse(fs.readFileSync(path.join(dest, 'guide.config.json'), 'utf8'));
    assert.equal(config.days, 2);
    assert.equal(config.sourceType, 'manual');
    assert.equal(config.title, '测试目的地两日旅游攻略');
    assert.equal(config.subtitle, '旅游攻略整理版');
    assert.ok(!config.docx.footerText.includes('小红书'));
  });

  it('creates project with --days 5 --source xhs', () => {
    const dest = makeTmpDest();
    const { exitCode } = runInit(['杭州', '--dest', dest, '--days', '5', '--source', 'xhs']);
    assert.equal(exitCode, 0);

    const config = JSON.parse(fs.readFileSync(path.join(dest, 'guide.config.json'), 'utf8'));
    assert.equal(config.days, 5);
    assert.equal(config.sourceType, 'xhs');
    assert.equal(config.title, '杭州五日旅游攻略');
    assert.ok(config.subtitle.includes('小红书'));
    assert.ok(config.docx.footerText.includes('小红书'));
  });

  it('generates guide.md with correct number of day sections', () => {
    const dest = makeTmpDest();
    runInit(['宁波', '--dest', dest, '--days', '3']);
    const guideMd = fs.readFileSync(path.join(dest, 'markdown', 'guide.md'), 'utf8');
    assert.ok(guideMd.includes('# Day 1'));
    assert.ok(guideMd.includes('# Day 2'));
    assert.ok(guideMd.includes('# Day 3'));
    assert.ok(!guideMd.includes('# Day 4'));
  });

  it('guide.md does not contain XHS-specific text when source=manual', () => {
    const dest = makeTmpDest();
    runInit(['宁波', '--dest', dest, '--source', 'manual']);
    const guideMd = fs.readFileSync(path.join(dest, 'markdown', 'guide.md'), 'utf8');
    assert.ok(!guideMd.includes('小红书'));
    assert.ok(!guideMd.includes('点赞'));
  });

  it('guide.md includes XHS-specific text when source=xhs', () => {
    const dest = makeTmpDest();
    runInit(['宁波', '--dest', dest, '--source', 'xhs']);
    const guideMd = fs.readFileSync(path.join(dest, 'markdown', 'guide.md'), 'utf8');
    assert.ok(guideMd.includes('小红书'));
  });

  it('creates all required directories', () => {
    const dest = makeTmpDest();
    runInit(['测试', '--dest', dest]);
    assert.ok(fs.existsSync(path.join(dest, 'markdown')));
    assert.ok(fs.existsSync(path.join(dest, 'mappings')));
    assert.ok(fs.existsSync(path.join(dest, 'note-details')));
    assert.ok(fs.existsSync(path.join(dest, 'raw-search-snapshots')));
    assert.ok(fs.existsSync(path.join(dest, 'images')));
    assert.ok(fs.existsSync(path.join(dest, 'docx-assets')));
    assert.ok(fs.existsSync(path.join(dest, 'route-map')));
  });

  it('config.docx.routeMapDisclaimer exists', () => {
    const dest = makeTmpDest();
    runInit(['测试', '--dest', dest]);
    const config = JSON.parse(fs.readFileSync(path.join(dest, 'guide.config.json'), 'utf8'));
    assert.ok(config.docx.routeMapDisclaimer);
    assert.ok(config.docx.routeMapDisclaimer.length > 0);
  });

  it('--days 1 uses 一日 in title', () => {
    const dest = makeTmpDest();
    runInit(['苏州', '--dest', dest, '--days', '1']);
    const config = JSON.parse(fs.readFileSync(path.join(dest, 'guide.config.json'), 'utf8'));
    assert.equal(config.title, '苏州一日旅游攻略');
  });

  it('rejects invalid --source value', () => {
    const dest = makeTmpDest();
    const { exitCode } = runInit(['测试', '--dest', dest, '--source', 'invalid']);
    assert.equal(exitCode, 1);
  });

  it('rejects invalid --days value', () => {
    const dest = makeTmpDest();
    const { exitCode } = runInit(['测试', '--dest', dest, '--days', '0']);
    assert.equal(exitCode, 1);
  });

  it('clears existing dir without workflow-state.json and reinitializes', () => {
    const dest = makeTmpDest();
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'stale-file.txt'), 'should be removed');

    const { exitCode, stdout } = runInit(['测试', '--dest', dest]);
    assert.equal(exitCode, 0);

    const output = parseOutput(stdout);
    assert.equal(output.status, 'initialized');
    assert.equal(output.cleared, true);
    assert.ok(!fs.existsSync(path.join(dest, 'stale-file.txt')));
    assert.ok(fs.existsSync(path.join(dest, 'guide.config.json')));
  });

  it('returns resumable when workflow-state.json exists (no --force)', () => {
    const dest = makeTmpDest();
    runInit(['测试', '--dest', dest]);
    execFileSync('node', [WORKFLOW_SCRIPT, 'init', dest], { encoding: 'utf8' });

    const { exitCode, stdout } = runInit(['测试', '--dest', dest]);
    assert.equal(exitCode, 0);

    const output = parseOutput(stdout);
    assert.equal(output.status, 'resumable');
    assert.equal(output.current_phase, 'INIT');
  });

  it('--force clears dir even with workflow-state.json', () => {
    const dest = makeTmpDest();
    runInit(['测试', '--dest', dest]);
    execFileSync('node', [WORKFLOW_SCRIPT, 'init', dest], { encoding: 'utf8' });

    const { exitCode, stdout } = runInit(['测试', '--dest', dest, '--force']);
    assert.equal(exitCode, 0);

    const output = parseOutput(stdout);
    assert.equal(output.status, 'initialized');
    assert.equal(output.cleared, true);
    assert.ok(!fs.existsSync(path.join(dest, 'workflow-state.json')));
    assert.ok(fs.existsSync(path.join(dest, 'guide.config.json')));
  });

  it('exits with error when no destination name provided', () => {
    const { exitCode } = runInit([]);
    assert.equal(exitCode, 1);
  });
});
