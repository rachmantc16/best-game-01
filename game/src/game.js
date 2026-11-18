// game.js — Starfall Defender itself: the state machine and every rule.
// States: title, playing, paused, gameover, victory. Enemies fall from the top of the
// sky; the player guards the line at the bottom. Kills build a combo multiplier, orbs
// grant power-ups, a Dreadnought ends every fifth wave, and clearing wave 10 wins —
// unless the player chooses endless mode and flies on.

import { Rng } from './rng.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { buildSprites } from './sprites.js';
import { Renderer } from './render.js';
import { WaveDirector, waveSubtitle } from './waves.js';
import {
  WORLD,
  makePlayer,
  spawnEnemy,
  spawnBoss,
  spawnBolt,
  spawnOrb,
  spawnPowerup,
  updatePowerups,
  burst,
  trailPuff,
  updateParticles,
  spawnFloater,
  updateFloaters,
  overlaps,
} from './entities.js';

const ENEMY_COLORS = {
  drifter: ['#ff4fd8', '#ff9df0', '#ffffff'],
  weaver: ['#b26bff', '#d3a6ff', '#ffffff'],
  diver: ['#ff7043', '#ffb347', '#ffffff'],
  tank: ['#ffb347', '#ffd98a', '#ffffff'],
  boss: ['#ff3b6b', '#ffd166', '#ffffff'],
};
const FINAL_WAVE = 10;

export class Game {
  constructor(canvas, { shot = null, seed = 1 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = buildSprites();
    this.renderer = new Renderer(this.ctx, this.sprites);
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.rng = new Rng(seed * 7919 + 13);
    this.director = new WaveDirector(this.rng);
    this.shotMode = shot;
    this.autoFire = false;

    this.stars = [];
    for (let i = 0; i < 140; i++) {
      const depth = this.rng.float();
      this.stars.push({
        x: this.rng.range(0, WORLD.width),
        y: this.rng.range(0, WORLD.height),
        depth,
        size: depth > 0.8 ? 2 : 1,
        twinkle: this.rng.range(0.6, 2.4),
        phase: this.rng.range(0, Math.PI * 2),
      });
    }

    this.time = 0;
    this.starScroll = 0;
    this.hiScore = 0;
    this.state = 'title';
    this.titleTimer = 0;
    this.reset();
    this.player.dead = true; // no ship on the title screen
    if (shot) this.setupShot(shot);
  }

  /** Fresh run state; also used to clear the field between scenes. */
  reset() {
    this.player = makePlayer();
    this.bolts = [];
    this.enemyBolts = [];
    this.enemies = [];
    this.particles = [];
    this.floaters = [];
    this.powerups = [];
    this.boss = null;
    this.score = 0;
    this.lives = 3;
    this.wave = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboWindow = 2.2;
    this.bestMultiplier = 1;
    this.shake = 0;
    this.flashRed = 0;
    this.banner = null;
    this.phase = 'fight';
    this.betweenTimer = 0;
    this.dyingTimer = 0;
    this.trailTimer = 0;
    this.endless = false;
  }

  multiplier() {
    return Math.min(8, 1 + Math.floor(this.combo / 12));
  }

  start() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.render();
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  startRun() {
    this.reset();
    this.state = 'playing';
    this.nextWave();
  }

  nextWave() {
    this.wave += 1;
    this.phase = 'fight';
    this.director.startWave(this.wave);
    this.showBanner(`WAVE ${this.wave}`, waveSubtitle(this.wave));
    if (this.director.bossWave) {
      this.boss = spawnBoss(this.wave);
      this.enemies.push(this.boss);
      this.sound.bossWarn();
    }
  }

  showBanner(title, sub, total = 2.2) {
    this.banner = { title, sub, t: total, total };
  }

  addEnemy(kind, x, y = -30) {
    const enemy = spawnEnemy(kind, x, y, this.rng, Math.max(1, this.wave));
    this.enemies.push(enemy);
    return enemy;
  }

  addScore(points, x, y, showText = true) {
    this.score += points;
    if (this.score > this.hiScore) this.hiScore = this.score;
    if (showText) spawnFloater(this.floaters, x, y, `+${points}`, '#cfe9ff');
  }

  // ------------------------------------------------------------- update

  update(dt) {
    this.time += dt;
    this.starScroll += dt * (this.state === 'playing' ? 30 : 10);
    if (this.banner) this.banner.t -= dt;
    this.flashRed = Math.max(0, this.flashRed - dt * 2.2);
    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.input.mouse.down || this.input.pressed.size > 0) this.sound.unlock();
    if (this.input.takePress('KeyM')) this.sound.toggleMute();
    this.sound.updateMusic(this.state === 'playing' || this.state === 'title');

    if (this.state === 'title') {
      this.updateTitle(dt);
      if (this.input.takeStartGesture()) this.startRun();
    } else if (this.state === 'playing') {
      if (this.input.takePress('KeyP') || this.input.takePress('Escape')) {
        this.state = 'paused';
      } else {
        this.updatePlaying(dt);
      }
    } else if (this.state === 'paused') {
      if (this.input.takePress('KeyP') || this.input.takePress('Escape')) this.state = 'playing';
    } else if (this.state === 'gameover') {
      this.updateAftermath(dt);
      if (this.input.takeStartGesture()) this.startRun();
    } else if (this.state === 'victory') {
      this.updateAftermath(dt);
      if (this.input.takePress('KeyC')) {
        this.endless = true;
        this.state = 'playing';
        this.phase = 'between';
        this.betweenTimer = 1.4;
      } else if (this.input.takeStartGesture()) {
        this.startRun();
      }
    }
  }

  /** Title screen life: a few fallers drift past the logo, purely decorative. */
  updateTitle(dt) {
    this.titleTimer -= dt;
    if (this.titleTimer <= 0 && this.enemies.length < 5) {
      this.titleTimer = 1.5;
      const kind = this.rng.pick(['drifter', 'weaver', 'drifter']);
      this.addEnemy(kind, this.rng.range(70, WORLD.width - 70));
    }
    for (const e of this.enemies) {
      e.age += dt;
      e.y += e.vy * 0.45 * dt;
      e.x = e.baseX + Math.sin(e.age * 1.6 + e.phase) * e.sway * 0.6;
    }
    this.enemies = this.enemies.filter((e) => e.y < WORLD.height + 50);
    updateParticles(this.particles, dt);
  }

  /** End screens keep the sky alive behind the panel: falling wrecks and embers. */
  updateAftermath(dt) {
    for (const e of this.enemies) {
      e.age += dt;
      e.y += e.vy * 0.35 * dt;
    }
    this.enemies = this.enemies.filter((e) => e.y < WORLD.height + 60);
    updateParticles(this.particles, dt);
    updateFloaters(this.floaters, dt);
  }

  updatePlaying(dt) {
    const player = this.player;

    if (player.dead) {
      // the death pause: wreckage settles, then the game-over screen
      this.dyingTimer -= dt;
      updateParticles(this.particles, dt);
      updateFloaters(this.floaters, dt);
      if (this.dyingTimer <= 0) {
        this.state = 'gameover';
        this.sound.gameOver();
      }
      return;
    }

    this.director.update(dt, (kind, x) => this.addEnemy(kind, x), this.enemies.length);

    // --- the player ship
    const beforeX = player.x;
    const axis = this.input.axis();
    if (axis !== 0) player.x += axis * player.speed * dt;
    if (this.input.mouse.x !== null) {
      const dx = this.input.mouse.x - player.x;
      if (Math.abs(dx) > 1) player.x += dx * Math.min(1, dt * 16);
    }
    player.x = Math.max(30, Math.min(WORLD.width - 30, player.x));
    const velocity = dt > 0 ? (player.x - beforeX) / dt : 0;
    player.tilt += (Math.max(-1, Math.min(1, velocity / player.speed)) - player.tilt) * Math.min(1, dt * 10);

    player.invuln = Math.max(0, player.invuln - dt);
    player.rapid = Math.max(0, player.rapid - dt);
    player.spread = Math.max(0, player.spread - dt);
    player.fireTimer -= dt;
    if ((this.input.firing() || this.autoFire) && player.fireTimer <= 0) {
      player.fireTimer = player.rapid > 0 ? 0.075 : 0.14;
      const noseY = player.y - 24;
      this.bolts.push(spawnBolt(player.x, noseY, 0, -640));
      if (player.spread > 0) {
        this.bolts.push(spawnBolt(player.x - 8, noseY + 6, -80, -610));
        this.bolts.push(spawnBolt(player.x + 8, noseY + 6, 80, -610));
      }
      this.sound.shoot();
    }
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) {
      this.trailTimer = 0.03;
      trailPuff(this.particles, player.x, player.y + 26, this.rng);
    }

    // --- combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // --- bolts
    for (const b of this.bolts) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -24 || b.x < -16 || b.x > WORLD.width + 16) b.dead = true;
    }
    for (const o of this.enemyBolts) {
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.y > WORLD.height + 20 || o.y < -20 || o.x < -20 || o.x > WORLD.width + 20) o.dead = true;
      if (!o.dead && overlaps(o, player)) {
        o.dead = true;
        this.damagePlayer();
      }
    }

    // --- enemies
    for (const e of this.enemies) {
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      this.moveEnemy(e, dt);
      if (e.kind !== 'boss' && e.y - e.radius > WORLD.height - 8) {
        e.dead = true;
        this.onBreach(e);
      }
    }

    // --- bolt hits
    for (const b of this.bolts) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (overlaps(b, e)) {
          b.dead = true;
          e.hp -= 1;
          e.flash = 0.12;
          burst(this.particles, b.x, b.y - 6, this.rng, { count: 3, speed: 150, life: 0.3, size: 2 });
          if (e.hp <= 0) this.killEnemy(e, true);
          break;
        }
      }
    }

    // --- ramming
    for (const e of this.enemies) {
      if (e.dead || e.kind === 'boss') continue;
      if (overlaps(e, player)) {
        this.killEnemy(e, false);
        this.damagePlayer();
      }
    }
    if (this.boss && !this.boss.dead && overlaps(this.boss, player)) this.damagePlayer();

    // --- power-ups: drift, magnet, collect
    updatePowerups(this.powerups, dt);
    for (const p of this.powerups) {
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 120 && dist > 1) {
        p.x += (dx / dist) * 300 * dt;
        p.y += (dy / dist) * 300 * dt;
      }
      if (!p.dead && overlaps(p, player)) {
        p.dead = true;
        this.applyPowerup(p);
      }
    }

    updateParticles(this.particles, dt);
    updateFloaters(this.floaters, dt);

    // --- sweep the dead
    this.bolts = this.bolts.filter((b) => !b.dead);
    this.enemyBolts = this.enemyBolts.filter((o) => !o.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.powerups = this.powerups.filter((p) => !p.dead);
    if (this.boss && this.boss.dead) this.boss = null;

    // --- wave flow
    if (this.phase === 'fight') {
      if (!this.boss && this.director.dealt && this.enemies.length === 0) {
        const bonus = 250 + this.wave * 50;
        this.addScore(bonus, WORLD.width / 2, 300, false);
        spawnFloater(this.floaters, WORLD.width / 2, 300, `WAVE BONUS +${bonus}`, '#7dffcb');
        this.showBanner(`WAVE ${this.wave} CLEAR`, `BONUS +${bonus}`, 1.6);
        this.sound.waveClear();
        this.phase = 'between';
        this.betweenTimer = 1.9;
      }
    } else {
      this.betweenTimer -= dt;
      if (this.betweenTimer <= 0) this.nextWave();
    }
  }

  moveEnemy(e, dt) {
    switch (e.kind) {
      case 'drifter':
        e.y += e.vy * dt;
        e.x = e.baseX + Math.sin(e.age * 1.6 + e.phase) * e.sway * 0.6;
        break;
      case 'weaver':
        e.y += e.vy * dt;
        e.flipTimer -= dt;
        if (e.flipTimer <= 0) {
          e.flipTimer = this.rng.range(0.5, 1.0);
          e.vx = (e.vx === 0 ? this.rng.sign() : -Math.sign(e.vx)) * this.rng.range(120, 195);
        }
        e.x += e.vx * dt;
        if (e.x < 30) { e.x = 30; e.vx = Math.abs(e.vx); }
        if (e.x > WORLD.width - 30) { e.x = WORLD.width - 30; e.vx = -Math.abs(e.vx); }
        break;
      case 'diver': {
        e.y += e.vy * dt;
        const want = Math.max(-1, Math.min(1, (this.player.x - e.x) / 90)) * 135;
        e.vx += (want - e.vx) * Math.min(1, dt * 3);
        e.x += e.vx * dt;
        break;
      }
      case 'tank':
        e.y += e.vy * dt;
        e.x = e.baseX + Math.sin(e.age * 0.9 + e.phase) * 18;
        break;
      case 'boss':
        this.moveBoss(e, dt);
        break;
    }
  }

  moveBoss(e, dt) {
    if (!e.entered) {
      e.y += 68 * dt;
      if (e.y >= 118) e.entered = true;
      return;
    }
    e.x = WORLD.width / 2 + Math.sin(e.age * 0.55) * 215;
    e.y = 118 + Math.sin(e.age * 0.9) * 10;

    e.radialTimer -= dt;
    if (e.radialTimer <= 0) {
      e.radialTimer = Math.max(1.6, 2.6 - this.wave * 0.05);
      const count = 14;
      const offset = e.age * 0.7;
      for (let i = 0; i < count; i++) {
        const angle = offset + (i / count) * Math.PI * 2;
        this.enemyBolts.push(spawnOrb(e.x, e.y + 10, Math.cos(angle) * 165, Math.sin(angle) * 165));
      }
      this.sound.enemyShoot();
    }
    e.volleyTimer -= dt;
    if (e.volleyTimer <= 0) {
      e.volleyTimer = 1.35;
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      for (const spread of [-0.16, 0, 0.16]) {
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        const vx = ((dx / dist) * cos - (dy / dist) * sin) * 225;
        const vy = ((dx / dist) * sin + (dy / dist) * cos) * 225;
        this.enemyBolts.push(spawnOrb(e.x, e.y + 26, vx, vy));
      }
      this.sound.enemyShoot();
    }
  }

  killEnemy(e, scored) {
    e.dead = true;
    const palette = ENEMY_COLORS[e.kind] ?? ENEMY_COLORS.drifter;
    const big = e.kind === 'tank' || e.kind === 'boss';
    burst(this.particles, e.x, e.y, this.rng, {
      count: e.kind === 'boss' ? 60 : big ? 30 : 16,
      colors: palette,
      speed: big ? 380 : 270,
      life: big ? 0.8 : 0.55,
      size: big ? 4 : 3,
    });
    if (e.kind === 'boss') {
      for (let i = 0; i < 3; i++) {
        burst(this.particles, e.x + this.rng.range(-70, 70), e.y + this.rng.range(-30, 30), this.rng, {
          count: 24, colors: palette, speed: 330, life: 0.8, size: 4,
        });
      }
      this.shake = 16;
    }
    this.sound.explosion(big);

    if (scored) {
      this.kills += 1;
      this.combo += 1;
      this.comboTimer = this.comboWindow;
      const mult = this.multiplier();
      if (mult > this.bestMultiplier) this.bestMultiplier = mult;
      this.addScore(e.score * mult, e.x, e.y - 10);
    }

    if (e.kind === 'boss') {
      this.onBossDown(e);
    } else if (this.rng.chance(e.kind === 'tank' ? 0.65 : 0.1)) {
      this.powerups.push(spawnPowerup(e.x, e.y, this.rng));
    }
  }

  onBossDown(e) {
    this.powerups.push(spawnPowerup(e.x - 40, e.y, this.rng, 'spread'));
    this.powerups.push(spawnPowerup(e.x + 40, e.y, this.rng, 'rapid'));
    if (this.wave >= FINAL_WAVE && !this.endless) {
      this.state = 'victory';
      this.sound.victory();
    } else {
      this.showBanner('DREADNOUGHT DOWN', `+${e.score} — THE FALL CONTINUES`, 2.2);
      this.phase = 'between';
      this.betweenTimer = 2.6;
    }
  }

  onBreach(e) {
    if (this.shotMode) return;
    burst(this.particles, e.x, WORLD.height - 30, this.rng, {
      count: 14, colors: ['#ff5340', '#ffb347', '#ffffff'], speed: 240, life: 0.5, size: 3,
    });
    this.flashRed = 1;
    this.shake = Math.max(this.shake, 8);
    this.sound.breach();
    this.lives -= 1;
    if (this.lives <= 0 && !this.player.dead) this.startDying();
  }

  damagePlayer() {
    const player = this.player;
    if (player.dead || player.invuln > 0 || this.shotMode) return;
    if (player.shield) {
      player.shield = false;
      player.invuln = 1.2;
      burst(this.particles, player.x, player.y, this.rng, {
        count: 14, colors: ['#7dffcb', '#eafff5', '#40e0ff'], speed: 240, life: 0.45, size: 3,
      });
      this.sound.explosion(false);
      return;
    }
    this.lives -= 1;
    this.shake = 14;
    this.flashRed = 0.8;
    burst(this.particles, player.x, player.y, this.rng, {
      count: 30, colors: ['#40e0ff', '#ffd166', '#ffffff'], speed: 360, life: 0.7, size: 4,
    });
    this.sound.playerHit();
    if (this.lives <= 0) {
      this.startDying();
    } else {
      player.invuln = 2.2;
    }
  }

  startDying() {
    this.player.dead = true;
    this.dyingTimer = 1.1;
    this.shake = 18;
    burst(this.particles, this.player.x, this.player.y, this.rng, {
      count: 46, colors: ['#40e0ff', '#ffd166', '#ff7043', '#ffffff'], speed: 430, life: 0.95, size: 4,
    });
    this.sound.explosion(true);
  }

  applyPowerup(p) {
    const player = this.player;
    if (p.kind === 'rapid') {
      player.rapid = 8;
      this.sound.powerup();
    } else if (p.kind === 'spread') {
      player.spread = 10;
      this.sound.powerup();
    } else if (p.kind === 'shield') {
      player.shield = true;
      this.sound.shieldUp();
    } else if (p.kind === 'life') {
      this.lives = Math.min(5, this.lives + 1);
      this.sound.powerup();
    }
    spawnFloater(this.floaters, player.x, player.y - 44, p.label, p.color);
  }

  // ------------------------------------------------------------- render

  render() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate(this.rng.range(-this.shake, this.shake) * 0.4, this.rng.range(-this.shake, this.shake) * 0.4);
    }
    const r = this.renderer;
    r.drawBackground(this);
    r.drawEntities(this);
    if (this.state === 'title') {
      r.drawTitle(this);
    } else {
      if (this.state !== 'gameover') r.drawHUD(this);
      if (this.state === 'playing') r.drawBanner(this);
      if (this.state === 'paused') r.drawPaused(this);
      if (this.state === 'gameover') r.drawGameOver(this);
      if (this.state === 'victory') r.drawVictory(this);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------- screenshot scenes
  // The kit's shots.json asks for ?shot=start|play|end&seed=1. Each scene below is the
  // game's own state, set up once and then run by the normal loop — a real render,
  // never a drawing. A boss scene is added for the fourth screenshot.

  setupShot(shot) {
    if (shot === 'start') {
      this.hiScore = 25000;
      return;
    }
    if (shot === 'play') {
      this.reset();
      this.state = 'playing';
      this.wave = 3;
      this.director.startWave(3);
      this.director.queue.length = 0; // the scene is hand-placed below
      this.score = 12450;
      this.hiScore = 25000;
      this.lives = 2;
      this.kills = 57;
      this.combo = 26;
      this.comboTimer = 1.9;
      this.bestMultiplier = 4;
      this.player.x = 430;
      this.player.spread = 7;
      this.autoFire = true;
      this.place('drifter', 250, 120);
      this.place('drifter', 640, 90);
      this.place('drifter', 770, 215);
      this.place('weaver', 480, 175);
      this.place('weaver', 185, 265);
      this.place('diver', 705, 55);
      this.place('tank', 545, 305);
      this.powerups.push(spawnPowerup(345, 385, this.rng, 'spread'));
      this.enemyBolts.push(spawnOrb(585, 330, -30, 150));
      this.enemyBolts.push(spawnOrb(615, 285, 20, 165));
      burst(this.particles, 640, 90, this.rng, { count: 12, colors: ENEMY_COLORS.drifter, speed: 240, life: 0.6, size: 3 });
      return;
    }
    if (shot === 'boss') {
      this.reset();
      this.state = 'playing';
      this.wave = 5;
      this.director.startWave(5);
      this.score = 38750;
      this.hiScore = 51230;
      this.lives = 3;
      this.kills = 121;
      this.combo = 41;
      this.comboTimer = 1.9;
      this.bestMultiplier = 5;
      this.player.x = 375;
      this.player.rapid = 6;
      this.autoFire = true;
      this.boss = spawnBoss(5);
      this.boss.entered = true;
      this.boss.y = 118;
      this.boss.hp = Math.floor(this.boss.maxHp * 0.62);
      this.enemies.push(this.boss);
      this.place('drifter', 205, 300);
      this.place('weaver', 745, 265);
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2 + 0.4;
        this.enemyBolts.push(spawnOrb(
          this.boss.x + Math.cos(angle) * 95,
          this.boss.y + 10 + Math.sin(angle) * 95,
          Math.cos(angle) * 165,
          Math.sin(angle) * 165,
        ));
      }
      return;
    }
    if (shot === 'end') {
      this.reset();
      this.state = 'gameover';
      this.score = 51230;
      this.hiScore = 51230;
      this.wave = 7;
      this.kills = 214;
      this.bestMultiplier = 6;
      this.lives = 0;
      this.player.dead = true;
      this.place('drifter', 260, 130);
      this.place('weaver', 720, 90);
      burst(this.particles, WORLD.width / 2, WORLD.height - 90, this.rng, {
        count: 34, colors: ['#40e0ff', '#ffd166', '#ff7043'], speed: 380, life: 1, size: 4,
      });
    }
  }

  /** Place one enemy of a kind at an exact spot (screenshot scenes). */
  place(kind, x, y) {
    const enemy = spawnEnemy(kind, x, y, this.rng, Math.max(1, this.wave));
    this.enemies.push(enemy);
    return enemy;
  }
}
