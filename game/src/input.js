// input.js — keyboard and mouse state. Listeners only record; the game polls each frame,
// so controls answer on the very next frame and nothing is ever queued or lost.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: null, y: null, down: false, seenAt: -Infinity };

    window.addEventListener('keydown', (event) => {
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });

    canvas.addEventListener('mousemove', (event) => {
      const point = this.toGamePoint(event);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
      this.mouse.seenAt = performance.now();
    });
    canvas.addEventListener('mousedown', (event) => {
      const point = this.toGamePoint(event);
      this.mouse.x = point.x;
      this.mouse.y = point.y;
      this.mouse.seenAt = performance.now();
      this.mouse.down = true;
      this.pressed.add('MouseDown');
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
    canvas.addEventListener('mouseleave', () => {
      this.mouse.x = null;
      this.mouse.y = null;
    });
  }

  /** Pointer event to game coordinates (the canvas is 960 by 600 inside any CSS size). */
  toGamePoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  /** -1, 0 or 1 from the arrow keys or A/D. */
  axis() {
    let value = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) value -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) value += 1;
    return value;
  }

  /** Held fire: Space or the mouse button. */
  firing() {
    return this.keys.has('Space') || this.mouse.down;
  }

  /** True once per physical press of a code; calling consumes it. */
  takePress(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** Any start gesture this frame: Enter, Space, or a click. Consumes what it finds. */
  takeStartGesture() {
    const hit =
      this.pressed.has('Enter') || this.pressed.has('Space') || this.pressed.has('MouseDown');
    if (hit) {
      this.pressed.delete('Enter');
      this.pressed.delete('Space');
      this.pressed.delete('MouseDown');
    }
    return hit;
  }

  /** End-of-frame tidy-up: one-frame press edges do not survive into the next frame. */
  endFrame() {
    this.pressed.clear();
  }
}
