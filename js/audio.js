class AudioSystem {
  constructor() {
    this._ctx      = null;
    this._master   = null;
    this._bgmGain  = null;
    this._bgmOscs  = null;
    this._bgmActive = false;
    this.sfxEnabled = true;
    this.bgmEnabled = true;
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ctx.createGain();
      this._master.gain.value = 0.45;
      this._master.connect(this._ctx.destination);
    }
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx;
  }

  _tone(freq, type, dur, vol, detune, delay) {
    if (!this.sfxEnabled) return;
    if (detune === undefined) detune = 0;
    if (delay  === undefined) delay  = 0;
    try {
      const ctx = this._getCtx();
      const t   = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      if (detune) osc.detune.value = detune;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this._master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (e) {}
  }

  _noise(dur, vol, cutoff, delay) {
    if (!this.sfxEnabled) return;
    if (cutoff === undefined) cutoff = 800;
    if (delay  === undefined) delay  = 0;
    try {
      const ctx    = this._getCtx();
      const t      = ctx.currentTime + delay;
      const bufLen = Math.floor(ctx.sampleRate * dur);
      const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data   = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
      const src  = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filt); filt.connect(g); g.connect(this._master);
      src.start(t); src.stop(t + dur + 0.02);
    } catch (e) {}
  }

  // ── SFX ────────────────────────────────────────────────────────────────────

  fire() {
    this._tone(920, 'square', 0.04, 0.06);
    this._tone(580, 'square', 0.03, 0.04, 0, 0.01);
  }

  hit(isCrit) {
    if (isCrit) {
      this._tone(520, 'sine', 0.09, 0.14);
      this._tone(780, 'sine', 0.07, 0.1, 0, 0.02);
    } else {
      this._tone(230, 'sawtooth', 0.06, 0.1);
    }
  }

  enemyDeath() {
    this._tone(290, 'sawtooth', 0.11, 0.1);
    this._tone(145, 'sawtooth', 0.09, 0.08, 0, 0.07);
  }

  bossHit() {
    this._tone(100, 'sawtooth', 0.18, 0.18);
    this._noise(0.15, 0.1, 300);
  }

  bossDeath() {
    this._tone(80,  'sawtooth', 0.55, 0.28);
    this._tone(40,  'sawtooth', 0.5,  0.22, 0, 0.15);
    this._noise(0.5, 0.25, 500, 0.1);
    this._tone(220, 'sine',    0.4,  0.13, 0, 0.32);
  }

  playerHit() {
    this._tone(130, 'sawtooth', 0.22, 0.25);
    this._tone(80,  'sine',     0.28, 0.18, 0, 0.06);
    this._noise(0.2, 0.12, 400);
  }

  coin() {
    this._tone(1300, 'sine', 0.07, 0.07);
    this._tone(1800, 'sine', 0.05, 0.05, 0, 0.04);
  }

  levelUp() {
    [440, 550, 660, 880].forEach((f, i) => this._tone(f, 'sine', 0.22, 0.13, 0, i * 0.09));
  }

  doorOpen() {
    [330, 440, 550].forEach((f, i) => this._tone(f, 'sine', 0.28, 0.1, 0, i * 0.1));
  }

  gameOver() {
    [440, 360, 300, 220].forEach((f, i) => this._tone(f, 'sawtooth', 0.38, 0.13, 0, i * 0.14));
  }

  gameClear() {
    [440, 550, 660, 770, 880].forEach((f, i) => {
      this._tone(f,     'sine', 0.5,  0.13, 0, i * 0.1);
      this._tone(f * 2, 'sine', 0.3,  0.07, 0, i * 0.1 + 0.05);
    });
  }

  bossAppear() {
    this._tone(60, 'sawtooth', 0.5, 0.28);
    this._tone(90, 'sawtooth', 0.4, 0.18, 0, 0.1);
    this._noise(0.4, 0.2, 350);
  }

  bossPhase2() {
    this._tone(200, 'sawtooth', 0.35, 0.22);
    this._tone(400, 'sawtooth', 0.25, 0.15, 0, 0.1);
    this._noise(0.3, 0.18, 500);
  }

  // ── BGM ─────────────────────────────────────────────────────────────────────

  startBGM() {
    if (!this.bgmEnabled || this._bgmActive) return;
    try {
      const ctx = this._getCtx();
      this._bgmGain = ctx.createGain();
      this._bgmGain.gain.value = 0.035;
      this._bgmGain.connect(this._master);
      this._bgmOscs = [55, 82.5, 110].map((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.value = f;
        osc.detune.value = (Math.random() - 0.5) * 10;
        osc.connect(this._bgmGain);
        osc.start();
        return osc;
      });
      this._bgmActive = true;
    } catch (e) {}
  }

  stopBGM() {
    if (!this._bgmActive) return;
    try {
      if (this._bgmOscs) this._bgmOscs.forEach(o => { try { o.stop(); } catch (e) {} });
      if (this._bgmGain) this._bgmGain.disconnect();
    } catch (e) {}
    this._bgmOscs  = null;
    this._bgmGain  = null;
    this._bgmActive = false;
  }
}
