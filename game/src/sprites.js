// sprites.js — every ship and bolt is painted once, at load, onto its own small canvas
// with its glow baked in. The frame loop then only stamps images, which keeps the glow
// cheap and the shapes crisp. All art is original vector drawing: hulls, wings and cores.

/** Paint a sprite: a canvas of w by h, drawn by fn(ctx) centered at (w/2, h/2). */
function makeSprite(w, h, fn) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.translate(w / 2, h / 2);
  fn(ctx);
  return canvas;
}

/** A closed path from a list of [x, y] points. */
function path(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function playerShip() {
  return makeSprite(96, 96, (ctx) => {
    ctx.shadowColor = '#40e0ff';
    ctx.shadowBlur = 16;
    // swept wings
    ctx.fillStyle = '#0e5f78';
    path(ctx, [[0, -26], [10, 2], [30, 18], [30, 26], [8, 18], [-8, 18], [-30, 26], [-30, 18], [-10, 2]]);
    ctx.fill();
    // hull
    const hull = ctx.createLinearGradient(0, -28, 0, 24);
    hull.addColorStop(0, '#bdf3ff');
    hull.addColorStop(0.45, '#39c2e8');
    hull.addColorStop(1, '#14708f');
    ctx.fillStyle = hull;
    path(ctx, [[0, -28], [9, 4], [7, 22], [-7, 22], [-9, 4]]);
    ctx.fill();
    // cockpit
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.ellipse(0, -8, 3.6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // engine flame
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffb347';
    path(ctx, [[-4, 23], [4, 23], [0, 34]]);
    ctx.fill();
  });
}

function drifter() {
  // a magenta shard-saucer, the basic faller
  return makeSprite(72, 72, (ctx) => {
    ctx.shadowColor = '#ff4fd8';
    ctx.shadowBlur = 13;
    ctx.fillStyle = '#8f1f74';
    path(ctx, [[0, -16], [16, 0], [0, 18], [-16, 0]]);
    ctx.fill();
    ctx.fillStyle = '#ff4fd8';
    path(ctx, [[0, -9], [9, 0], [0, 10], [-9, 0]]);
    ctx.fill();
    ctx.fillStyle = '#ffe3fa';
    ctx.beginPath();
    ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function weaver() {
  // a violet dart that zigzags down the sky
  return makeSprite(68, 68, (ctx) => {
    ctx.shadowColor = '#b26bff';
    ctx.shadowBlur = 13;
    ctx.fillStyle = '#4b2386';
    path(ctx, [[0, 18], [7, -4], [16, -14], [5, -10], [0, -18], [-5, -10], [-16, -14], [-7, -4]]);
    ctx.fill();
    ctx.fillStyle = '#b26bff';
    path(ctx, [[0, 12], [4.5, -4], [0, -13], [-4.5, -4]]);
    ctx.fill();
    ctx.fillStyle = '#f1e6ff';
    ctx.beginPath();
    ctx.arc(0, -2, 2.8, 0, Math.PI * 2);
    ctx.fill();
  });
}

function diver() {
  // a red spike that aims at the player
  return makeSprite(64, 64, (ctx) => {
    ctx.shadowColor = '#ff5340';
    ctx.shadowBlur = 13;
    ctx.fillStyle = '#7e1d12';
    path(ctx, [[0, 20], [6, 2], [13, -12], [4, -8], [0, -16], [-4, -8], [-13, -12], [-6, 2]]);
    ctx.fill();
    ctx.fillStyle = '#ff7043';
    path(ctx, [[0, 14], [3.6, 0], [0, -10], [-3.6, 0]]);
    ctx.fill();
    ctx.fillStyle = '#fff0e6';
    ctx.beginPath();
    ctx.arc(0, 1, 2.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function tank() {
  // a heavy amber hexagon with a bright core; soaks up shots, drops power-ups
  return makeSprite(120, 120, (ctx) => {
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#6e4510';
    path(ctx, [[0, -28], [24, -14], [24, 14], [0, 28], [-24, 14], [-24, -14]]);
    ctx.fill();
    ctx.fillStyle = '#c47f1d';
    path(ctx, [[0, -20], [17, -10], [17, 10], [0, 20], [-17, 10], [-17, -10]]);
    ctx.fill();
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6e0';
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function boss() {
  // the Dreadnought: a wide mothership with two side pods and a burning core
  return makeSprite(300, 190, (ctx) => {
    ctx.shadowColor = '#ff3b6b';
    ctx.shadowBlur = 20;
    // wing span
    ctx.fillStyle = '#57122b';
    path(ctx, [[-128, 18], [-70, -12], [70, -12], [128, 18], [104, 34], [-104, 34]]);
    ctx.fill();
    // side pods
    ctx.fillStyle = '#7e1d3c';
    path(ctx, [[-108, 2], [-84, 2], [-78, 26], [-102, 30]]);
    ctx.fill();
    path(ctx, [[108, 2], [84, 2], [78, 26], [102, 30]]);
    ctx.fill();
    // main hull
    const hull = ctx.createLinearGradient(0, -46, 0, 30);
    hull.addColorStop(0, '#a52c50');
    hull.addColorStop(1, '#4a0f24');
    ctx.fillStyle = hull;
    path(ctx, [[0, -46], [34, -18], [40, 16], [16, 30], [-16, 30], [-40, 16], [-34, -18]]);
    ctx.fill();
    // armor ribs
    ctx.strokeStyle = 'rgba(255,150,180,0.5)';
    ctx.lineWidth = 2;
    for (const x of [-24, 0, 24]) {
      ctx.beginPath();
      ctx.moveTo(x * 0.6, -30);
      ctx.lineTo(x, 22);
      ctx.stroke();
    }
    // core
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, -2, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(0, -2, 5, 0, Math.PI * 2);
    ctx.fill();
    // pod lights
    ctx.fillStyle = '#ff8fab';
    for (const x of [-96, 96]) {
      ctx.beginPath();
      ctx.arc(x, 16, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function playerBolt() {
  return makeSprite(20, 40, (ctx) => {
    ctx.shadowColor = '#40e0ff';
    ctx.shadowBlur = 10;
    const grad = ctx.createLinearGradient(0, -14, 0, 14);
    grad.addColorStop(0, '#eafcff');
    grad.addColorStop(0.4, '#40e0ff');
    grad.addColorStop(1, 'rgba(64,224,255,0)');
    ctx.fillStyle = grad;
    path(ctx, [[-3, 14], [-3, -6], [0, -14], [3, -6], [3, 14]]);
    ctx.fill();
  });
}

function enemyOrb() {
  return makeSprite(28, 28, (ctx) => {
    ctx.shadowColor = '#ff5340';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff5340';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9e2';
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function powerOrb() {
  // a ringed orb; the renderer stamps the power-up's letter over it
  return makeSprite(52, 52, (ctx) => {
    ctx.shadowColor = '#7dffcb';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#7dffcb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(20, 60, 46, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** All sprites, built once. Keys match the entity kinds that use them. */
export function buildSprites() {
  return {
    player: playerShip(),
    drifter: drifter(),
    weaver: weaver(),
    diver: diver(),
    tank: tank(),
    boss: boss(),
    bolt: playerBolt(),
    orb: enemyOrb(),
    power: powerOrb(),
  };
}

/** Stamp a sprite centered at (x, y), optionally rotated (radians) and scaled. */
export function stamp(ctx, sprite, x, y, angle = 0, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  if (angle !== 0) ctx.rotate(angle);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
  ctx.restore();
}
