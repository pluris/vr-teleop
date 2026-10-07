'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const STATE_DIR =
  process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude', 'petty');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

const NAMES = [
  'PRET', 'BLUB', 'WALLY', 'FINNY', 'NOODLE',
  'SPROUT', 'MIMI', 'CHUPI', 'BOBBIN', 'PUDDLE',
];

const STAGES = [
  { key: 'egg',    label: '알',     at: 0 },
  { key: 'baby',   label: '아기',   at: 10 * 60e3 },
  { key: 'child',  label: '어린이', at: 2 * 3600e3 },
  { key: 'teen',   label: '청소년', at: 12 * 3600e3 },
  { key: 'adult',  label: '어른',   at: 3 * 86400e3 },
];

// Night hours the pet curls up, local time.
const SLEEP_START = 23;
const SLEEP_END = 7;

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  grey: '\x1b[90m',
};

function load() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (typeof s.born === 'number') return s;
  } catch {}
  const now = Date.now();
  const state = {
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    born: now,
    lastFed: now,
    lastSeen: now,
    feeds: 0,
    sessions: 0,
  };
  save(state);
  return state;
}

function save(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function stage(ageMs) {
  let found = STAGES[0];
  for (const s of STAGES) if (ageMs >= s.at) found = s;
  return found;
}

function isNight(now = new Date()) {
  const h = now.getHours();
  return h >= SLEEP_START || h < SLEEP_END;
}

/**
 * Derive the pet's vitals. Hunger climbs over time since the last feed;
 * a full context window makes the pet irritable; feeding briefly restores mood.
 */
function vitals(state, ctxPct = 0, now = Date.now()) {
  const age = now - state.born;
  const ctx = Math.max(0, Math.min(100, ctxPct || 0));
  const sinceFed = now - state.lastFed;
  const hunger = Math.max(0, Math.min(100, Math.round((sinceFed / (6 * 3600e3)) * 100)));
  const fedRecently = Math.min(1, Math.max(0, 1 - sinceFed / (45 * 60e3)));

  let mood = 100;
  mood -= Math.max(0, hunger - 40) * 0.7;
  mood -= Math.max(0, ctx - 60) * 1.2;
  mood -= Math.max(0, 25 - state.sessions) * 0.5;
  mood += fedRecently * 10;
  mood = Math.max(0, Math.min(100, Math.round(mood)));

  const sleeping = isNight(new Date(now));

  let condition, tone;
  if (sleeping) {
    condition = 'zzZ';
    tone = c.blue;
  } else if (hunger > 85) {
    condition = '굶주림';
    tone = c.red;
  } else if (ctx >= 80) {
    condition = '과부하';
    tone = c.red;
  } else if (mood >= 70) {
    condition = '기쁨';
    tone = c.green;
  } else if (mood >= 45) {
    condition = hunger > 65 ? '배고픔' : '평온';
    tone = c.yellow;
  } else {
    condition = '불만';
    tone = c.red;
  }

  return {
    age,
    stage: stage(age),
    hunger,
    mood,
    sleeping,
    condition,
    tone,
    fedRecently: fedRecently > 0,
  };
}

// ---------------------------------------------------------------- sprites

const ART = {
  egg: ['    ,---.', '   /  o  \\', '   \\  ~  /', "    `---'"],
  baby: ['   ,---.', '  ( o o )', '  (  =  )', "   `v v'"],
  child: ['    ,---.', '   / o o \\', '  (  = =  )', '  (  = =  )>', "   `\\_ _/'"],
  teen: ['     ,---.', '    / o o \\', '   |  = =  |', '   |  \\ /  |', "   \\_ `v' _/", "     `---'"],
  adult: ['      ,---.', '     / o o \\', '    |  = =  |', '    |  \\ /  |', '   /   =   \\', "   \\  `v'  /", "    `-.___.-'"],
};

const MINI = {
  egg: '( o )',
  baby: '( oo )~',
  child: '( oo )~~',
  teen: '( Oo )~~',
  adult: '( OO )~~~',
};

function eye(good, asleep, blink) {
  if (asleep) return '-';
  if (blink) return 'o';
  return good ? 'o' : '.';
}

function isCheerful(v) {
  return v.mood >= 45 && v.hunger <= 85;
}

function art(v, frame) {
  const blink = frame % 2 === 1;
  const key = v.stage.key;
  const good = isCheerful(v);
  const lines = ART[key].slice();
  if (v.sleeping || !good) {
    for (let i = 0; i < lines.length; i++) {
      lines[i] = lines[i].replace(/o o/g, `${eye(good, true, blink)} ${eye(good, true, blink)}`);
    }
  }
  return lines;
}

function mini(v, frame) {
  if (v.sleeping) return '( - - )~ zZ';
  const base = MINI[v.stage.key];
  if (!isCheerful(v)) return base.replace(/O+/, '..');
  return base;
}

function bar(pct, width = 10, tone = c.green) {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return `${tone}${'█'.repeat(filled)}${c.grey}${'░'.repeat(width - filled)}${c.reset}`;
}

function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h${m % 60}m` : `${h}h`;
}

// ---------------------------------------------------------------- commands

function cmdShow({ colored = true } = {}) {
  const state = load();
  const v = vitals(state);
  const frame = Math.floor(Date.now() / 900);
  const lines = art(v, frame);

  if (!colored) return lines.join('\n');

  const head = `${c.bold}${v.tone}${state.name}${c.reset} ${c.grey}·${c.reset} ${v.stage.label} ${c.grey}·${c.reset} ${v.tone}${v.condition}${c.reset}`;
  const rows = [`   ${c.cyan}${lines[0]}${c.reset}`, ` ${c.cyan}${lines[1]}${c.reset}`];
  for (const l of lines.slice(2)) rows.push(`${c.cyan}${l}${c.reset}`);

  const stats = [
    `${c.grey}기분  ${c.reset}${bar(v.mood, 10, v.tone)} ${String(v.mood).padStart(3)}%`,
    `${c.grey}배고픔${c.reset}${bar(100 - v.hunger, 10, v.hunger > 65 ? c.red : c.green)} ${String(v.hunger).padStart(3)}%`,
    `${c.grey}먹이  ${c.reset}${state.feeds}회 ${c.grey}· 방문 ${state.sessions}회${c.reset}`,
  ];

  return [head, ...rows, '', ...stats].join('\n');
}

function cmdFeed() {
  const state = load();
  state.lastFed = Date.now();
  state.feeds += 1;
  save(state);
  const v = vitals(state);
  return `🐟 ${state.name}이(가) 먹이를 먹었다!  기분 ${v.mood}% · 배고픔 ${v.hunger}%`;
}

function cmdReset() {
  const state = load();
  const fresh = {
    name: state.name,
    born: Date.now(),
    lastFed: Date.now(),
    lastSeen: Date.now(),
    feeds: 0,
    sessions: state.sessions + 1,
  };
  save(fresh);
  return `${fresh.name}이(가) 다시 태어났습니다. (알 → 알)`;
}

if (require.main === module) {
  const cmd = process.argv[2] || 'show';
  const fn = { show: cmdShow, feed: cmdFeed, reset: cmdReset }[cmd];
  if (fn) process.stdout.write(fn() + '\n');
}

module.exports = {
  STATE_DIR,
  STATE_FILE,
  load,
  save,
  vitals,
  art,
  mini,
  bar,
  fmtDuration,
  c,
  cmdShow,
  cmdFeed,
  cmdReset,
  stageOf: stage,
};
