const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const SKILL_ROOT = path.resolve(__dirname, '..');
const WORKFLOW = path.join(SKILL_ROOT, 'scripts', 'workflow.js');

function run(args) {
  try {
    const stdout = execFileSync('node', [WORKFLOW, ...args], {
      encoding: 'utf8', timeout: 10000,
    });
    return { exitCode: 0, result: JSON.parse(stdout) };
  } catch (e) {
    let result = null;
    try { result = JSON.parse(e.stdout || ''); } catch {}
    return { exitCode: e.status, result, stderr: e.stderr || '' };
  }
}

const tmpDirs = [];
function makeTmpDest() {
  const dest = path.join(os.tmpdir(), `wf-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dest, { recursive: true });
  tmpDirs.push(dest);
  return dest;
}

afterEach(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  tmpDirs.length = 0;
});

describe('workflow.js', () => {
  it('init creates workflow-state.json with INIT as current phase', () => {
    const dest = makeTmpDest();
    const { exitCode, result } = run(['init', dest]);
    assert.equal(exitCode, 0);
    assert.equal(result.success, true);
    assert.equal(result.current_phase, 'INIT');
    assert.ok(fs.existsSync(path.join(dest, 'workflow-state.json')));
  });

  it('init fails if workflow-state.json already exists', () => {
    const dest = makeTmpDest();
    run(['init', dest]);
    const { exitCode } = run(['init', dest]);
    assert.equal(exitCode, 1);
  });

  it('resume returns resumable: false for fresh directory', () => {
    const dest = makeTmpDest();
    const { result } = run(['resume', dest]);
    assert.equal(result.resumable, false);
    assert.equal(result.action, 'start_fresh');
  });

  it('resume returns resumable: true after init', () => {
    const dest = makeTmpDest();
    run(['init', dest]);
    const { result } = run(['resume', dest]);
    assert.equal(result.resumable, true);
    assert.equal(result.resume_phase, 'INIT');
  });

  it('check + advance flow: INIT → KEYWORDS_CONFIRM', () => {
    const dest = makeTmpDest();
    run(['init', dest]);
    const checkResult = run(['check', dest, 'INIT']);
    assert.equal(checkResult.result.allowed, true);
    const advResult = run(['advance', dest, 'INIT', '--data', '{"destination":"测试"}']);
    assert.equal(advResult.result.success, true);
    assert.equal(advResult.result.next_phase, 'KEYWORDS_CONFIRM');
  });

  it('check rejects out-of-order phase', () => {
    const dest = makeTmpDest();
    run(['init', dest]);
    const { exitCode, result } = run(['check', dest, 'SEARCH']);
    assert.equal(exitCode, 1);
    assert.equal(result.allowed, false);
  });

  it('skip cascades KEYWORDS_CONFIRM → SEARCH, SEARCH_CONFIRM, FETCH_DETAILS', () => {
    const dest = makeTmpDest();
    run(['init', dest]);
    run(['check', dest, 'INIT']);
    run(['advance', dest, 'INIT']);
    const { result } = run(['skip', dest, 'KEYWORDS_CONFIRM', '--reason', 'no xhs']);
    assert.ok(result.skipped.includes('KEYWORDS_CONFIRM'));
    assert.equal(result.next_phase, 'TRANSFORM');
  });

  it('status shows phase summary', () => {
    const dest = makeTmpDest();
    run(['init', dest]);
    const { result } = run(['status', dest]);
    assert.equal(result.exists, true);
    assert.ok(result.summary.includes('INIT'));
  });

  it('check rejects already completed phase', () => {
    const dest = makeTmpDest();
    run(['init', dest]);
    run(['check', dest, 'INIT']);
    run(['advance', dest, 'INIT']);
    const { exitCode, result } = run(['check', dest, 'INIT']);
    assert.equal(exitCode, 1);
    assert.ok(result.error.includes('already completed'));
  });

  it('resume reports all_done after all phases completed or skipped', () => {
    const dest = makeTmpDest();
    run(['init', dest]);
    run(['check', dest, 'INIT']);
    run(['advance', dest, 'INIT']);
    run(['skip', dest, 'KEYWORDS_CONFIRM', '--reason', 'test']);
    run(['check', dest, 'TRANSFORM']);
    run(['advance', dest, 'TRANSFORM']);
    run(['check', dest, 'WRITE_GUIDE']);
    run(['advance', dest, 'WRITE_GUIDE']);
    run(['check', dest, 'BUILD']);
    run(['advance', dest, 'BUILD']);
    run(['check', dest, 'REVIEW']);
    run(['advance', dest, 'REVIEW']);
    const { result } = run(['resume', dest]);
    assert.equal(result.resumable, false);
    assert.equal(result.action, 'all_done');
  });
});
