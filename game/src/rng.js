// rng.js — one small deterministic random stream for the whole game.
// A seeded stream means a link with ?seed= replays the same sky, the same waves and the
// same screenshot scenes every time, while a plain visit seeds from the clock.

/** mulberry32: a tiny, fast, seedable PRNG. Returns a function giving floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Friendly wrapper over a random stream: ranges, integers, picks and chances. */
export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }

  /** Float in [0, 1). */
  float() {
    return this.next();
  }

  /** Float in [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max], both ends included. */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** One element of a non-empty array. */
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  /** True with probability p. */
  chance(p) {
    return this.next() < p;
  }

  /** -1 or 1, coin flip. */
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
}
