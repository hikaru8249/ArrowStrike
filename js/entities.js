class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = CONFIG.PLAYER.radius;
    this.maxHp = CONFIG.PLAYER.hp; this.hp = CONFIG.PLAYER.hp;
    this.atk = CONFIG.PLAYER.atk;
    this.fireRateMs = CONFIG.PLAYER.fireRateMs;
    this.speed = CONFIG.PLAYER.speed;
    this.range = CONFIG.PLAYER.range;
    this.level = 1; this.xp = 0; this.xpToNext = CONFIG.XP_BASE;
    this.kills = 0; this.gold = 0; this.goldMul = 0;
    this.multi = 0; this.pierce = 0; this.crit = 0;
    this.lifesteal = 0; this.thorns = 0; this.backshot = false;
    this.xpMul = 0; this.chain = 0;
    this.electric = 0; this.beam = 0;
    this.fire = 0; this.ice = 0; this.aimAngle = 0;
    this.skillStacks = {}; this.shopStacks = {};
    this.poison = 0;
    this.superFire = 0; this.superIce = 0; this.superElectric = 0; this.superPoison = 0;
    this.diagonal = 0; this.homing = false; this.splitArrow = 0; this.bounceArrow = 0;
    this.strikeBlast = 0; this.strikeCombo = 0;
    this.meteorKill = 0; this.meteorCombo = 0;
    this.shieldSkill = 0; this.shieldCount = 0;
    this.reviveSkill = false; this.reviveUsed = false;
    this.hpRegen = 0; this.regenTimer = 0;
    this.killRegen = 0;
    this.bossKiller = 0;
    this.berserker = 0;
    this.woundWarrior = 0; this.woundTimer = 0;
    this.killWarrior = 0; this.killWarriorTimer = 0;
    this.slowField = 0;
    // Animation state
    this.animTime   = 0;
    this.isWalking  = false;
    this.attackAnim = 0;  // 1→0 after fire (bow snap-back)
    this.attackFlash= 0;  // 1→0 brief muzzle flash
  }

  move(targetX, targetY, dt, room) {
    const dx = targetX - this.x; const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < CONFIG.DEADZONE) return;
    const move = this.speed * dt * 60;
    this.x += (dx / dist) * Math.min(move, dist);
    this.y += (dy / dist) * Math.min(move, dist);
    const r = this.radius;
    this.x = Math.max(room.x + r, Math.min(room.x + room.w - r, this.x));
    this.y = Math.max(room.y + r, Math.min(room.y + room.h - r, this.y));
  }

  takeDamage(amount) { this.hp = Math.max(0, this.hp - amount); return this.hp <= 0; }
  heal(amount)       { this.hp = Math.min(this.maxHp, this.hp + amount); }
}

// ─── Enemy ────────────────────────────────────────────────────────────────────

class Enemy {
  constructor(x, y, stage, type = 'n', skipFade = false) {
    this.x = x; this.y = y;
    this.type = type;
    this.isMini = false;

    const cfg = CONFIG.ENEMY_TYPES[type] || CONFIG.ENEMY_TYPES.n;
    this.radius  = cfg.radius;
    this.maxHp   = cfg.baseHp + stage * cfg.hpMul;
    this.hp      = this.maxHp;
    this.dmg     = cfg.baseDmg + stage * cfg.dmgMul;
    this.speed   = cfg.baseSpeed + stage * cfg.speedMul;
    this.color   = cfg.color;
    this.xp      = cfg.xp;
    this.gold    = cfg.gold;

    // Shooting
    this.fireRate    = cfg.fireRate || 0;
    this.bulletSpeed = cfg.bulletSpeed || 0;
    this.bulletDmg   = (cfg.bulletDmgBase || 0) + stage * (cfg.bulletDmgMul || 0);
    // Stagger initial fire to avoid synchronized volley
    this.fireTimer = this.fireRate > 0 ? Math.random() / this.fireRate : 0;

    // Boss phase 2
    this.isPhase2         = false;
    this._phase2Done      = false;
    this.justEnteredPhase2 = false;
    this.phase2Color      = cfg.phase2Color      || cfg.color;
    this.phase2FireRate   = cfg.phase2FireRate    || this.fireRate;
    this.phase2BulletCount= cfg.phase2BulletCount || 1;
    this.phase2SpeedBoost = cfg.phase2SpeedBoost  || 1;

    this.bulletElem = cfg.bulletElem || 'normal';
    this.teleportTimer = cfg.teleportCooldown || 0;
    this.teleportCooldown = cfg.teleportCooldown || 0;
    this.bombTimer = 0;

    this.dead = false;
    this.burnTimer = 0; this.burnDps = 0;
    this.slowTimer = 0; this.speedMod = 1;
    this.poisonTimer = 0; this.poisonDps = 0;

    // Fade-in
    if (skipFade) {
      this.alpha = 1; this.isInvincible = false; this.fadeTimer = CONFIG.SPAWN.fadeMs;
    } else {
      this.alpha = 0; this.isInvincible = true; this.fadeTimer = 0;
    }
  }

  static createMini(x, y, stage) {
    const jitter = () => (Math.random() - 0.5) * 24;
    const e = new Enemy(x + jitter(), y + jitter(), stage, 'p', true);
    e.isMini   = true;
    e.radius   = 9;
    e.maxHp    = Math.floor(e.maxHp * 0.45);
    e.hp       = e.maxHp;
    e.dmg      = Math.max(1, Math.floor(e.dmg * 0.5));
    e.speed   *= 1.3;
    e.xp       = Math.floor(e.xp * 0.4);
    e.gold     = Math.floor(e.gold * 0.4);
    return e;
  }

  update(dt) {
    this.justEnteredPhase2 = false;
    if (this.isInvincible) {
      this.fadeTimer += dt * 1000;
      this.alpha = Math.min(1, this.fadeTimer / CONFIG.SPAWN.fadeMs);
      if (this.fadeTimer >= CONFIG.SPAWN.fadeMs) { this.alpha = 1; this.isInvincible = false; }
    }
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) { this.slowTimer = 0; this.speedMod = 1; }
    }
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      if (this.burnTimer <= 0) { this.burnTimer = 0; this.burnDps = 0; }
    }
    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      if (this.poisonTimer <= 0) { this.poisonTimer = 0; this.poisonDps = 0; }
    }
    // Boss phase 2 transition at 50% HP
    if (this.type.startsWith('boss') && !this._phase2Done && !this.isInvincible && this.hp <= this.maxHp * 0.5) {
      this._phase2Done       = true;
      this.isPhase2          = true;
      this.justEnteredPhase2 = true;
      this.color             = this.phase2Color;
      this.speed            *= this.phase2SpeedBoost;
    }
  }

  pursue(playerX, playerY, dt, room) {
    if (this.isInvincible) return;
    const dx = playerX - this.x; const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const move = this.speed * this.speedMod * dt * 60;
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    const r = this.radius;
    this.x = Math.max(room.x + r, Math.min(room.x + room.w - r, this.x));
    this.y = Math.max(room.y + r, Math.min(room.y + room.h - r, this.y));
  }

  takeDamage(amount) {
    if (this.isInvincible || this.dead) return false;
    this.hp -= amount;
    if (this.hp <= 0) { this.dead = true; return true; }
    return false;
  }
}

// ─── Arrow ────────────────────────────────────────────────────────────────────

class Arrow {
  constructor(x, y, vx, vy, atk, piercesLeft, isCrit, elemType) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.atk = atk;
    this.piercesLeft = piercesLeft || 0;
    this.isCrit = isCrit || false;
    this.elemType = elemType || 'normal';
    this.active = true;
    this.radius = CONFIG.ARROW.radius;
    this.angle  = Math.atan2(vy, vx);
    this.homing = false;
    this.bouncesLeft = 0;
    this.splitCount = 0;
    this.isSplit = false; // split arrows don't re-split
  }

  update(dt, room) {
    if (!this.active) return;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.bouncesLeft > 0) {
      let bounced = false;
      if (this.x < room.x) { this.x = room.x; this.vx = Math.abs(this.vx); this.angle = Math.atan2(this.vy, this.vx); bounced = true; }
      else if (this.x > room.x + room.w) { this.x = room.x + room.w; this.vx = -Math.abs(this.vx); this.angle = Math.atan2(this.vy, this.vx); bounced = true; }
      if (this.y < room.y) { this.y = room.y; this.vy = Math.abs(this.vy); this.angle = Math.atan2(this.vy, this.vx); bounced = true; }
      else if (this.y > room.y + room.h) { this.y = room.y + room.h; this.vy = -Math.abs(this.vy); this.angle = Math.atan2(this.vy, this.vx); bounced = true; }
      if (bounced) this.bouncesLeft--;
    } else {
      if (this.x < room.x || this.x > room.x + room.w ||
          this.y < room.y || this.y > room.y + room.h) this.active = false;
    }
  }
}

// ─── EnemyBullet ─────────────────────────────────────────────────────────────

class EnemyBullet {
  constructor(x, y, vx, vy, dmg, color) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.dmg   = dmg;
    this.color = color || '#ff6666';
    this.radius = CONFIG.BULLET.radius;
    this.active = true;
    this.age = 0;
  }

  update(dt, room) {
    if (!this.active) return;
    this.age += dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.age > 4 ||
        this.x < room.x || this.x > room.x + room.w ||
        this.y < room.y || this.y > room.y + room.h) this.active = false;
  }
}

// ─── Coin ─────────────────────────────────────────────────────────────────────

class Coin {
  constructor(x, y, value) {
    this.x = x; this.y = y; this.value = value;
    const angle = Math.random() * Math.PI * 2;
    const spd   = CONFIG.COINS.baseSpeed * (0.5 + Math.random());
    this.vx = Math.cos(angle) * spd; this.vy = Math.sin(angle) * spd;
    this.radius = CONFIG.COINS.radius;
    this.lifetime = CONFIG.COINS.lifetime * (0.9 + Math.random() * 0.2);
    this.age = 0; this.active = true; this.blinkPhase = 0;
  }

  update(dt, room) {
    if (!this.active) return;
    this.age += dt;
    if (this.age >= this.lifetime) { this.active = false; return; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    const fric = Math.pow(CONFIG.COINS.friction, dt * 60);
    this.vx *= fric; this.vy *= fric;
    const r = this.radius; const rest = CONFIG.COINS.restitution;
    if (this.x < room.x + r)          { this.x = room.x + r;          this.vx =  Math.abs(this.vx) * rest; }
    if (this.x > room.x + room.w - r) { this.x = room.x + room.w - r; this.vx = -Math.abs(this.vx) * rest; }
    if (this.y < room.y + r)          { this.y = room.y + r;          this.vy =  Math.abs(this.vy) * rest; }
    if (this.y > room.y + room.h - r) { this.y = room.y + room.h - r; this.vy = -Math.abs(this.vy) * rest; }
    if (this.age >= this.lifetime - CONFIG.COINS.blinkAt) this.blinkPhase += dt * 9;
  }

  get visible() {
    if (this.age < this.lifetime - CONFIG.COINS.blinkAt) return true;
    return Math.sin(this.blinkPhase) > 0;
  }
}

// ─── Strike ───────────────────────────────────────────────────────────────────

class Strike {
  constructor(x, y, vx, vy, atk) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.atk = atk; this.radius = 9;
    this.active = true; this.age = 0; this.maxAge = 1.4;
    this.hitEnemies = new Set();
    this.angle = Math.atan2(vy, vx);
  }

  update(dt, room) {
    if (!this.active) return;
    this.age += dt;
    if (this.age >= this.maxAge) { this.active = false; return; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < room.x || this.x > room.x + room.w ||
        this.y < room.y || this.y > room.y + room.h) this.active = false;
  }
}

// ─── Meteor ───────────────────────────────────────────────────────────────────

class Meteor {
  constructor(tx, ty, atk, elemType) {
    this.x = tx; this.y = CONFIG.ROOM.y - 80;
    this.targetX = tx; this.targetY = ty;
    this.atk = atk; this.elemType = elemType || 'fire';
    this.blastRadius = CONFIG.METEOR_BLAST_RADIUS; this.radius = 7;
    this.speed = 480; this.active = true; this.exploded = false;
    this.vy = this.speed; this.vx = 0;
  }

  update(dt) {
    if (!this.active || this.exploded) return;
    this.y += this.vy * dt;
    if (this.y >= this.targetY) { this.y = this.targetY; this.exploded = true; }
  }
}

// ─── Orb ──────────────────────────────────────────────────────────────────────

class Orb {
  constructor(elemType, orbitR, angle, speed) {
    this.elemType = elemType; this.orbitR = orbitR;
    this.angle = angle; this.speed = speed;
    this.orbRadius = 10; this.active = true;
    this.hitCooldowns = new Map();
  }

  update(dt) {
    this.angle += this.speed * dt;
    for (const [e, t] of this.hitCooldowns) {
      this.hitCooldowns.set(e, t - dt);
      if (this.hitCooldowns.get(e) <= 0) this.hitCooldowns.delete(e);
    }
  }

  getPos(px, py) {
    return { x: px + Math.cos(this.angle) * this.orbitR, y: py + Math.sin(this.angle) * this.orbitR };
  }
}

// ─── Beam ─────────────────────────────────────────────────────────────────────

class Beam {
  constructor(x, y, angle) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.life = 0.35;
    this.maxLife = 0.35;
    this.active = true;
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
}

// ─── Bomb ─────────────────────────────────────────────────────────────────────

class Bomb {
  constructor(fromX, fromY, toX, toY, atk) {
    this.x = fromX; this.y = fromY;
    this.targetX = toX; this.targetY = toY;
    this.atk = atk;
    this.blastRadius = 65;
    this.radius = 9;
    this.active = true;
    this.exploded = false;
    const dx = toX - fromX; const dy = toY - fromY;
    this.totalDist = Math.hypot(dx, dy) || 1;
    this.speed = 310;
    this.vx = (dx / this.totalDist) * this.speed;
    this.vy = (dy / this.totalDist) * this.speed;
    this.traveled = 0;
    this.angle = Math.atan2(dy, dx);
  }

  update(dt) {
    if (!this.active || this.exploded) return;
    this.traveled += this.speed * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.traveled >= this.totalDist) {
      this.x = this.targetX; this.y = this.targetY;
      this.exploded = true;
    }
  }
}
