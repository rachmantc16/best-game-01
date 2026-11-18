// waves.js — the spawn director. Each wave is a queue of enemies dealt out on a timer;
// the mix widens and the pace quickens as waves climb, and every fifth wave is a boss
// wave, where the Dreadnought comes itself and only trickles minions behind it.

import { WORLD } from './entities.js';

/** The enemy mix for a wave: new kinds arrive on a schedule, then everything scales. */
export function waveComposition(wave, rng) {
  const list = [];
  const drifters = 5 + wave;
  const weavers = wave >= 2 ? 2 + Math.floor(wave * 0.8) : 0;
  const divers = wave >= 3 ? Math.floor(wave * 0.9) : 0;
  const tanks = wave >= 4 ? Math.floor((wave - 2) / 2) : 0;
  const add = (kind, n) => {
    for (let i = 0; i < n; i++) list.push(kind);
  };
  add('drifter', drifters);
  add('weaver', weavers);
  add('diver', divers);
  add('tank', tanks);
  // shuffle so kinds interleave instead of arriving in blocks
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** A short line for the wave banner, naming what is coming. */
export function waveSubtitle(wave) {
  if (wave % 5 === 0) return 'WARNING — DREADNOUGHT APPROACHES';
  if (wave === 2) return 'WEAVERS INBOUND';
  if (wave === 3) return 'DIVERS INBOUND';
  if (wave === 4) return 'ARMORED TANKS INBOUND';
  if (wave === 1) return 'STOP THE FALL — GUARD THE LINE';
  return 'THE FALL THICKENS';
}

export class WaveDirector {
  constructor(rng) {
    this.rng = rng;
    this.queue = [];
    this.timer = 0;
    this.interval = 1;
    this.bossWave = false;
    this.minionTimer = 4;
  }

  /** Begin a wave: build its queue (boss waves have none; the game spawns the boss). */
  startWave(wave) {
    this.bossWave = wave % 5 === 0;
    this.queue = this.bossWave ? [] : waveComposition(wave, this.rng);
    this.interval = Math.max(0.38, 1.05 - wave * 0.055);
    this.timer = 0.4;
    this.minionTimer = 4;
  }

  /** True when every queued enemy has been dealt out. */
  get dealt() {
    return this.queue.length === 0;
  }

  get remaining() {
    return this.queue.length;
  }

  /**
   * Deal out due enemies through spawn(kind, x). During a boss wave, deal a slow
   * trickle of minions instead, capped by how many are already alive.
   */
  update(dt, spawn, aliveCount) {
    if (this.bossWave) {
      this.minionTimer -= dt;
      if (this.minionTimer <= 0 && aliveCount < 4) {
        this.minionTimer = this.rng.range(3.2, 5);
        spawn(this.rng.chance(0.7) ? 'drifter' : 'weaver', this.rng.range(70, WORLD.width - 70));
      }
      return;
    }
    if (this.queue.length === 0) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.interval * this.rng.range(0.7, 1.3);
      const kind = this.queue.shift();
      spawn(kind, this.rng.range(56, WORLD.width - 56));
    }
  }
}
