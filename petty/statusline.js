#!/usr/bin/env node
'use strict';

// Status line: renders the Petty tamagotchi, then hands the raw payload on to
// the pre-existing Orca agent hook so its telemetry keeps working.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const pet = require('./pet.js');

const ORCA_CHAIN = path.join(__dirname, 'orca-chain.sh');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function forwardToOrca(payload) {
  if (!fs.existsSync(ORCA_CHAIN)) return;
  try {
    spawnSync(process.env.SHELL_PATH || 'bash', [ORCA_CHAIN], {
      input: payload,
      timeout: 1500,
      stdio: ['pipe', 'ignore', 'ignore'],
    });
  } catch {}
}

function gitBranch(cwd) {
  try {
    const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      timeout: 700,
      windowsHide: true,
    });
    const b = (r.stdout || '').trim();
    return r.status === 0 && b && b !== 'HEAD' ? b : null;
  } catch {
    return null;
  }
}

function main() {
  const raw = readStdin();
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch {}

  let state = null;
  try {
    state = pet.load();
    if (state.lastSession !== data.session_id) {
      state.lastSession = data.session_id;
      state.sessions += 1;
      pet.save(state);
    }
  } catch {}

  if (state) {
    try {
      forwardToOrca(raw);
    } catch {}
  }

  const v = pet.vitals(state || pet.load(), data.context_window?.used_percentage || 0);
  const frame = Math.floor(Date.now() / 900);
  const c = pet.c;
  const sep = ` ${c.grey}│${c.reset} `;

  const cwd = data.workspace?.current_dir || data.cwd || '';
  const dir = cwd ? path.basename(cwd) : '-';
  const branch = gitBranch(cwd);
  const model = data.model?.display_name || '-';
  const ctx = data.context_window?.used_percentage;
  const cost = data.cost?.total_cost_usd;
  const elapsed = data.cost?.total_duration_ms || 0;

  const line1 = [
    `${v.tone}${pet.mini(v, frame)}${c.reset}`,
    `${c.bold}${state ? state.name : 'PETTY'}${c.reset}`,
    `${c.grey}${v.stage.label}${c.reset}`,
    `${pet.bar(v.mood, 8, v.tone)}`,
    `${v.tone}${v.condition}${c.reset}`,
  ].join(' ');

  const bits = [dir];
  if (branch) bits.push(` ${branch}`);
  bits.push(model);
  if (typeof ctx === 'number') bits.push(`ctx ${ctx}%`);
  if (elapsed) bits.push(`⏱ ${pet.fmtDuration(elapsed)}`);
  if (typeof cost === 'number') bits.push(`$${cost.toFixed(2)}`);

  const plain = bits.join(' · ');
  const limit = Math.max(40, parseInt(process.env.COLUMNS || '', 10) || 100);

  process.stdout.write(
    `${line1}\n${c.grey}${plain.length > limit ? plain.slice(0, limit - 1) + '…' : plain}${c.reset}\n`
  );
}

try {
  main();
} catch (e) {
  process.stderr.write(`petty: ${e && e.message}\n`);
}
process.exitCode = 0;
