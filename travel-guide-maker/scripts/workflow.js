#!/usr/bin/env node
/**
 * workflow.js — travel-guide-maker 状态机管理脚本
 *
 * 管理攻略生成流程的状态转换、前置校验和断点续跑。
 *
 * 用法：
 *   node workflow.js init <dest-dir>
 *   node workflow.js status <dest-dir>
 *   node workflow.js resume <dest-dir>
 *   node workflow.js check <dest-dir> <phase>
 *   node workflow.js advance <dest-dir> <phase> [--data '<json>']
 *   node workflow.js skip <dest-dir> <phase> --reason "<reason>"
 */

const fs   = require('fs');
const path = require('path');

// ── 状态机定义 ────────────────────────────────────

const PHASES = [
  'INIT',
  'KEYWORDS_CONFIRM',
  'SEARCH',
  'SEARCH_CONFIRM',
  'FETCH_DETAILS',
  'TRANSFORM',
  'WRITE_GUIDE',
  'BUILD',
  'REVIEW',
];

const PHASE_LABELS = {
  INIT:             '初始化项目目录',
  KEYWORDS_CONFIRM: '关键词确认',
  SEARCH:           '多轮渐进式笔记搜索',
  SEARCH_CONFIRM:   '搜索结果确认',
  FETCH_DETAILS:    '获取笔记详情',
  TRANSFORM:        '转换为标准中间产物',
  WRITE_GUIDE:      '撰写攻略正文',
  BUILD:            '构建 Word 文档',
  REVIEW:           '文档评审与迭代',
};

// 哪些阶段可以被跳过（依赖 xiaohongshu-skills 的阶段）
const SKIPPABLE_PHASES = new Set([
  'KEYWORDS_CONFIRM',
  'SEARCH',
  'SEARCH_CONFIRM',
  'FETCH_DETAILS',
]);

// 跳过某个阶段时，哪些阶段需要一并跳过
const SKIP_CASCADES = {
  KEYWORDS_CONFIRM: ['SEARCH', 'SEARCH_CONFIRM', 'FETCH_DETAILS'],
  SEARCH:           ['SEARCH_CONFIRM', 'FETCH_DETAILS'],
  SEARCH_CONFIRM:   ['FETCH_DETAILS'],
};

const STATE_FILE = 'workflow-state.json';

// ── 辅助函数 ──────────────────────────────────────

function statePath(destDir) {
  return path.join(path.resolve(destDir), STATE_FILE);
}

function loadState(destDir) {
  const p = statePath(destDir);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveState(destDir, state) {
  const p = statePath(destDir);
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function now() {
  return new Date().toISOString();
}

function makeEmptyState() {
  const phases = {};
  for (const phase of PHASES) {
    phases[phase] = { status: 'pending' };
  }
  return { version: 1, current_phase: PHASES[0], phases };
}

function phaseIndex(phase) {
  const idx = PHASES.indexOf(phase);
  if (idx === -1) {
    console.error(`unknown phase: ${phase}`);
    console.error(`valid phases: ${PHASES.join(', ')}`);
    process.exit(2);
  }
  return idx;
}

function prevPhases(phase) {
  const idx = phaseIndex(phase);
  return PHASES.slice(0, idx);
}

// ── 子命令实现 ─────────────────────────────────────

function cmdInit(destDir) {
  const p = statePath(destDir);
  if (fs.existsSync(p)) {
    console.error(`workflow-state.json already exists: ${p}`);
    console.error('use "status" to inspect, or delete it to reinitialize');
    process.exit(1);
  }
  const state = makeEmptyState();
  saveState(destDir, state);
  console.log(JSON.stringify({ success: true, current_phase: state.current_phase, file: p }));
}

function cmdStatus(destDir) {
  const state = loadState(destDir);
  if (!state) {
    console.log(JSON.stringify({ exists: false, message: 'no workflow-state.json found' }));
    return;
  }

  const summary = [];
  for (const phase of PHASES) {
    const info = state.phases[phase];
    const label = PHASE_LABELS[phase] || phase;
    const marker =
      info.status === 'completed' ? '[done]' :
      info.status === 'skipped'   ? '[skip]' :
      info.status === 'in_progress' ? '[>>]' :
      '[  ]';
    summary.push(`  ${marker} ${phase} — ${label}`);
  }

  console.log(JSON.stringify({
    exists: true,
    current_phase: state.current_phase,
    current_phase_label: PHASE_LABELS[state.current_phase] || state.current_phase,
    phases: state.phases,
    summary: summary.join('\n'),
  }, null, 2));
}

function cmdResume(destDir) {
  const state = loadState(destDir);
  if (!state) {
    console.log(JSON.stringify({
      resumable: false,
      reason: 'no workflow-state.json found',
      action: 'start_fresh',
    }));
    return;
  }

  // 找到第一个未完成且未跳过的阶段
  let resumePhase = null;
  for (const phase of PHASES) {
    const s = state.phases[phase].status;
    if (s !== 'completed' && s !== 'skipped') {
      resumePhase = phase;
      break;
    }
  }

  if (!resumePhase) {
    console.log(JSON.stringify({
      resumable: false,
      reason: 'all phases completed',
      action: 'all_done',
    }));
    return;
  }

  // 汇总已完成的阶段信息
  const completedInfo = {};
  for (const phase of PHASES) {
    const info = state.phases[phase];
    if (info.status === 'completed' || info.status === 'skipped') {
      completedInfo[phase] = { status: info.status };
      if (info.data) completedInfo[phase].data = info.data;
      if (info.reason) completedInfo[phase].reason = info.reason;
    }
  }

  console.log(JSON.stringify({
    resumable: true,
    resume_phase: resumePhase,
    resume_phase_label: PHASE_LABELS[resumePhase] || resumePhase,
    current_state: state.phases[resumePhase],
    completed: completedInfo,
  }, null, 2));
}

function cmdCheck(destDir, phase) {
  phaseIndex(phase); // validate
  const state = loadState(destDir);
  if (!state) {
    console.log(JSON.stringify({
      allowed: false,
      error: 'no workflow-state.json found — run "init" first',
    }));
    process.exit(1);
  }

  // 检查所有前置阶段是否已完成或已跳过
  const missing = [];
  for (const prev of prevPhases(phase)) {
    const s = state.phases[prev].status;
    if (s !== 'completed' && s !== 'skipped') {
      missing.push({ phase: prev, label: PHASE_LABELS[prev], status: s });
    }
  }

  if (missing.length > 0) {
    console.log(JSON.stringify({
      allowed: false,
      phase,
      error: 'prerequisite phases not completed',
      missing,
    }));
    process.exit(1);
  }

  // 检查当前阶段是否已完成
  const currentStatus = state.phases[phase].status;
  if (currentStatus === 'completed') {
    console.log(JSON.stringify({
      allowed: false,
      phase,
      error: 'phase already completed',
      status: currentStatus,
    }));
    process.exit(1);
  }

  // 标记为进行中
  state.phases[phase].status = 'in_progress';
  state.phases[phase].started_at = now();
  state.current_phase = phase;
  saveState(destDir, state);

  console.log(JSON.stringify({
    allowed: true,
    phase,
    label: PHASE_LABELS[phase],
  }));
}

function cmdAdvance(destDir, phase, data) {
  phaseIndex(phase);
  const state = loadState(destDir);
  if (!state) {
    console.error('no workflow-state.json found');
    process.exit(1);
  }

  state.phases[phase].status = 'completed';
  state.phases[phase].completed_at = now();
  if (data) {
    state.phases[phase].data = data;
  }

  // 推进 current_phase 到下一个 pending 阶段
  const idx = phaseIndex(phase);
  for (let i = idx + 1; i < PHASES.length; i++) {
    const s = state.phases[PHASES[i]].status;
    if (s !== 'completed' && s !== 'skipped') {
      state.current_phase = PHASES[i];
      break;
    }
    if (i === PHASES.length - 1) {
      state.current_phase = 'ALL_DONE';
    }
  }

  saveState(destDir, state);

  const nextPhase = state.current_phase;
  console.log(JSON.stringify({
    success: true,
    phase,
    status: 'completed',
    next_phase: nextPhase,
    next_phase_label: PHASE_LABELS[nextPhase] || nextPhase,
  }));
}

function cmdSkip(destDir, phase, reason) {
  phaseIndex(phase);
  if (!SKIPPABLE_PHASES.has(phase)) {
    console.error(`phase ${phase} is not skippable`);
    console.error(`skippable phases: ${[...SKIPPABLE_PHASES].join(', ')}`);
    process.exit(2);
  }

  const state = loadState(destDir);
  if (!state) {
    console.error('no workflow-state.json found');
    process.exit(1);
  }

  // 跳过当前阶段
  state.phases[phase].status = 'skipped';
  state.phases[phase].skipped_at = now();
  state.phases[phase].reason = reason || '';

  // 级联跳过
  const cascades = SKIP_CASCADES[phase] || [];
  for (const cp of cascades) {
    if (state.phases[cp].status === 'pending' || state.phases[cp].status === 'in_progress') {
      state.phases[cp].status = 'skipped';
      state.phases[cp].skipped_at = now();
      state.phases[cp].reason = `cascaded from ${phase} skip`;
    }
  }

  // 推进 current_phase
  for (const p of PHASES) {
    const s = state.phases[p].status;
    if (s !== 'completed' && s !== 'skipped') {
      state.current_phase = p;
      break;
    }
  }

  saveState(destDir, state);

  const skippedPhases = [phase, ...cascades.filter(cp =>
    state.phases[cp].status === 'skipped' && state.phases[cp].reason?.includes('cascaded')
  )];

  console.log(JSON.stringify({
    success: true,
    skipped: skippedPhases,
    next_phase: state.current_phase,
    next_phase_label: PHASE_LABELS[state.current_phase] || state.current_phase,
  }));
}

// ── CLI 入口 ──────────────────────────────────────

const [,, command, rawDestDir, ...rest] = process.argv;

if (!command || !rawDestDir) {
  console.log('travel-guide-maker workflow manager\n');
  console.log('usage:');
  console.log('  node workflow.js init <dest-dir>');
  console.log('  node workflow.js status <dest-dir>');
  console.log('  node workflow.js resume <dest-dir>');
  console.log('  node workflow.js check <dest-dir> <phase>');
  console.log('  node workflow.js advance <dest-dir> <phase> [--data \'<json>\']');
  console.log('  node workflow.js skip <dest-dir> <phase> --reason "<reason>"');
  console.log('');
  console.log('phases (in order):');
  for (const p of PHASES) {
    console.log(`  ${p} — ${PHASE_LABELS[p]}`);
  }
  process.exit(0);
}

const destDir = path.resolve(rawDestDir);

switch (command) {
  case 'init':
    cmdInit(destDir);
    break;
  case 'status':
    cmdStatus(destDir);
    break;
  case 'resume':
    cmdResume(destDir);
    break;
  case 'check': {
    const phase = rest[0];
    if (!phase) { console.error('missing <phase>'); process.exit(2); }
    cmdCheck(destDir, phase);
    break;
  }
  case 'advance': {
    const phase = rest[0];
    if (!phase) { console.error('missing <phase>'); process.exit(2); }
    let data = null;
    const dataIdx = rest.indexOf('--data');
    if (dataIdx !== -1 && rest[dataIdx + 1]) {
      try { data = JSON.parse(rest[dataIdx + 1]); }
      catch (e) { console.error(`invalid --data JSON: ${e.message}`); process.exit(2); }
    }
    cmdAdvance(destDir, phase, data);
    break;
  }
  case 'skip': {
    const phase = rest[0];
    if (!phase) { console.error('missing <phase>'); process.exit(2); }
    let reason = '';
    const reasonIdx = rest.indexOf('--reason');
    if (reasonIdx !== -1 && rest[reasonIdx + 1]) {
      reason = rest[reasonIdx + 1];
    }
    cmdSkip(destDir, phase, reason);
    break;
  }
  default:
    console.error(`unknown command: ${command}`);
    process.exit(2);
}
