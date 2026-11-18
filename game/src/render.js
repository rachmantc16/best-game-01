// render.js — everything that is drawn, and nothing that is decided.
// The Game owns the state; the Renderer stamps sprites, glow text and panels from it:
// a parallax starfield, the entities, the HUD, and the title / pause / end screens.

import { WORLD } from './entities.js';
import { stamp } from './sprites.js';

const FONT = '"Trebuchet MS", Verdana, system-ui, sans-serif';
const MONO = '"Consolas", "Menlo", monospace';

export class Renderer {
  constructor(ctx, sprites) {
    this.ctx = ctx;
    this.sprites = sprites;
  }

  /** Neon text: a soft halo behind a bright face. */
  text(str, x, y, { size = 16, color = '#eafcff', align = 'left', font = FONT, weight = 700, glow = null, alpha = 1 } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  /** The deep-space backdrop: gradient, two nebula washes, three star layers. */
  drawBackground(game) {
    const ctx = this.ctx;
    const { width, height } = WORLD;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#04061a');
    grad.addColorStop(0.55, '#081026');
    grad.addColorStop(1, '#0a1030');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // nebula washes drift almost imperceptibly
    const drift = Math.sin(game.time * 0.05) * 14;
    this.nebula(width * 0.24 + drift, height * 0.3, 210, 'rgba(120, 60, 220, 0.13)');
    this.nebula(width * 0.8 - drift, height * 0.62, 250, 'rgba(30, 120, 200, 0.11)');
    this.nebula(width * 0.62, height * 0.12, 130, 'rgba(255, 60, 140, 0.07)');

    for (const star of game.stars) {
      const y = (star.y + game.starScroll * star.depth) % height;
      const twinkle = 0.55 + 0.45 * Math.sin(game.time * star.twinkle + star.phase);
      ctx.globalAlpha = twinkle * (0.35 + star.depth * 0.6);
      ctx.fillStyle = star.depth > 0.75 ? '#ffffff' : '#bcd8ff';
      ctx.fillRect(star.x, y, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    // the line the player guards: a faint energy barrier along the floor
    const pulse = 0.16 + 0.07 * Math.sin(game.time * 2.4);
    ctx.fillStyle = `rgba(64, 224, 255, ${pulse})`;
    ctx.fillRect(0, height - 26, width, 2);
  }

  nebula(x, y, r, color) {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /** Entities in z-order: power-ups, enemies, orbs, the player, bolts, particles, popups. */
  drawEntities(game) {
    const ctx = this.ctx;
    const sprites = this.sprites;

    for (const p of game.powerups) {
      const bob = Math.sin(p.age * 5) * 3;
      stamp(ctx, sprites.power, p.x, p.y + bob);
      this.text(p.letter, p.x, p.y + bob + 1, {
        size: 15,
        color: p.color,
        align: 'center',
        weight: 900,
        glow: p.color,
      });
    }

    for (const e of game.enemies) {
      const angle = e.kind === 'weaver' || e.kind === 'diver' ? Math.sin(e.age * 6 + e.phase) * 0.22 : 0;
      stamp(ctx, sprites[e.kind], e.x, e.y, angle);
      if (e.flash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.75, e.flash * 3);
        ctx.globalCompositeOperation = 'lighter';
        stamp(ctx, sprites[e.kind], e.x, e.y, angle);
        ctx.restore();
      }
      if (e.kind === 'tank' && e.hp < e.maxHp) {
        this.bar(e.x - 24, e.y - 40, 48, 5, e.hp / e.maxHp, '#ffb347');
      }
    }

    for (const o of game.enemyBolts) stamp(ctx, sprites.orb, o.x, o.y);

    const player = game.player;
    if (!player.dead) {
      const blink = player.invuln > 0 && Math.floor(game.time * 14) % 2 === 0;
      if (!blink) stamp(ctx, sprites.player, player.x, player.y, player.tilt * 0.35);
      if (player.shield) {
        ctx.save();
        ctx.strokeStyle = 'rgba(125, 255, 203, 0.75)';
        ctx.shadowColor = '#7dffcb';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 30 + Math.sin(game.time * 4) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of game.bolts) stamp(ctx, sprites.bolt, b.x, b.y);
    for (const p of game.particles) {
      const fade = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, fade);
      if (p.kind === 'spark') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * fade + 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * fade + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
        grad.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
        grad.addColorStop(0.4, p.color);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    for (const f of game.floaters) {
      this.text(f.text, f.x, f.y, {
        size: 15,
        color: f.color,
        align: 'center',
        font: MONO,
        alpha: Math.max(0, 1 - f.age / f.life),
      });
    }

    if (game.flashRed > 0) {
      ctx.fillStyle = `rgba(255, 40, 60, ${game.flashRed * 0.22})`;
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    }
  }

  bar(x, y, w, h, fraction, color) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6, 10, 24, 0.8)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraction)), h);
  }

  /** The heads-up display: score, wave, lives, combo and active power-up timers. */
  drawHUD(game) {
    const { width } = WORLD;
    const player = game.player;

    this.text('SCORE', 18, 22, { size: 11, color: '#7fb8d8', weight: 700 });
    this.text(String(game.score).padStart(6, '0'), 18, 42, {
      size: 24,
      color: '#eafcff',
      font: MONO,
      glow: '#40e0ff',
    });
    this.text(`HI ${String(game.hiScore).padStart(6, '0')}`, 18, 66, {
      size: 12,
      color: '#7fb8d8',
      font: MONO,
      weight: 400,
    });

    if (game.combo > 1) {
      const mult = game.multiplier();
      this.text(`COMBO x${mult}`, 18, 92, { size: 15, color: '#ffd166', font: MONO, glow: '#ffd166' });
      this.bar(18, 104, 92, 4, game.comboTimer / game.comboWindow, '#ffd166');
    }

    this.text(`WAVE ${game.wave}`, width / 2, 30, {
      size: 20,
      color: '#eafcff',
      align: 'center',
      glow: '#b26bff',
    });
    if (game.boss) {
      this.text('DREADNOUGHT', width / 2, 56, { size: 11, color: '#ff8fab', align: 'center' });
      this.bar(width / 2 - 150, 66, 300, 8, game.boss.hp / game.boss.maxHp, '#ff3b6b');
    } else if (game.state === 'playing') {
      const left = game.director.remaining + game.enemies.length;
      this.text(`${left} HOSTILES LEFT`, width / 2, 56, { size: 11, color: '#7fb8d8', align: 'center' });
    }

    // lives as little ships, right aligned
    for (let i = 0; i < game.lives; i++) {
      stamp(this.ctx, this.sprites.player, width - 30 - i * 34, 34, 0, 0.42);
    }
    if (player.shield) {
      this.text('SHIELD UP', width - 18, 62, { size: 11, color: '#7dffcb', align: 'right' });
    }

    // active power-up timers, bottom left
    const timers = [];
    if (player.rapid > 0) timers.push(`RAPID ${player.rapid.toFixed(0)}s`);
    if (player.spread > 0) timers.push(`SPREAD ${player.spread.toFixed(0)}s`);
    timers.forEach((label, i) => {
      this.text(label, 18, WORLD.height - 44 - i * 18, { size: 12, color: '#ffd166', font: MONO, weight: 400 });
    });

    this.text('MOVE mouse / arrows · FIRE space / click · P pause · M sound', width / 2, WORLD.height - 10, {
      size: 11,
      color: 'rgba(160, 200, 235, 0.55)',
      align: 'center',
      weight: 400,
    });
  }

  /** The big wave announcement that fades through the middle of a wave change. */
  drawBanner(game) {
    const banner = game.banner;
    if (!banner || banner.t <= 0) return;
    const alpha = Math.min(1, banner.t / 0.6, (banner.total - banner.t + 0.6) / 0.6);
    this.text(banner.title, WORLD.width / 2, 226, {
      size: 46,
      color: '#eafcff',
      align: 'center',
      weight: 900,
      glow: '#40e0ff',
      alpha: Math.max(0, alpha),
    });
    if (banner.sub) {
      this.text(banner.sub, WORLD.width / 2, 264, {
        size: 15,
        color: '#ffd166',
        align: 'center',
        alpha: Math.max(0, alpha),
      });
    }
  }

  /** A translucent panel behind screen text. */
  panel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 10, 26, 0.78)';
    ctx.strokeStyle = 'rgba(64, 224, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawTitle(game) {
    const { width } = WORLD;
    const bob = Math.sin(game.time * 1.4) * 5;
    this.text('STARFALL', width / 2, 128 + bob, {
      size: 84,
      color: '#eafcff',
      align: 'center',
      weight: 900,
      glow: '#40e0ff',
    });
    this.text('DEFENDER', width / 2, 196 + bob, {
      size: 84,
      color: '#ffd166',
      align: 'center',
      weight: 900,
      glow: '#ff9f43',
    });
    this.text('A  N E O N  D E F E N S E  A R C A D E', width / 2, 248 + bob, {
      size: 15,
      color: '#7fb8d8',
      align: 'center',
      weight: 400,
    });

    this.panel(width / 2 - 268, 282, 536, 148);
    const lines = [
      ['MOVE', 'Mouse, arrow keys or A / D'],
      ['FIRE', 'Hold SPACE or the mouse button'],
      ['GOAL', 'Stop the fallers — a breach costs a life'],
      ['LOOT', 'Catch orbs: Rapid, Spread, Shield, extra life'],
      ['BOSS', 'A Dreadnought every 5 waves. Clear wave 10 to win'],
    ];
    lines.forEach(([key, value], i) => {
      const y = 308 + i * 26;
      this.text(key, width / 2 - 244, y, { size: 14, color: '#40e0ff', weight: 900 });
      this.text(value, width / 2 - 168, y, { size: 14, color: '#d9ecff', weight: 400 });
    });

    const pulse = 0.65 + 0.35 * Math.sin(game.time * 4);
    this.text('CLICK OR PRESS ENTER TO START', width / 2, 478, {
      size: 20,
      color: '#7dffcb',
      align: 'center',
      glow: '#7dffcb',
      alpha: pulse,
    });
    this.text(`HI-SCORE ${String(game.hiScore).padStart(6, '0')} · runs fully offline`, width / 2, 522, {
      size: 12,
      color: '#7fb8d8',
      align: 'center',
      weight: 400,
    });
  }

  drawStats(game, y) {
    const rows = [
      ['FINAL SCORE', String(game.score).padStart(6, '0')],
      ['WAVE REACHED', String(game.wave)],
      ['KILLS', String(game.kills)],
      ['BEST COMBO', `x${game.bestMultiplier}`],
    ];
    rows.forEach(([key, value], i) => {
      this.text(key, WORLD.width / 2 - 150, y + i * 30, { size: 15, color: '#7fb8d8' });
      this.text(value, WORLD.width / 2 + 150, y + i * 30, {
        size: 17,
        color: '#eafcff',
        align: 'right',
        font: MONO,
      });
    });
  }

  drawGameOver(game) {
    this.darken(0.45);
    this.text('GAME OVER', WORLD.width / 2, 168, {
      size: 68,
      color: '#ff5340',
      align: 'center',
      weight: 900,
      glow: '#ff3b6b',
    });
    this.text('THE LINE HAS FALLEN', WORLD.width / 2, 214, {
      size: 15,
      color: '#ffb3a7',
      align: 'center',
      weight: 400,
    });
    this.drawStats(game, 268);
    const pulse = 0.65 + 0.35 * Math.sin(game.time * 4);
    this.text('PRESS ENTER TO RETRY', WORLD.width / 2, 436, {
      size: 19,
      color: '#7dffcb',
      align: 'center',
      glow: '#7dffcb',
      alpha: pulse,
    });
  }

  drawVictory(game) {
    this.darken(0.4);
    this.text('SECTOR CLEARED!', WORLD.width / 2, 168, {
      size: 62,
      color: '#ffd166',
      align: 'center',
      weight: 900,
      glow: '#ff9f43',
    });
    this.text('THE DREADNOUGHT BURNS. THE SKY IS QUIET — FOR NOW.', WORLD.width / 2, 214, {
      size: 14,
      color: '#ffe9b8',
      align: 'center',
      weight: 400,
    });
    this.drawStats(game, 268);
    this.text('ENTER — PLAY AGAIN      C — ENDLESS MODE', WORLD.width / 2, 436, {
      size: 17,
      color: '#7dffcb',
      align: 'center',
      glow: '#7dffcb',
    });
  }

  drawPaused(game) {
    this.darken(0.55);
    this.text('PAUSED', WORLD.width / 2, 280, {
      size: 52,
      color: '#eafcff',
      align: 'center',
      weight: 900,
      glow: '#40e0ff',
    });
    this.text('P or ESC to resume', WORLD.width / 2, 326, {
      size: 15,
      color: '#7fb8d8',
      align: 'center',
      weight: 400,
    });
  }

  darken(alpha) {
    this.ctx.fillStyle = `rgba(2, 4, 12, ${alpha})`;
    this.ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }
}
