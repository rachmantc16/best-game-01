// audio.js — every sound in the game is synthesized with the Web Audio API.
// There are no audio files: a laser is a falling square wave, an explosion is filtered
// noise, and the music is a small step sequencer playing a bass line under the action.
// The context is created on the first user gesture, as browsers require; before that,
// and in screenshot scenes, every call is a quiet no-op.

const BASS_LINE = [55, 0, 55, 55, 0, 65.41, 0, 55, 49, 0, 49, 49, 0, 73.42, 0, 82.41];
const STEP_SECONDS = 60 / 132 / 2; // 132 bpm, eighth notes

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.step = 0;
    this.nextStepAt = 0;
  }

  /** Create the context on a user gesture. Safe to call on every gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      this.ctx = new AudioCtor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.nextStepAt = this.ctx.currentTime + 0.1;
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  /** One oscillator blip, optionally sliding from freq to freqEnd. */
  tone({ freq, freqEnd = null, type = 'square', dur = 0.12, vol = 0.16, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** One burst of filtered noise: explosions, hits, static. */
  noise({ dur = 0.3, vol = 0.3, freq = 900, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(80, t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t0);
  }

  shoot() {
    this.tone({ freq: 920, freqEnd: 240, type: 'square', dur: 0.07, vol: 0.05 });
  }

  enemyShoot() {
    this.tone({ freq: 340, freqEnd: 160, type: 'sawtooth', dur: 0.1, vol: 0.045 });
  }

  explosion(big = false) {
    this.noise({ dur: big ? 0.55 : 0.28, vol: big ? 0.42 : 0.24, freq: big ? 700 : 1000 });
    if (big) this.tone({ freq: 120, freqEnd: 34, type: 'sine', dur: 0.5, vol: 0.4 });
  }

  playerHit() {
    this.noise({ dur: 0.4, vol: 0.4, freq: 1400 });
    this.tone({ freq: 300, freqEnd: 60, type: 'sawtooth', dur: 0.4, vol: 0.25 });
  }

  breach() {
    this.tone({ freq: 140, freqEnd: 70, type: 'sawtooth', dur: 0.35, vol: 0.28 });
    this.tone({ freq: 147, freqEnd: 74, type: 'sawtooth', dur: 0.35, vol: 0.2 });
  }

  powerup() {
    this.tone({ freq: 660, type: 'triangle', dur: 0.09, vol: 0.16 });
    this.tone({ freq: 880, type: 'triangle', dur: 0.09, vol: 0.16, delay: 0.07 });
    this.tone({ freq: 1320, type: 'triangle', dur: 0.14, vol: 0.16, delay: 0.14 });
  }

  shieldUp() {
    this.tone({ freq: 520, freqEnd: 1040, type: 'sine', dur: 0.18, vol: 0.18 });
  }

  waveClear() {
    this.tone({ freq: 523, type: 'triangle', dur: 0.1, vol: 0.15 });
    this.tone({ freq: 659, type: 'triangle', dur: 0.1, vol: 0.15, delay: 0.09 });
    this.tone({ freq: 784, type: 'triangle', dur: 0.16, vol: 0.15, delay: 0.18 });
  }

  bossWarn() {
    for (let i = 0; i < 3; i++) {
      this.tone({ freq: 196, type: 'square', dur: 0.14, vol: 0.16, delay: i * 0.22 });
      this.tone({ freq: 185, type: 'square', dur: 0.14, vol: 0.16, delay: i * 0.22 + 0.11 });
    }
  }

  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, i) =>
      this.tone({ freq, type: 'triangle', dur: 0.24, vol: 0.2, delay: i * 0.22 }),
    );
  }

  victory() {
    const notes = [523, 659, 784, 1046, 784, 1046];
    notes.forEach((freq, i) =>
      this.tone({ freq, type: 'triangle', dur: 0.16, vol: 0.18, delay: i * 0.13 }),
    );
  }

  /**
   * The music: a driving bass line with a soft hat, scheduled a step at a time from the
   * game's frame loop. Call every frame; it only schedules while the clock runs.
   */
  updateMusic(active) {
    if (!this.ctx || this.muted || !active) return;
    const ahead = this.ctx.currentTime + 0.12;
    while (this.nextStepAt < ahead) {
      const stepIndex = this.step % BASS_LINE.length;
      const note = BASS_LINE[stepIndex];
      const delay = Math.max(0, this.nextStepAt - this.ctx.currentTime);
      if (note > 0) {
        this.tone({ freq: note, type: 'triangle', dur: 0.16, vol: 0.14, delay });
        this.tone({ freq: note * 2, type: 'sine', dur: 0.1, vol: 0.05, delay });
      }
      if (this.step % 2 === 0) this.noise({ dur: 0.03, vol: 0.03, freq: 6000, delay });
      this.step += 1;
      this.nextStepAt += STEP_SECONDS;
    }
  }
}
