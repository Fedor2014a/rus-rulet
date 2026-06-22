import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

type PlayerId = 'p1' | 'p2';
type Rect = { x: number; y: number; width: number; height: number };
type Actor = Rect & { vx: number; vy: number; onGround: boolean };
type PlatformKind = 'solid' | 'fake' | 'vanish';
type Platform = Rect & { id: string; kind: PlatformKind };
type Spike = Rect & { id: string; trigger: Trigger };
type Gate = Rect & { id: string; buttonId: string };
type ButtonPad = Rect & { id: string; label: string; badFor?: PlayerId };
type Teleporter = Rect & { id: string; to: { x: number; y: number }; fake?: boolean };
type Door = Rect & { id: string; fake?: boolean };
type Crate = Rect & { start: { x: number; y: number }; vx: number; vy: number; onGround: boolean };
type Boss = Rect & { id: string; name: string; amplitude: number; speed: number; hp: number };
type Projectile = Rect & { id: string; vx: number };
type BossFireball = Rect & { id: string; vx: number; vy: number };
export type GameProgress = { levelIndex: number; deaths: number };
export type SavedGameProgress = GameProgress & {
  playerHp?: { p1: number; p2: number };
  arrows?: { p1: number; p2: number };
};
type TrapPlatformerGameProps = {
  initialProgress?: SavedGameProgress | null;
  onProgressChange?: (progress: SavedGameProgress) => void;
};

type Trigger =
  | { type: 'always' }
  | { type: 'playerX'; player: PlayerId; x: number }
  | { type: 'button'; buttonId: string }
  | { type: 'otherButton'; buttonId: string; victim: PlayerId };

type Level = {
  name: string;
  sign: string;
  joke: string;
  spawn: Record<PlayerId, { x: number; y: number }>;
  platforms: Platform[];
  spikes: Spike[];
  buttons: ButtonPad[];
  gates: Gate[];
  teleporters: Teleporter[];
  doors: Door[];
  crate?: Crate;
  bosses?: Boss[];
};

type PlayerState = Actor & { id: PlayerId };
type GameState = {
  levelIndex: number;
  players: Record<PlayerId, PlayerState>;
  crate?: Crate;
  deaths: number;
  message: string;
  revealed: string[];
  disabled: string[];
  pressedButtons: string[];
  playerHp: Record<PlayerId, number>;
  invulnerableUntil: Record<PlayerId, number>;
  bossHp: Record<string, number>;
  attackUntil: Record<PlayerId, number>;
  arrows: Record<PlayerId, number>;
  projectiles: Projectile[];
  bossShots: BossFireball[];
  facing: Record<PlayerId, 1 | -1>;
  time: number;
};

type ControlState = Record<PlayerId, { left: boolean; right: boolean; jumpHeld: boolean; jumpQueued: number; attackQueued: boolean; shootQueued: boolean }>;

const worldWidth = 960;
const worldHeight = 520;
const playerSize = { width: 28, height: 36 };
const maxPlayerHp = 3;
const gravity = 0.75;
const moveSpeed = 4.2;
const jumpSpeed = 13.4;
const maxArrowCount = 8;
const levelMenuPageSize = 50;

export const totalLevelCount = 1000;

function createScalingBoss(levelNumber: number, id: string, baseName: string, x: number, y: number): Boss {
  const tier = Math.min(10, Math.floor((levelNumber - 1) / 10) + 1);
  const rankNames = ['Новичок', 'Крепкий', 'Опасный', 'Злой', 'Элитный', 'Тёмный', 'Адский', 'Мифический', 'Кошмарный', 'Финальный'];

  return {
    id,
    name: `${rankNames[tier - 1]} ${baseName}`,
    x,
    y: y - Math.min(28, tier * 2),
    width: Math.min(86, 50 + tier * 4),
    height: Math.min(96, 56 + tier * 5),
    amplitude: Math.min(72, 18 + tier * 5),
    speed: Math.max(12, 38 - tier * 3),
    hp: Math.min(80, 1 + tier + Math.floor(levelNumber / 8)),
  };
}

const handmadeLevels: Level[] = [
  {
    name: 'Уровень 1: Конфетный коридор',
    sign: 'Победи босса мечом на F. Дверь откроется только после боя.',
    joke: 'Пол сегодня работает полом. Редкий профессионал.',
    spawn: { p1: { x: 42, y: 314 }, p2: { x: 86, y: 314 } },
    platforms: [
      { id: 'candy-1-start', kind: 'solid', x: 0, y: 380, width: 300, height: 28 },
      { id: 'candy-1-mid-a', kind: 'solid', x: 348, y: 356, width: 144, height: 24 },
      { id: 'candy-1-mid-b', kind: 'solid', x: 542, y: 356, width: 144, height: 24 },
      { id: 'candy-1-exit', kind: 'solid', x: 742, y: 380, width: 212, height: 28 },
    ],
    spikes: [{ id: 'candy-1-spike', trigger: { type: 'button', buttonId: 'candy-1-btn' }, x: 250, y: 356, width: 40, height: 24 }],
    buttons: [{ id: 'candy-1-btn', label: 'NO', x: 190, y: 368, width: 42, height: 12 }],
    gates: [],
    teleporters: [],
    bosses: [createScalingBoss(1, 'candy-1-boss', 'Карамельный Страж', 704, 308)],
    doors: [{ id: 'candy-1-door', x: 902, y: 324, width: 40, height: 56 }],
  },
  {
    name: 'Уровень 2: Прыжки по мармеладу',
    sign: 'Доберись до босса, бей на F и не стой вплотную.',
    joke: 'Мармеладная архитектура держится на оптимизме.',
    spawn: { p1: { x: 42, y: 314 }, p2: { x: 86, y: 314 } },
    platforms: [
      { id: 'candy-2-start', kind: 'solid', x: 0, y: 380, width: 260, height: 28 },
      { id: 'candy-2-a', kind: 'solid', x: 320, y: 350, width: 138, height: 24 },
      { id: 'candy-2-b', kind: 'solid', x: 516, y: 326, width: 138, height: 24 },
      { id: 'candy-2-c', kind: 'solid', x: 710, y: 350, width: 118, height: 24 },
      { id: 'candy-2-exit', kind: 'solid', x: 862, y: 380, width: 92, height: 28 },
    ],
    spikes: [],
    buttons: [],
    gates: [],
    teleporters: [{ id: 'candy-2-tp', fake: true, x: 466, y: 344, width: 34, height: 34, to: { x: 62, y: 314 } }],
    bosses: [createScalingBoss(2, 'candy-2-boss', 'Мармеладный Рыцарь', 776, 288)],
    doors: [{ id: 'candy-2-door', x: 904, y: 324, width: 40, height: 56 }],
  },
  {
    name: 'Уровень 3: Кнопка для смелых',
    sign: 'Кнопка вредная, босс настоящий. Сначала бой, потом дверь.',
    joke: 'Инженер кнопки сказал: работает, значит трогать нельзя.',
    spawn: { p1: { x: 42, y: 314 }, p2: { x: 86, y: 314 } },
    platforms: [
      { id: 'candy-3-start', kind: 'solid', x: 0, y: 380, width: 330, height: 28 },
      { id: 'candy-3-a', kind: 'solid', x: 382, y: 356, width: 128, height: 24 },
      { id: 'candy-3-b', kind: 'solid', x: 558, y: 356, width: 128, height: 24 },
      { id: 'candy-3-exit', kind: 'solid', x: 738, y: 380, width: 216, height: 28 },
      { id: 'candy-3-vanish', kind: 'vanish', x: 526, y: 308, width: 72, height: 20 },
    ],
    spikes: [{ id: 'candy-3-spike', trigger: { type: 'button', buttonId: 'candy-3-btn' }, x: 284, y: 356, width: 42, height: 24 }],
    buttons: [{ id: 'candy-3-btn', label: 'TRY', x: 208, y: 368, width: 48, height: 12 }],
    gates: [],
    teleporters: [],
    bosses: [createScalingBoss(3, 'candy-3-boss', 'Желейный Дуэлянт', 704, 300)],
    doors: [{ id: 'candy-3-door', x: 904, y: 324, width: 40, height: 56 }],
  },
  {
    name: 'Уровень 4: Дверь-притворяшка',
    sign: 'Фейковая дверь отвлекает. Настоящий путь через победу над боссом.',
    joke: 'Фейковая дверь просит не судить её по поступкам.',
    spawn: { p1: { x: 42, y: 314 }, p2: { x: 86, y: 314 } },
    platforms: [
      { id: 'candy-4-start', kind: 'solid', x: 0, y: 380, width: 280, height: 28 },
      { id: 'candy-4-a', kind: 'solid', x: 336, y: 348, width: 132, height: 24 },
      { id: 'candy-4-b', kind: 'solid', x: 526, y: 348, width: 132, height: 24 },
      { id: 'candy-4-c', kind: 'solid', x: 716, y: 348, width: 102, height: 24 },
      { id: 'candy-4-exit', kind: 'solid', x: 854, y: 380, width: 100, height: 28 },
    ],
    spikes: [],
    buttons: [],
    gates: [],
    teleporters: [],
    bosses: [createScalingBoss(4, 'candy-4-boss', 'Пиксельный Привратник', 810, 294)],
    doors: [
      { id: 'candy-4-fake-door', fake: true, x: 746, y: 292, width: 40, height: 56 },
      { id: 'candy-4-door', x: 904, y: 324, width: 40, height: 56 },
    ],
  },
  {
    name: 'Уровень 5: Коробка-турист',
    sign: 'Коробка помогает держать дистанцию. Босса бей мечом на F.',
    joke: 'Коробка уже поставила себе пять звёзд.',
    spawn: { p1: { x: 42, y: 314 }, p2: { x: 86, y: 314 } },
    crate: { x: 224, y: 344, start: { x: 224, y: 344 }, width: 36, height: 36, vx: 0, vy: 0, onGround: false },
    platforms: [
      { id: 'candy-5-start', kind: 'solid', x: 0, y: 380, width: 340, height: 28 },
      { id: 'candy-5-a', kind: 'solid', x: 394, y: 354, width: 134, height: 24 },
      { id: 'candy-5-b', kind: 'solid', x: 582, y: 354, width: 134, height: 24 },
      { id: 'candy-5-exit', kind: 'solid', x: 772, y: 380, width: 182, height: 28 },
    ],
    spikes: [],
    buttons: [],
    gates: [],
    teleporters: [{ id: 'candy-5-tp', fake: true, x: 720, y: 344, width: 34, height: 34, to: { x: 64, y: 314 } }],
    bosses: [createScalingBoss(5, 'candy-5-boss', 'Коробочный Чемпион', 704, 300)],
    doors: [{ id: 'candy-5-door', x: 904, y: 324, width: 40, height: 56 }],
  },
  {
    name: 'Уровень 6: Сахарный рывок',
    sign: 'Босс быстрый, но пол остаётся полом. Бей на F.',
    joke: 'Арена сегодня честная: пол снизу, босс сверху.',
    spawn: { p1: { x: 42, y: 314 }, p2: { x: 86, y: 314 } },
    platforms: [
      { id: 'candy-6-start', kind: 'solid', x: 0, y: 380, width: 310, height: 28 },
      { id: 'candy-6-a', kind: 'solid', x: 366, y: 354, width: 138, height: 24 },
      { id: 'candy-6-ceiling', kind: 'solid', x: 430, y: 112, width: 150, height: 24 },
      { id: 'candy-6-b', kind: 'solid', x: 568, y: 354, width: 138, height: 24 },
      { id: 'candy-6-exit', kind: 'solid', x: 770, y: 380, width: 184, height: 28 },
    ],
    spikes: [],
    buttons: [],
    gates: [],
    teleporters: [],
    bosses: [createScalingBoss(6, 'candy-6-boss', 'Желейный Сторож', 704, 292)],
    doors: [{ id: 'candy-6-door', x: 904, y: 324, width: 40, height: 56 }],
  },
];

function createGeneratedLevel(levelNumber: number): Level {
  const variant = (levelNumber * 7 + Math.floor(levelNumber / 3)) % 12;
  const prefix = `candy-gen-${levelNumber}`;
  const seedA = (levelNumber * 37) % 64;
  const seedB = (levelNumber * 53) % 42;
  const seedC = (levelNumber * 29) % 36;
  const midY = 360 - (seedA % 4) * 8;
  const highY = 320 + (seedB % 4) * 10;
  const endY = 380;
  const startWidth = 268 + (seedA % 4) * 12;
  const platformAWidth = 116 + (seedB % 5) * 8;
  const platformBWidth = 116 + (seedC % 5) * 8;
  const platformCWidth = 100 + ((seedA + seedB) % 4) * 8;

  const platforms: Platform[] = [
    { id: `${prefix}-start`, kind: 'solid', x: 0, y: 380, width: startWidth, height: 28 },
    { id: `${prefix}-a`, kind: 'solid', x: 324 + (seedA % 28), y: midY, width: platformAWidth, height: 24 },
    { id: `${prefix}-b`, kind: 'solid', x: 510 + (seedB % 30), y: highY, width: platformBWidth, height: 24 },
    { id: `${prefix}-c`, kind: 'solid', x: 694 + (seedC % 28), y: midY + (seedC % 2) * 10, width: platformCWidth, height: 24 },
    { id: `${prefix}-exit`, kind: 'solid', x: 862, y: endY, width: 92, height: 28 },
  ];

  if (levelNumber > 14 && [2, 5, 8].includes(variant)) {
    platforms.push({ id: `${prefix}-vanish`, kind: 'vanish', x: 626 + (seedB % 34), y: midY - 44, width: 56 + (seedA % 3) * 10, height: 18 });
  }

  const buttons: ButtonPad[] = [];
  const spikes: Spike[] = [];

  if ([3, 6, 10].includes(variant)) {
    buttons.push({ id: `${prefix}-btn`, label: ['NO', 'ОЙ', '???'][levelNumber % 3], x: 188 + (seedA % 44), y: 368, width: 42, height: 12 });
    spikes.push({ id: `${prefix}-spike-btn`, trigger: { type: 'button', buttonId: `${prefix}-btn` }, x: 246 + (seedB % 42), y: 356, width: 38 + (seedC % 2) * 8, height: 24 });
  }

  if ([4, 9, 11].includes(variant)) {
    spikes.push({ id: `${prefix}-late-spike`, trigger: { type: 'playerX', player: 'p1', x: 560 + (seedA % 80) }, x: 298 + (seedC % 48), y: 356, width: 38 + (seedA % 2) * 8, height: 24 });
  }

  const teleporters: Teleporter[] =
    [1, 7].includes(variant)
      ? [{ id: `${prefix}-tp`, fake: true, x: 462 + (seedC % 52), y: 344, width: 34, height: 34, to: { x: 52 + (seedA % 44), y: 314 } }]
      : [];
  const bossNames = [
    'Сахарный Босс',
    'Карамельный Рыцарь',
    'Пиксельный Демон',
    'Мармеладный Титан',
    'Глазурный Страж',
    'Вафельный Маг',
    'Леденцовый Голем',
    'Кремовый Ниндзя',
    'Желейный Варвар',
    'Шоколадный Призрак',
    'Пончиковый Страж',
    'Пудровый Дракон',
  ];
  const bosses: Boss[] = [
    createScalingBoss(levelNumber, `${prefix}-boss`, bossNames[(levelNumber + variant) % bossNames.length], 724 + (seedA % 46), 286 + (seedB % 18)),
  ];

  return {
    name: `Уровень ${levelNumber}: ${['Карамельный мост', 'Сладкая башня', 'Пиксельная яма', 'Ледяной сироп', 'Шоколадный зал', 'Вафельный подъём'][levelNumber % 6]}`,
    sign:
      variant === 5
        ? 'Телепорт отвлекает. Каждые 10 уровней боссы получают новый ранг.'
        : 'Боссы постепенно получают больше HP, размер и скорость.',
    joke: levelNumber % 20 === 0 ? 'Юбилейный босс получил бонус к самоуверенности.' : 'Босс растёт по сложности, но всё ещё боится атак.',
    spawn: { p1: { x: 42, y: 314 }, p2: { x: 86, y: 314 } },
    platforms,
    spikes,
    buttons,
    gates: [],
    teleporters,
    bosses,
    doors: [{ id: `${prefix}-door`, x: 904, y: endY - 56, width: 40, height: 56 }],
  };
}

const generatedLevels = Array.from({ length: totalLevelCount - handmadeLevels.length }, (_, index) =>
  createGeneratedLevel(handmadeLevels.length + index + 1),
);

const levels: Level[] = [...handmadeLevels, ...generatedLevels];

function makePlayer(id: PlayerId, spawn: { x: number; y: number }): PlayerState {
  return { id, x: spawn.x, y: spawn.y, width: playerSize.width, height: playerSize.height, vx: 0, vy: 0, onGround: false };
}

function createBossHp(level: Level): Record<string, number> {
  return Object.fromEntries((level.bosses ?? []).map((boss) => [boss.id, boss.hp]));
}

function clampStat(value: number | undefined, max: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return max;
  return Math.max(0, Math.min(max, value));
}

function createState(levelIndex: number, deaths = 0, message = 'Победи босса мечом на F, потом иди в дверь.', saved?: SavedGameProgress | null): GameState {
  const level = levels[levelIndex];
  return {
    levelIndex,
    players: { p1: makePlayer('p1', level.spawn.p1), p2: makePlayer('p2', level.spawn.p2) },
    crate: level.crate ? { ...level.crate, start: { ...level.crate.start } } : undefined,
    deaths,
    message,
    revealed: [],
    disabled: [],
    pressedButtons: [],
    playerHp: {
      p1: clampStat(saved?.playerHp?.p1, maxPlayerHp),
      p2: clampStat(saved?.playerHp?.p2, maxPlayerHp),
    },
    invulnerableUntil: { p1: 0, p2: 0 },
    bossHp: createBossHp(level),
    attackUntil: { p1: 0, p2: 0 },
    arrows: {
      p1: clampStat(saved?.arrows?.p1, maxArrowCount),
      p2: clampStat(saved?.arrows?.p2, maxArrowCount),
    },
    projectiles: [],
    bossShots: [],
    facing: { p1: 1, p2: 1 },
    time: 0,
  };
}

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function triggerIsActive(trigger: Trigger, state: GameState, pressedButtons: string[]) {
  if (trigger.type === 'always') return true;
  if (trigger.type === 'button' || trigger.type === 'otherButton') return pressedButtons.includes(trigger.buttonId);
  return state.players[trigger.player].x > trigger.x;
}

function moveActor<T extends Actor>(actor: T, solids: Rect[]): T {
  const next = { ...actor };

  next.x = Math.max(0, Math.min(worldWidth - next.width, next.x + next.vx));
  for (const solid of solids) {
    if (!overlaps(next, solid)) continue;
    if (next.vx > 0) next.x = solid.x - next.width;
    if (next.vx < 0) next.x = solid.x + solid.width;
  }

  const previousY = next.y;
  next.y += next.vy;
  next.onGround = false;

  for (const solid of solids) {
    if (!overlaps(next, solid)) continue;
    if (next.vy >= 0 && previousY + next.height <= solid.y + 8) {
      next.y = solid.y - next.height;
      next.vy = 0;
      next.onGround = true;
    } else if (next.vy < 0) {
      next.y = solid.y + solid.height;
      next.vy = 0;
    } else if (next.vy > 0) {
      next.y = solid.y - next.height;
      next.vy = 0;
    }
  }

  return next;
}

function rectStyle(rect: Rect): CSSProperties {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}

function bossRect(boss: Boss, time: number): Rect {
  const phase = boss.id.length * 0.71;
  const walk = Math.sin(time / (boss.speed * 1.4) + phase) * Math.min(150, boss.amplitude * 1.9);

  return {
    ...boss,
    x: Math.max(36, Math.min(worldWidth - boss.width - 36, boss.x + walk)),
    y: boss.y + Math.sin(time / boss.speed) * boss.amplitude,
  };
}

function bossHurtRect(boss: Boss, time: number): Rect {
  const rect = bossRect(boss, time);
  return {
    x: rect.x - 18,
    y: rect.y - 36,
    width: rect.width + 36,
    height: rect.height + 84,
  };
}

function attackRect(player: PlayerState, facing: 1 | -1): Rect {
  return {
    x: facing === 1 ? player.x + player.width - 6 : player.x - 94,
    y: player.y - 54,
    width: 100,
    height: 104,
  };
}

function createProjectile(player: PlayerState, facing: 1 | -1, time: number): Projectile {
  return {
    id: `shot-${time}-${player.id}`,
    x: facing === 1 ? player.x + player.width : player.x - 20,
    y: player.y - 8,
    width: 20,
    height: 34,
    vx: facing * 12,
  };
}

function createBossFireball(boss: Boss, bossPosition: Rect, players: Record<PlayerId, PlayerState>, time: number): BossFireball {
  const bossCenter = { x: bossPosition.x + bossPosition.width / 2, y: bossPosition.y + bossPosition.height / 2 };
  const targets = [players.p1, players.p2];
  const target = targets.reduce((closest, player) => {
    const closestDistance = Math.abs(closest.x - bossCenter.x) + Math.abs(closest.y - bossCenter.y);
    const playerDistance = Math.abs(player.x - bossCenter.x) + Math.abs(player.y - bossCenter.y);
    return playerDistance < closestDistance ? player : closest;
  });
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const dx = targetCenter.x - bossCenter.x;
  const dy = targetCenter.y - bossCenter.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const speed = Math.min(7.2, 3.6 + boss.hp * 0.08);

  return {
    id: `fireball-${boss.id}-${time}`,
    x: bossCenter.x - 11,
    y: bossCenter.y - 11,
    width: 22,
    height: 22,
    vx: (dx / distance) * speed,
    vy: (dy / distance) * speed,
  };
}

function hasAliveBoss(level: Level, bossHp: Record<string, number>) {
  return (level.bosses ?? []).some((boss) => (bossHp[boss.id] ?? boss.hp) > 0);
}

function findAliveBoss(level: Level, bossHp: Record<string, number>) {
  return (level.bosses ?? []).find((boss) => (bossHp[boss.id] ?? boss.hp) > 0);
}

function damageBoss(bossHp: Record<string, number>, boss: Boss, damage: number) {
  return { ...bossHp, [boss.id]: Math.max(0, (bossHp[boss.id] ?? boss.hp) - damage) };
}

export function TrapPlatformerGame({ initialProgress, onProgressChange }: TrapPlatformerGameProps) {
  const [game, setGame] = useState<GameState>(() =>
    createState(Math.min(initialProgress?.levelIndex ?? 0, levels.length - 1), initialProgress?.deaths ?? 0, undefined, initialProgress),
  );
  const [levelInput, setLevelInput] = useState(String(Math.min(initialProgress?.levelIndex ?? 0, levels.length - 1) + 1));
  const [levelMenuOpen, setLevelMenuOpen] = useState(false);
  const [levelMenuPage, setLevelMenuPage] = useState(Math.floor(Math.min(initialProgress?.levelIndex ?? 0, levels.length - 1) / levelMenuPageSize));
  const controlsRef = useRef<ControlState>({
    p1: { left: false, right: false, jumpHeld: false, jumpQueued: 0, attackQueued: false, shootQueued: false },
    p2: { left: false, right: false, jumpHeld: false, jumpQueued: 0, attackQueued: false, shootQueued: false },
  });

  useEffect(() => {
    function setKey(event: KeyboardEvent, pressed: boolean) {
      const code = event.code;
      const controls = controlsRef.current;

      if (code === 'KeyA') controls.p1.left = pressed;
      if (code === 'KeyD') controls.p1.right = pressed;
      if (code === 'KeyW') {
        controls.p1.jumpHeld = pressed;
        if (pressed) controls.p1.jumpQueued = 10;
      }
      if (code === 'KeyF' && pressed) hitBossNow('p1', 'мечом');
      if (code === 'KeyG' && pressed) hitBossNow('p1', 'стрелой');
      if (code === 'ArrowLeft') controls.p2.left = pressed;
      if (code === 'ArrowRight') controls.p2.right = pressed;
      if (code === 'ArrowUp') {
        controls.p2.jumpHeld = pressed;
        if (pressed) controls.p2.jumpQueued = 10;
      }
      if (code === 'Enter' && pressed) hitBossNow('p2', 'мечом');
      if (code === 'ShiftRight' && pressed) hitBossNow('p2', 'стрелой');

      if (['KeyA', 'KeyD', 'KeyW', 'KeyF', 'KeyG', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Enter', 'ShiftRight'].includes(code)) event.preventDefault();
      if (pressed && code === 'KeyR') {
        event.preventDefault();
        restart();
      }
    }

    const keyDown = (event: KeyboardEvent) => setKey(event, true);
    const keyUp = (event: KeyboardEvent) => setKey(event, false);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setGame((current) => stepGame(current));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    onProgressChange?.({
      levelIndex: game.levelIndex,
      deaths: game.deaths,
      playerHp: game.playerHp,
      arrows: game.arrows,
    });
  }, [game.levelIndex, game.deaths, game.playerHp, game.arrows, onProgressChange]);

  function kill(state: GameState, text: string): GameState {
    return { ...createState(state.levelIndex, state.deaths + 1, text), revealed: state.revealed };
  }

  function damagePlayer(state: GameState, id: PlayerId, text: string): GameState {
    if (state.time < state.invulnerableUntil[id]) return state;
    const nextHp = Math.max(0, state.playerHp[id] - 1);
    if (nextHp === 0) return kill(state, `${text} HP закончились.`);

    return {
      ...state,
      playerHp: { ...state.playerHp, [id]: nextHp },
      invulnerableUntil: { ...state.invulnerableUntil, [id]: state.time + 70 },
      message: `${text} HP ${id === 'p1' ? 'красного' : 'синего'}: ${nextHp}/${maxPlayerHp}.`,
    };
  }

  function hitBossNow(id: PlayerId, weapon: 'мечом' | 'стрелой') {
    setGame((current) => {
      const level = levels[current.levelIndex];
      const boss = findAliveBoss(level, current.bossHp);
      const attackUntil = { ...current.attackUntil, [id]: current.time + 14 };
      const isArrowShot = weapon === 'стрелой';
      if (isArrowShot && current.arrows[id] <= 0) {
        return {
          ...current,
          attackUntil,
          message: `${id === 'p1' ? 'Красный' : 'Синий'} игрок потянулся к луку, но стрелы закончились.`,
        };
      }
      const arrows = isArrowShot ? { ...current.arrows, [id]: current.arrows[id] - 1 } : current.arrows;
      const projectiles =
        isArrowShot
          ? [...current.projectiles, createProjectile(current.players[id], current.facing[id], current.time)]
          : current.projectiles;

      if (!boss) {
        return {
          ...current,
          attackUntil,
          arrows,
          projectiles,
          message: 'Живых боссов нет. Дверь уже можно открыть.',
        };
      }

      const bossHp = damageBoss(current.bossHp, boss, 1);
      return {
        ...current,
        bossHp,
        attackUntil,
        arrows,
        projectiles,
        message:
          bossHp[boss.id] === 0
            ? `${boss.name} побеждён ${weapon} ${id === 'p1' ? 'красного' : 'синего'} игрока.`
            : `${boss.name} получил урон ${weapon}. HP: ${bossHp[boss.id]}/${boss.hp}.`,
      };
    });
  }

  function stepGame(state: GameState): GameState {
    const level = levels[state.levelIndex];
    const time = state.time + 1;
    let revealed = [...state.revealed];
    let disabled = [...state.disabled];
    let playerHp = { ...state.playerHp };
    let invulnerableUntil = { ...state.invulnerableUntil };
    let bossHp = { ...state.bossHp };
    let attackUntil = { ...state.attackUntil };
    let arrows = { ...state.arrows };
    let projectiles = state.projectiles.map((projectile) => ({ ...projectile, x: projectile.x + projectile.vx }));
    let bossShots = state.bossShots
      .map((shot) => ({ ...shot, x: shot.x + shot.vx, y: shot.y + shot.vy }))
      .filter((shot) => shot.x > -80 && shot.x < worldWidth + 80 && shot.y > -80 && shot.y < worldHeight + 80);
    let message = state.message;

    const gateSolids = level.gates.filter((gate) => !state.pressedButtons.includes(gate.buttonId));
    const platformSolids = level.platforms.filter((platform) => !disabled.includes(platform.id) && platform.kind !== 'fake');
    const solids: Rect[] = [...platformSolids, ...gateSolids];
    if (state.crate) solids.push(state.crate);

    const controls = controlsRef.current;
    let players: Record<PlayerId, PlayerState> = { p1: { ...state.players.p1 }, p2: { ...state.players.p2 } };
    const facing: Record<PlayerId, 1 | -1> = { ...state.facing };

    (['p1', 'p2'] as PlayerId[]).forEach((id) => {
      const player = players[id];
      const control = controls[id];
      player.vx = controls[id].left ? -moveSpeed : controls[id].right ? moveSpeed : 0;
      if (controls[id].left) facing[id] = -1;
      if (controls[id].right) facing[id] = 1;
      if ((control.jumpHeld || control.jumpQueued > 0) && player.onGround) {
        player.vy = -jumpSpeed;
        player.onGround = false;
        control.jumpQueued = 0;
      }
      control.jumpQueued = Math.max(0, control.jumpQueued - 1);
      player.vy = Math.max(-14, Math.min(14, player.vy + gravity));
      players[id] = moveActor(player, solids);
    });

    (['p1', 'p2'] as PlayerId[]).forEach((id) => {
      if (controls[id].attackQueued) {
        controls[id].attackQueued = false;
        attackUntil = { ...attackUntil, [id]: time + 14 };
        const boss = findAliveBoss(level, bossHp);
        if (boss) {
          bossHp = damageBoss(bossHp, boss, 1);
          message =
            bossHp[boss.id] === 0
              ? `${boss.name} побеждён мечом ${id === 'p1' ? 'красного' : 'синего'} игрока.`
              : `${boss.name} получил удар. HP: ${bossHp[boss.id]}/${boss.hp}.`;
        } else message = 'На уровне больше нет живого босса.';
      }

      if (controls[id].shootQueued) {
        controls[id].shootQueued = false;
        if (arrows[id] <= 0) {
          message = `${id === 'p1' ? 'Красный' : 'Синий'} игрок не выстрелил: стрелы закончились.`;
          return;
        }
        arrows = { ...arrows, [id]: arrows[id] - 1 };
        projectiles = [...projectiles, createProjectile(players[id], facing[id], time)];
        const boss = findAliveBoss(level, bossHp);
        if (boss) {
          bossHp = damageBoss(bossHp, boss, 1);
          message = bossHp[boss.id] === 0 ? `${boss.name} побеждён стрелой.` : `${boss.name} получил стрелу. HP: ${bossHp[boss.id]}/${boss.hp}.`;
        } else message = `${id === 'p1' ? 'Красный' : 'Синий'} выпустил стрелу, но живых боссов уже нет.`;
      }
    });

    const remainingProjectiles: Projectile[] = [];
    for (const projectile of projectiles) {
      if (projectile.x < -40 || projectile.x > worldWidth + 40) continue;
      let hit = false;
      for (const boss of level.bosses ?? []) {
        if ((bossHp[boss.id] ?? 0) <= 0 || !overlaps(projectile, bossHurtRect(boss, time))) continue;
        bossHp = { ...bossHp, [boss.id]: Math.max(0, (bossHp[boss.id] ?? boss.hp) - 1) };
        message = bossHp[boss.id] === 0 ? `${boss.name} побеждён стрелой.` : `${boss.name} получил стрелу. HP: ${bossHp[boss.id]}/${boss.hp}.`;
        hit = true;
        break;
      }
      if (!hit) remainingProjectiles.push(projectile);
    }
    projectiles = remainingProjectiles;

    for (const boss of level.bosses ?? []) {
      if ((bossHp[boss.id] ?? 0) <= 0) continue;
      const cooldown = Math.max(34, 94 - Math.floor(boss.hp * 1.6));
      const offset = boss.id.length % cooldown;
      if (time > 45 && time % cooldown === offset) {
        bossShots = [...bossShots, createBossFireball(boss, bossRect(boss, time), players, time)];
        message = `${boss.name} выпустил огненный шар. Лучше не ловить лицом.`;
      }
    }

    for (const shot of bossShots) {
      for (const id of ['p1', 'p2'] as PlayerId[]) {
        if (!overlaps(players[id], shot)) continue;
        bossShots = bossShots.filter((currentShot) => currentShot.id !== shot.id);
        return damagePlayer(
          { ...state, players, crate: state.crate, revealed, disabled, pressedButtons: state.pressedButtons, playerHp, invulnerableUntil, bossHp, attackUntil, arrows, projectiles, bossShots, facing, time, message },
          id,
          'Огненный шар босса попал в игрока.',
        );
      }
    }

    let crate = state.crate ? { ...state.crate, start: { ...state.crate.start } } : undefined;
    if (crate) {
      crate.vx = 0;
      (['p1', 'p2'] as PlayerId[]).forEach((id) => {
        const player = players[id];
        if (!crate || !overlaps(player, crate)) return;
        if (player.vx > 0) {
          crate.vx = moveSpeed * 0.82;
          player.x = crate.x - player.width;
        }
        if (player.vx < 0) {
          crate.vx = -moveSpeed * 0.82;
          player.x = crate.x + crate.width;
        }
      });
      crate.vy = Math.min(14, crate.vy + gravity);
      crate = moveActor(crate, [...platformSolids, ...gateSolids]);
    }

    const pressedButtons = level.buttons
      .filter((button) => [players.p1, players.p2, crate].some((thing) => thing !== undefined && overlaps(thing, button)))
      .map((button) => button.id);

    for (const platform of level.platforms) {
      if (platform.kind === 'solid' || disabled.includes(platform.id)) continue;
      const touchedBy = [players.p1, players.p2].find((player) => overlaps(player, platform));
      if (!touchedBy) continue;
      revealed = unique([...revealed, platform.id]);
      if (platform.kind === 'fake') return kill({ ...state, revealed, disabled }, 'Платформа сказала: “я вообще-то картонная”.');
      disabled = unique([...disabled, platform.id]);
      return { ...state, players, crate, revealed, disabled, pressedButtons, arrows, projectiles, bossShots, time, message: 'Платформа исчезла. Быстро, пока она не сделала вид, что так и надо.' };
    }

    for (const spike of level.spikes) {
      if (triggerIsActive(spike.trigger, { ...state, players }, pressedButtons)) revealed = unique([...revealed, spike.id]);
      if (!revealed.includes(spike.id)) continue;
      for (const id of ['p1', 'p2'] as PlayerId[]) {
        if (!overlaps(players[id], spike)) continue;
        return damagePlayer(
          { ...state, players, crate, revealed, disabled, pressedButtons, playerHp, invulnerableUntil, bossHp, attackUntil, arrows, projectiles, bossShots, facing, time, message },
          id,
          'Шипы царапнули игрока.',
        );
      }
    }

    for (const button of level.buttons) {
      if (button.badFor && pressedButtons.includes(button.id) && overlaps(players[button.badFor], button)) {
        return damagePlayer(
          { ...state, players, crate, revealed, disabled, pressedButtons, playerHp, invulnerableUntil, bossHp, attackUntil, arrows, projectiles, bossShots, facing, time, message },
          button.badFor,
          'Кнопка больно щёлкнула.',
        );
      }
    }

    for (const teleporter of level.teleporters) {
      for (const id of ['p1', 'p2'] as PlayerId[]) {
        if (!overlaps(players[id], teleporter)) continue;
        revealed = unique([...revealed, teleporter.id]);
        players[id] = { ...players[id], x: teleporter.to.x, y: teleporter.to.y, vx: 0, vy: 0 };
        return { ...state, players, crate, revealed, disabled, pressedButtons, arrows, projectiles, bossShots, time, message: teleporter.fake ? 'Телепорт сработал. Польза не входила в комплект.' : 'Телепорт перекинул вас дальше. Не благодарите его слишком рано.' };
      }
    }

    for (const boss of level.bosses ?? []) {
      if ((bossHp[boss.id] ?? 0) <= 0) continue;
      for (const id of ['p1', 'p2'] as PlayerId[]) {
        if (!overlaps(players[id], bossRect(boss, time))) continue;
        return damagePlayer(
          { ...state, players, crate, revealed, disabled, pressedButtons, playerHp, invulnerableUntil, bossHp, attackUntil, arrows, projectiles, bossShots, facing, time, message },
          id,
          `${boss.name} ударил игрока.`,
        );
      }
    }

    for (const door of level.doors) {
      const visitors = [players.p1, players.p2].filter((player) => overlaps(player, door));
      if (door.fake && visitors.length > 0) return kill({ ...state, revealed }, 'Ложная дверь открылась прямо в чувство стыда.');
      if (!door.fake && overlaps(players.p1, door)) {
        if (hasAliveBoss(level, bossHp)) {
          return {
            ...state,
            players,
            crate,
            revealed,
            disabled,
            pressedButtons,
            playerHp,
            invulnerableUntil,
            bossHp,
            attackUntil,
            arrows,
            projectiles,
            bossShots,
            facing,
            time,
            message: 'Дверь закрыта. Сначала победи босса мечом на F.',
          };
        }
        if (state.levelIndex >= levels.length - 1) {
          return { ...state, players, crate, revealed, disabled, pressedButtons, playerHp, invulnerableUntil, bossHp, attackUntil, arrows, projectiles, bossShots, facing, time, message: 'Все 1000 уровней пройдены. Повторов больше нет.' };
        }

        const nextLevel = state.levelIndex + 1;
        return createState(nextLevel, state.deaths, `${level.name} пройден. Следующая комната уже хихикает.`);
      }
    }

    if ([players.p1, players.p2].some((player) => player.y > worldHeight + 60 || player.y < -90)) {
      return kill({ ...state, revealed, disabled }, 'Один игрок улетел проверять границы карты.');
    }

    return {
      ...state,
      players,
      crate,
      revealed,
      disabled,
      pressedButtons,
      playerHp,
      invulnerableUntil,
      bossHp,
      attackUntil,
      arrows,
      projectiles,
      bossShots,
      facing,
      time,
      message,
    };
  }

  function restart() {
    setGame((current) => createState(current.levelIndex, current.deaths, 'Респавн. Уровень сделал вид, что ничего не было.'));
  }

  function jumpToLevelIndex(levelIndex: number, message: string) {
    const nextLevelIndex = Math.max(0, Math.min(levels.length - 1, levelIndex));
    setLevelInput(String(nextLevelIndex + 1));
    setLevelMenuPage(Math.floor(nextLevelIndex / levelMenuPageSize));
    setGame((current) => createState(nextLevelIndex, current.deaths, message));
  }

  function goPreviousLevel() {
    setGame((current) => {
      if (current.levelIndex <= 0) return { ...current, message: 'Это первый уровень. Ниже только меню и воспоминания.' };
      const nextLevelIndex = current.levelIndex - 1;
      setLevelInput(String(nextLevelIndex + 1));
      setLevelMenuPage(Math.floor(nextLevelIndex / levelMenuPageSize));
      return createState(nextLevelIndex, current.deaths, `Переход на уровень ${nextLevelIndex + 1}.`);
    });
  }

  function goNextLevel() {
    setGame((current) => {
      if (current.levelIndex >= levels.length - 1) return { ...current, message: 'Это последний уровень. Повторов больше не будет.' };
      const nextLevelIndex = current.levelIndex + 1;
      setLevelInput(String(nextLevelIndex + 1));
      setLevelMenuPage(Math.floor(nextLevelIndex / levelMenuPageSize));
      return createState(nextLevelIndex, current.deaths, 'Новая комната. Сомневайтесь в геометрии.');
    });
  }

  function goToLevel() {
    const levelNumber = Number.parseInt(levelInput, 10);
    if (Number.isNaN(levelNumber)) {
      setGame((current) => ({ ...current, message: 'Напиши номер уровня от 1 до 1000.' }));
      return;
    }

    const nextLevelIndex = Math.max(0, Math.min(levels.length - 1, levelNumber - 1));
    const nextLevelNumber = nextLevelIndex + 1;
    jumpToLevelIndex(nextLevelIndex, `Переход на уровень ${nextLevelNumber}. Босс уже делает разминку.`);
  }

  const level = levels[game.levelIndex];
  const activeGates = useMemo(() => level.gates.filter((gate) => !game.pressedButtons.includes(gate.buttonId)), [game.pressedButtons, level.gates]);
  const activeBoss = (level.bosses ?? []).find((boss) => (game.bossHp[boss.id] ?? 0) > 0);
  const levelMenuPageCount = Math.ceil(levels.length / levelMenuPageSize);
  const levelMenuStart = levelMenuPage * levelMenuPageSize;
  const visibleLevelIndexes = Array.from(
    { length: Math.min(levelMenuPageSize, levels.length - levelMenuStart) },
    (_, index) => levelMenuStart + index,
  );

  return (
    <main className="trap-page">
      <section className="trap-hero">
        <p>
          {level.name} · {game.levelIndex + 1}/{levels.length}
        </p>
        <h1>Toy Trap Run</h1>
      </section>

      <section className="trap-stage" aria-label="Кооперативный 2D-платформер">
        <div className="trap-wall" />
        <article className="trap-sign">
          <span>Совет</span>
          <strong>{level.sign}</strong>
        </article>

        {(['p1', 'p2'] as PlayerId[]).map((id) => (
          <div
            className={`trap-player ${id} ${game.time < game.invulnerableUntil[id] ? 'hurt' : ''}`}
            key={id}
            style={{ '--player-x': `${game.players[id].x}px`, '--player-y': `${game.players[id].y}px` } as CSSProperties}
          >
            <span className="player-hp-frame">
              <span className="player-hp-fill" style={{ width: `${(game.playerHp[id] / maxPlayerHp) * 100}%` }} />
            </span>
            <span className="trap-head" />
            <span className="trap-body" />
            <span className="trap-leg left" />
            <span className="trap-leg right" />
            <span className={`trap-weapon sword ${game.facing[id] === -1 ? 'left' : 'right'}`} />
            <span className={`trap-weapon blaster ${game.facing[id] === -1 ? 'left' : 'right'}`} />
          </div>
        ))}

        {(['p1', 'p2'] as PlayerId[]).map((id) =>
          game.time < game.attackUntil[id] ? (
            <div className={`world-attack ${id}`} key={id} style={rectStyle(attackRect(game.players[id], game.facing[id]))} />
          ) : null,
        )}

        {game.projectiles.map((projectile) => (
          <div className="world-projectile" key={projectile.id} style={rectStyle(projectile)} />
        ))}

        {game.bossShots.map((shot) => (
          <div className="world-boss-fireball" key={shot.id} style={rectStyle(shot)} />
        ))}

        {game.crate && <div className="world-crate" style={rectStyle(game.crate)} />}

        {level.platforms.map((platform) => (
          <div
            className={`world-platform ${platform.kind} ${game.revealed.includes(platform.id) || game.disabled.includes(platform.id) ? 'revealed' : ''}`}
            key={platform.id}
            style={rectStyle(platform)}
          />
        ))}

        {level.buttons.map((button) => (
          <div className={`world-button ${game.pressedButtons.includes(button.id) ? 'pressed' : ''}`} key={button.id} style={rectStyle(button)}>
            {button.label}
          </div>
        ))}

        {activeGates.map((gate) => (
          <div className="moving-wall" key={gate.id} style={rectStyle(gate)} />
        ))}

        {level.spikes.map((spike) => (
          <div className={`world-spike ${game.revealed.includes(spike.id) ? 'revealed' : ''}`} key={spike.id} style={rectStyle(spike)} />
        ))}

        {level.teleporters.map((teleporter) => (
          <div className={`world-teleporter ${game.revealed.includes(teleporter.id) ? 'used' : ''}`} key={teleporter.id} style={rectStyle(teleporter)} />
        ))}

        {(level.bosses ?? [])
          .filter((boss) => (game.bossHp[boss.id] ?? 0) > 0)
          .map((boss) => (
            <div className="world-boss" key={boss.id} style={rectStyle(bossRect(boss, game.time))}>
              <span className="world-boss-hp" style={{ width: `${((game.bossHp[boss.id] ?? boss.hp) / boss.hp) * 100}%` }} />
              <span className="world-boss-eye left" />
              <span className="world-boss-eye right" />
              <span className="world-boss-mouth" />
            </div>
          ))}

        {level.doors.map((door) => (
          <div className={`trap-door ${door.fake ? 'fake-door' : ''}`} key={door.id} style={rectStyle(door)} />
        ))}
      </section>

      <section className="trap-panel">
        <article>
          <span>Статус</span>
          <h2>{game.message}</h2>
          <p>
            Смерти: {game.deaths} · {activeBoss ? `${activeBoss.name}: ${game.bossHp[activeBoss.id]}/${activeBoss.hp} HP · ` : ''}{level.joke}
          </p>
        </article>

        <div className="trap-actions">
          <button onClick={restart} type="button">Заново</button>
          <button className="secondary-action" onClick={() => setLevelMenuOpen((open) => !open)} type="button">
            Уровни
          </button>
          <button className="secondary-action" onClick={goPreviousLevel} type="button">Назад</button>
          <button className="secondary-action" onClick={goNextLevel} type="button">Следующий</button>
          <button onClick={() => jumpToLevelIndex(game.levelIndex - 10, 'Прыгнули на 10 уровней назад.')} type="button">-10</button>
          <button onClick={() => jumpToLevelIndex(game.levelIndex + 10, 'Прыгнули на 10 уровней вперёд.')} type="button">+10</button>
          <label className="level-jump">
            <span>Уровень</span>
            <input
              min="1"
              max={levels.length}
              onChange={(event) => setLevelInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') goToLevel();
              }}
              type="number"
              value={levelInput}
            />
          </label>
          <button className="secondary-action" onClick={goToLevel} type="button">Перейти</button>
          <button onClick={() => hitBossNow('p1', 'мечом')} type="button">P1 удар</button>
          <button className="secondary-action" onClick={() => hitBossNow('p1', 'стрелой')} type="button">P1 стрела</button>
          <button onClick={() => hitBossNow('p2', 'мечом')} type="button">P2 удар</button>
          <button className="secondary-action" onClick={() => hitBossNow('p2', 'стрелой')} type="button">P2 стрела</button>
        </div>

        <article className="trap-help">
          <span>Клавиши</span>
          <strong>
            Игрок 1: WASD, F — удар, G — стрела ({game.arrows.p1}/{maxArrowCount}) · Игрок 2: ← ↑ →, Enter — удар, Right Shift — стрела ({game.arrows.p2}/{maxArrowCount}) · R — респавн.
          </strong>
        </article>
      </section>

      {levelMenuOpen && (
        <section className="level-menu" aria-label="Меню уровней">
          <div className="level-menu-head">
            <article>
              <span>Меню уровней</span>
              <strong>
                {levelMenuStart + 1}-{Math.min(levelMenuStart + levelMenuPageSize, levels.length)} из {levels.length}
              </strong>
            </article>
            <div className="level-menu-pager">
              <button
                className="secondary-action"
                disabled={levelMenuPage === 0}
                onClick={() => setLevelMenuPage((page) => Math.max(0, page - 1))}
                type="button"
              >
                -50
              </button>
              <button
                className="secondary-action"
                disabled={levelMenuPage >= levelMenuPageCount - 1}
                onClick={() => setLevelMenuPage((page) => Math.min(levelMenuPageCount - 1, page + 1))}
                type="button"
              >
                +50
              </button>
              <button onClick={() => setLevelMenuOpen(false)} type="button">Закрыть</button>
            </div>
          </div>

          <div className="level-grid">
            {visibleLevelIndexes.map((levelIndex) => (
              <button
                className={`level-tile ${levelIndex === game.levelIndex ? 'active' : ''}`}
                key={levelIndex}
                onClick={() => {
                  jumpToLevelIndex(levelIndex, `Выбран уровень ${levelIndex + 1}.`);
                  setLevelMenuOpen(false);
                }}
                type="button"
              >
                {levelIndex + 1}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
