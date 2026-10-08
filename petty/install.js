#!/usr/bin/env node
'use strict';

// Installs Petty as your Claude Code status line.
//
// The runtime is copied out of the repo into ~/.claude/petty so it keeps
// working when the worktree is pruned or you switch branches — Claude Code
// blanks the status line entirely if the script can't be found.
//
// Any command already sitting in statusLine is preserved to
// ~/.claude/petty/orca-chain.sh and re-executed on every render, so hooks
// that piggyback on the status line (Orca's agent telemetry, for one) keep
// working. settings.json is backed up before anything is written.

const fs = require('fs');
const os = require('os');
const path = require('path');

const repo = path.resolve(process.argv[2] || process.cwd());
const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const settingsPath = path.join(configDir, 'settings.json');
const runtimeDir = path.join(configDir, 'petty');
const chainPath = path.join(runtimeDir, 'orca-chain.sh');

if (!fs.existsSync(settingsPath)) {
  console.error(`no settings.json at ${settingsPath}`);
  process.exit(1);
}

const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const current = settings.statusLine?.command;

// An older petty install points at a worktree copy of statusline.js. Chaining
// that would recurse forever, so lift the real predecessor out of the repo.
const legacyChain = path.join(repo, 'petty', 'orca-chain.sh');

if (current && !fs.existsSync(chainPath)) {
  if (current.includes('petty/statusline.js')) {
    if (!fs.existsSync(legacyChain)) {
      console.error(
        `statusLine is an older petty install and ${legacyChain} is missing.\n` +
          'Restore your original statusLine command by hand, then re-run.'
      );
      process.exit(1);
    }
    fs.copyFileSync(legacyChain, chainPath);
    console.log(`migrated predecessor -> ${chainPath}`);
  } else {
    fs.writeFileSync(chainPath, current + '\n');
    console.log(`preserved existing statusLine -> ${chainPath}`);
  }
}

const target = path.join(runtimeDir, 'statusline.js');
const command = `node "${target.replace(/\\/g, '/')}"`;

if (current === command) {
  // Still refresh the runtime so edits to the repo land on disk.
  for (const f of ['pet.js', 'statusline.js']) {
    fs.copyFileSync(path.join(repo, 'petty', f), path.join(runtimeDir, f));
  }
  console.log('already installed — runtime refreshed');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `${settingsPath}.bak-${stamp}`;
fs.copyFileSync(settingsPath, backup);
console.log(`backup -> ${backup}`);

fs.mkdirSync(runtimeDir, { recursive: true });
for (const f of ['pet.js', 'statusline.js']) {
  fs.copyFileSync(path.join(repo, 'petty', f), path.join(runtimeDir, f));
}
console.log(`runtime -> ${runtimeDir}`);

settings.statusLine = { type: 'command', command, refreshInterval: 5 };
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

console.log(`installed -> ${command}`);
console.log('run a new prompt to see the status line reload');