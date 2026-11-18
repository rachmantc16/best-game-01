// entities.js — factories for everything that flies, falls or explodes, plus the
// self-contained updates for particles, floating score text and power-up orbs.
// Movement and combat for ships live in game.js, which owns the state they act on.

export const WORLD = { width: 960, height: 600 };

/** Enemy archetypes: hit points, radius, base fall speed and score value. */
export const ENEMY_STATS = {
  drifter: { hp: 1, radius: 15, speed: 70, score: 100 },
  weaver: { hp: 2, radius: 14, speed: 95, score: 150 },
  diver: { hp: 1, radius: 13, speed: 165, score: 200 },
  tank: { hp: 7, radius: 27, speed: 38, score: 400 },
};

export const POWERUP_KINDS = [
  { kind: 'rapid', letter: 'R', color: '#ffd166', label: 'RAPID FIRE' },
  { kind: 'spread', letter: 'S', color: '#40e0ff', label: 'SPREAD SHOT' },
  { kind: 'shield', letter: 'O', color: '#7dffcb', label: 'SHIELD' },
  { kind: 'life', letter: '+', color: '#ff8fab', label: 'EXTRA LIFE' },
];

export function makePlayer() {
  return {
    x: WORLD.width / 2,
    y: WORLD.height - 72,
    radius: 16,
    speed: 540,
    fireTimer: 0,
    invuln: 0,
    shield: false,
    rapid: 0,
    spread: 0,
    dead: false,
    tilt: 0,
  };
}

/** A falling enemy of a kind, entering at (x, y); wave scales its toughness and pace. */
export function spawnEnemy(kind, x, y, rng, wave) {
  const stats = ENEMY_STATS[kind];
  const hpScale = 1 + Math.floor((wave - 1) / 4);
  return {
    kind,
    x,
    y,
    baseX: x,
    radius: stats.radius,
    hp: kind === 'tank' ? stats.hp + hpScale : stats.hp,
    maxHp: kind === 'tank' ? stats.hp + hpScale : stats.hp,
    vy: stats.speed * rng.range(0.85, 1.2) * (1 + (wave - 1) * 0.045),
    vx: 0,
    phase: rng.range(0, Math.PI * 2),
    sway: rng.range(24, 54),
    flipTimer: rng.range(0.5, 1.1),
    score: stats.score,
    flash: 0,
    age: 0,
  };
}

/** The wave-5/10 Dreadnought. Its behaviour (strafing, volleys, minions) lives in game.js. */
export function spawnBoss(wave) {
  const hp = 90 + wave * 22;
  return {
    kind: 'boss',
    x: WORLD.width / 2,
    y: -90,
    radius: 62,
    hp,
    maxHp: hp,
    score: 5000,
    phase: 0,
    entered: false,
    radialTimer: 2.2,
    volleyTimer: 1.2,
    minionTimer: 3.5,
    flash: 0,
    age: 0,
  };
}

export function spawnBolt(x, y, vx, vy) {
  return { x, y, vx, vy, radius: 5, dead: false };
}

export function spawnOrb(x, y, vx, vy) {
  return { x, y, vx, vy, radius: 6, dead: false };
}

/** A power-up orb; kind is weighted so extra lives stay rare. */
export function spawnPowerup(x, y, rng, forceKind = null) {
  let def;
  if (forceKind) {
    def = POWERUP_KINDS.find((p) => p.kind === forceKind);
  } else {
    const roll = rng.float();
    def = roll < 0.36 ? POWERUP_KINDS[0] : roll < 0.68 ? POWERUP_KINDS[1] : roll < 0.93 ? POWERUP_KINDS[2] : POWERUP_KINDS[3];
  }
  return { ...def, x, y, vy: 92, radius: 15, age: 0, dead: false };
}

export function updatePowerups(list, dt) {
  for (const p of list) {
    p.y += p.vy * dt;
    p.age += dt;
    if (p.y > WORLD.height + 24) p.dead = true;
  }
}

/** An explosion: a flash, a ring and a spray of sparks in the given palette. */
export function burst(list, x, y, rng, { count = 18, colors = ['#ffd166', '#ff7043', '#ffffff'], speed = 260, life = 0.55, size = 3 } = {}) {
  list.push({ kind: 'flash', x, y, r: 6, vr: 340, age: 0, life: 0.18, color: colors[0] });
  list.push({ kind: 'ring', x, y, r: 4, vr: 420, age: 0, life: 0.32, color: colors[1] ?? colors[0] });
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const v = rng.range(speed * 0.25, speed);
    list.push({
      kind: 'spark',
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - 40,
      r: rng.range(size * 0.5, size * 1.4),
      age: 0,
      life: rng.range(life * 0.5, life),
      color: colors[rng.int(0, colors.length - 1)],
    });
  }
}

/** Gentle engine exhaust and ambient embers share the particle list with explosions. */
export function trailPuff(list, x, y, rng) {
  list.push({
    kind: 'spark',
    x: x + rng.range(-3, 3),
    y,
    vx: rng.range(-12, 12),
    vy: rng.range(60, 110),
    r: rng.range(1.2, 2.6),
    age: 0,
    life: rng.range(0.2, 0.42),
    color: rng.chance(0.6) ? '#ffb347' : '#40e0ff',
  });
}

export function updateParticles(list, dt) {
  for (const p of list) {
    p.age += dt;
    if (p.kind === 'spark') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    } else {
      p.r += p.vr * dt;
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].age >= list[i].life) list.splice(i, 1);
  }
}

/** A floating score popup, e.g. "+300 x4", drifting up and fading. */
export function spawnFloater(list, x, y, text, color = '#eafcff') {
  list.push({ x, y, text, color, age: 0, life: 0.9 });
}

export function updateFloaters(list, dt) {
  for (const f of list) {
    f.y -= 44 * dt;
    f.age += dt;
  }
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].age >= list[i].life) list.splice(i, 1);
  }
}

/** Circle overlap, the one collision shape the whole game uses. */
export function overlaps(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy < r * r;
}
