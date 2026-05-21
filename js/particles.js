class Particle {
  constructor(x, y, vx, vy, r, color, life, gravity) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.r = r;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.gravity = gravity !== undefined ? gravity : 200;
    this.active = true;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.vy += this.gravity * dt;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }

  draw(ctx) {
    const t = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = t;
    ctx.fillStyle   = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * Math.max(0.1, t) + 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class ParticleSystem {
  constructor() { this.particles = []; }

  update(dt) {
    for (const p of this.particles) if (p.active) p.update(dt);
    this.particles = this.particles.filter(p => p.active);
  }

  draw(ctx) {
    for (const p of this.particles) if (p.active) p.draw(ctx);
  }

  _burst(x, y, n, colors, speed, life, gravity, r) {
    if (gravity === undefined) gravity = 200;
    if (r === undefined) r = 3;
    const arr = Array.isArray(colors) ? colors : [colors];
    for (let i = 0; i < n; i++) {
      const a   = Math.random() * Math.PI * 2;
      const s   = speed * (0.4 + Math.random() * 0.6);
      const l   = life  * (0.6 + Math.random() * 0.4);
      const col = arr[Math.floor(Math.random() * arr.length)];
      this.particles.push(new Particle(x, y, Math.cos(a)*s, Math.sin(a)*s, r, col, l, gravity));
    }
  }

  enemyDeath(x, y, color) {
    this._burst(x, y, 10, [color, '#ffffff'], 110, 0.55, 280, 3);
  }

  bossDeath(x, y) {
    this._burst(x, y, 28, ['#ff4444','#ff8844','#ffcc44'], 220, 1.1, 180, 5);
    this._burst(x, y, 15, ['#ffffff','#ffaaaa'],           350, 0.55, 100, 2);
  }

  bossPhase2(x, y) {
    this._burst(x, y, 22, ['#ff8888','#cc3333','#ff4444'], 180, 0.85, 150, 4);
  }

  bossAppear(x, y) {
    this._burst(x, y, 16, ['#cc3333','#ff6666'], 140, 0.7, 200, 4);
  }

  playerHit(x, y) {
    this._burst(x, y, 8, '#ff6666', 80, 0.45, 300, 3);
  }

  arrowHit(x, y, isCrit) {
    if (isCrit) this._burst(x, y, 7, ['#fff07a','#fffaaa'], 160, 0.35, 100, 2.5);
    else        this._burst(x, y, 4, '#c0aaff',              80, 0.25, 100, 2);
  }

  levelUp(cx, cy) {
    for (let i = 0; i < 18; i++) {
      const x  = cx + (Math.random() - 0.5) * 60;
      const vx = (Math.random() - 0.5) * 40;
      const vy = -(80 + Math.random() * 80);
      const l  = 0.7 + Math.random() * 0.5;
      this.particles.push(new Particle(x, cy, vx, vy, 2.5, '#c0aaff', l, -20));
    }
  }

  coinCollect(x, y) {
    this._burst(x, y, 5, ['#FAC775','#ffe8a0'], 60, 0.35, 200, 2);
  }

  doorOpen(x, y) {
    this._burst(x, y, 14, ['#5DCAA5','#9ef5d5'], 90, 0.65, 150, 3);
  }

  fireHit(x, y) {
    this._burst(x, y, 12, ['#ff5500','#ff9944','#ffcc44','#ff3300'], 170, 0.55, -80, 3.5);
    this._burst(x, y, 5,  ['#ffffff','#ffeeaa'], 90, 0.3, -130, 2);
  }

  iceHit(x, y) {
    this._burst(x, y, 12, ['#aaeeff','#66ccff','#ffffff','#88ddff'], 170, 0.5, 50, 3.5);
    this._burst(x, y, 6,  ['#ddeeff','#99bbff'], 230, 0.35, 70, 1.5);
  }

  burnTick(x, y) {
    const ox = (Math.random() - 0.5) * 12;
    const oy = (Math.random() - 0.5) * 12;
    this._burst(x + ox, y + oy, 2, ['#ff7722','#ff5500','#ffaa44'], 55, 0.5, -130, 2);
  }

  electricZap(fx, fy, tx, ty) {
    this._burst(fx, fy, 3, ['#ffff88','#88ffff'], 70, 0.2, 0, 2);
    this._burst(tx, ty, 8, ['#ffff44','#44eeff','#ffffff'], 130, 0.4, 50, 2.5);
    const steps = 3;
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      const mx = fx + (tx - fx) * t + (Math.random() - 0.5) * 18;
      const my = fy + (ty - fy) * t + (Math.random() - 0.5) * 18;
      this._burst(mx, my, 2, ['#ffff66','#66ffff'], 40, 0.18, 0, 1.5);
    }
  }

  beamHit(x, y) {
    this._burst(x, y, 7, ['#aaeeff','#ffffff','#66ccff'], 160, 0.3, 0, 3);
  }

  poisonHit(x, y) {
    this._burst(x, y, 10, ['#88ff44','#44cc44','#ccff44'], 140, 0.5, 30, 3);
  }

  poisonTick(x, y) {
    const ox = (Math.random() - 0.5) * 10;
    const oy = (Math.random() - 0.5) * 10;
    this._burst(x + ox, y + oy, 2, ['#88ee44','#55bb33'], 45, 0.45, -80, 2);
  }

  meteorExplosion(x, y) {
    this._burst(x, y, 20, ['#ff4400','#ff8800','#ffcc00','#ffffff'], 250, 0.7, 80, 5);
    this._burst(x, y, 10, ['#882200','#cc4400'], 400, 0.5, 60, 3);
  }

  strikeHit(x, y) {
    this._burst(x, y, 8, ['#ffeeaa','#ffffff','#ffcc44'], 180, 0.35, 50, 3);
  }

  orbHit(x, y, color) {
    this._burst(x, y, 6, [color, '#ffffff'], 120, 0.3, 30, 2.5);
  }
}
