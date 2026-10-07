#!/usr/bin/env node
'use strict';

// Installs Petty as your Claude Code status line.
//
// Any command already sitting in statusLine is preserved to
// petty/orca-chain.sh and re-executed on every render, so hooks that
// piggyback on the status line (Orca's agent telemetry, for one) keep
// working. settings.json is backed up before anything is written.

const fs = require('fs');
const os = require('os');
const path = require('path');

const repo = path.resolve(process.argv[2] || process.cwd());
const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const settingsPath = path.join(configDir, 'settings.json');
const chainPath = path.join(repo, 'petty', 'orca-chain.sh');

if (!fs.existsSync(settingsPath)) {
  console.error(`no settings.json at ${settingsPath}`);
  process.exit(1);
}

const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const current = settings.statusLine?.command;

if (current?.includes('petty/statusline.js')) {
  console.log('already installed — nothing to do');
  process.exit(0);
}

if (current && !fs.existsSync(chainPath)) {
  fs.writeFileSync(chainPath, current + '\n');
  console.log(`preserved existing statusLine -> ${chainPath}`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = `${settingsPath}.bak-${stamp}`;
fs.copyFileSync(settingsPath, backup);
console.log(`backup -> ${backup}`);

settings.statusLine = {
  type: 'command',
  command: `node "${path.join(repo, 'petty', 'statusline.js').replace(/\\/g, '/')}"`,
  refreshInterval: 5,
};
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

console.log(`installed -> ${settings.statusLine.command}`);
console.log('run a new prompt to see the status line reload');
