class SpawnSystem {
  constructor() {
    this.queue = []; this.activeEnemies = [];
    this.frameCount = 0; this.interval = 60;
    this.stage = 1; this._room = CONFIG.ROOM;
    this.isBossStage = false;
    this.justSpawnedBossAt = null;
    this.hpScale = 1.0;
  }

  setupStage(stage, room) {
    this.stage = stage; this._room = room;
    this.hpScale = 1.0;
    this.activeEnemies = [];
    this.frameCount = 0; this.interval = this._randInterval();
    this.isBossStage = (stage % 5 === 0);

    if (this.isBossStage) {
      const pool    = CONFIG.stageEnemyPool(stage);
      const mCount  = 5 + Math.floor(stage * 0.3);
      const pre     = Math.min(2, mCount);
      this.queue = [];
      for (let i = 0; i < pre; i++)        this.queue.push(pool[Math.floor(Math.random() * pool.length)]);
      const bTypes = CONFIG.BOSS_TYPES || ['boss'];
      this.queue.push(bTypes[Math.floor(Math.random() * bTypes.length)]);
      for (let i = pre; i < mCount; i++)   this.queue.push(pool[Math.floor(Math.random() * pool.length)]);
    } else {
      const pool  = CONFIG.stageEnemyPool(stage);
      const count = 7 + Math.floor(stage * 1.1);
      this.queue = Array.from({length: count}, () => pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  _randInterval() {
    return Math.floor(Math.random() * (CONFIG.SPAWN.intervalMax - CONFIG.SPAWN.intervalMin + 1))
      + CONFIG.SPAWN.intervalMin;
  }

  update(dt, playerPos, combatSystem) {
    this.justSpawnedBossAt = null;

    for (const e of this.activeEnemies) {
      e.update(dt);
      e.pursue(playerPos.x, playerPos.y, dt, this._room);

      if (!e.isInvincible) {
        // Shadow boss: teleport
        if (e.type === 'boss_shadow' && e.teleportCooldown > 0) {
          e.teleportTimer -= dt;
          if (e.teleportTimer <= 0) {
            e.teleportTimer = e.isPhase2 ? e.teleportCooldown * 0.55 : e.teleportCooldown;
            const r = this._room;
            for (let i = 0; i < 20; i++) {
              const nx = r.x + 40 + Math.random() * (r.w - 80);
              const ny = r.y + 40 + Math.random() * (r.h - 80);
              if (Math.hypot(nx - playerPos.x, ny - playerPos.y) > 80) { e.x = nx; e.y = ny; break; }
            }
          }
        }

        // Bomb boss: throw bombs instead of bullets
        if (e.type === 'boss_bomb') {
          e.bombTimer -= dt;
          const rate = e.isPhase2 ? e.phase2FireRate : e.fireRate;
          if (rate > 0 && e.bombTimer <= 0) {
            e.bombTimer = 1 / rate;
            const count = e.isPhase2 ? e.phase2BulletCount : 1;
            const cfg = CONFIG.ENEMY_TYPES.boss_bomb;
            const dmg = (cfg.bombDmgBase || 28) + this.stage * (cfg.bombDmgMul || 4);
            combatSystem.spawnBossBomb(e, playerPos, count, dmg);
          }
        } else if (e.fireRate > 0) {
          combatSystem.tickEnemyFire(dt, e, playerPos.x, playerPos.y);
        }
      }
    }

    this.frameCount++;
    if (this.frameCount < this.interval || this.queue.length === 0) return;

    const batch = this.stage <= 3 ? 1 : this.stage <= 7 ? 2 : 3;
    for (let b = 0; b < batch && this.queue.length > 0; b++) {
      const nextType = this.queue[0];
      const minionCount = this.activeEnemies.filter(e => !e.type.startsWith('boss')).length;
      const canSpawn = nextType.startsWith('boss') || minionCount < CONFIG.SPAWN.maxActive;
      if (!canSpawn) break;
      this.queue.shift();
      const pos = this._pickPos(playerPos, nextType.startsWith('boss') ? 50 : CONFIG.ENEMY_NORMAL?.radius ?? 14);
      const e = new Enemy(pos.x, pos.y, this.stage, nextType);
      if (this.hpScale !== 1.0) { e.maxHp = Math.round(e.maxHp * this.hpScale); e.hp = e.maxHp; }
      this.activeEnemies.push(e);
      if (nextType.startsWith('boss')) { this.justSpawnedBossAt = pos; break; }
    }
    this.frameCount = 0;
    this.interval = this._randInterval();
  }

  _pickPos(playerPos, radius = 14) {
    const room = this._room; const r = radius + 6; const minD = CONFIG.SPAWN.minDist;
    let best = null; let bestD = 0;
    for (let i = 0; i < 40; i++) {
      const x = room.x + r + Math.random() * (room.w - r * 2);
      const y = room.y + r + Math.random() * (room.h - r * 2);
      const d = Math.hypot(x - playerPos.x, y - playerPos.y);
      if (d >= minD) return { x, y };
      if (d > bestD) { bestD = d; best = { x, y }; }
    }
    return best || { x: room.x + room.w / 2, y: room.y + 70 };
  }

  removeEnemy(enemy) {
    const i = this.activeEnemies.indexOf(enemy);
    if (i >= 0) this.activeEnemies.splice(i, 1);
  }

  clearAll() { this.activeEnemies = []; this.queue = []; }

  allDead()              { return this.queue.length === 0 && this.activeEnemies.length === 0; }
  get enemiesRemaining() { return this.queue.length + this.activeEnemies.length; }
  get activeBoss()       { return this.activeEnemies.find(e => e.type.startsWith('boss')) || null; }
}

// ─── CombatSystem ─────────────────────────────────────────────────────────────

class CombatSystem {
  constructor() {
    this.lastFireTime   = 0;
    this.arrows         = [];
    this.enemyBullets   = [];
    this.beams          = [];
    this.strikes        = [];
    this.meteors        = [];
    this.bombs          = [];
    this.beamTimer      = 0;
    this.justFired      = false;
    this.justFiredBeam  = false;
    this.justFiredStrike = false;
    this.justFiredMeteor = false;
    this.arrowHitEvents = [];
    this.electricEvents = [];
    this.beamHitEvents  = [];
    this.newArrows      = [];
  }

  // Player auto-fire
  update(now, player, activeEnemies) {
    this.justFired = false;
    if (now - this.lastFireTime < player.fireRateMs / 1000) return;
    let nearest = null; let nearestDist = Infinity;
    for (const e of activeEnemies) {
      if (e.isInvincible) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d <= player.range && d < nearestDist) { nearestDist = d; nearest = e; }
    }
    if (nearest) {
      this._spawnArrowGroup(player, nearest.x, nearest.y);
      this.lastFireTime = now;
      this.justFired = true;
    }
  }

  _spawnArrowGroup(player, tx, ty) {
    const baseAngle = Math.atan2(ty - player.y, tx - player.x);
    player.aimAngle = baseAngle;
    const total = 1 + player.multi;
    const spread = 15 * Math.PI / 180;
    for (let i = 0; i < total; i++) {
      const off = total === 1 ? 0 : (i - (total-1)/2) * spread;
      this._spawnOne(player, baseAngle + off);
    }
    if (player.backshot) this._spawnOne(player, baseAngle + Math.PI);
    // Diagonal arrows: each stack adds ±45° pair
    if (player.diagonal > 0) {
      for (let d = 0; d < player.diagonal; d++) {
        this._spawnOne(player, baseAngle + Math.PI / 4 * (d * 2 + 1));
        this._spawnOne(player, baseAngle - Math.PI / 4 * (d * 2 + 1));
      }
    }
    // Strike blast chance
    if (player.strikeBlast > 0 && Math.random() < 0.25 * player.strikeBlast) {
      this.justFiredStrike = true;
    }
    // Meteor combo chance
    if (player.meteorCombo > 0 && Math.random() < 0.20 * player.meteorCombo) {
      this.justFiredMeteor = true;
    }
  }

  _spawnOne(player, angle, isSplit) {
    const isCrit = Math.random() < player.crit;
    const atk    = isCrit ? player.atk * 2 : player.atk;
    const s = CONFIG.ARROW.speed;
    const elemType = player.fire > 0 && player.ice > 0
      ? (Math.random() < 0.5 ? 'fire' : 'ice')
      : player.fire > 0 ? 'fire'
      : player.ice > 0 ? 'ice'
      : player.poison > 0 ? 'poison'
      : 'normal';
    const arrow = new Arrow(player.x, player.y, Math.cos(angle)*s, Math.sin(angle)*s, atk, player.pierce, isCrit, elemType);
    arrow.homing = player.homing;
    arrow.bouncesLeft = player.bounceArrow;
    arrow.splitCount = isSplit ? 0 : player.splitArrow;
    arrow.isSplit = !!isSplit;
    this.arrows.push(arrow);
  }

  // Enemy fires at player
  tickEnemyFire(dt, enemy, playerX, playerY) {
    const rate = enemy.isPhase2 ? enemy.phase2FireRate : enemy.fireRate;
    if (!rate) return;
    enemy.fireTimer += dt;
    if (enemy.fireTimer < 1 / rate) return;
    enemy.fireTimer = 0;

    const dx = playerX - enemy.x; const dy = playerY - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    const s   = enemy.bulletSpeed;
    const dmg = enemy.bulletDmg;
    const elemCol = { fire:'#FF5500', ice:'#44BBFF', poison:'#55EE55', shadow:'#BB66FF' };
    const col = elemCol[enemy.bulletElem] || (enemy.isPhase2 ? '#ff4444' : '#cc2222');
    const count = enemy.isPhase2 ? enemy.phase2BulletCount : 1;

    // Shadow boss phase2: radial burst
    if (enemy.type === 'boss_shadow' && enemy.isPhase2) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.enemyBullets.push(new EnemyBullet(enemy.x, enemy.y, Math.cos(a)*s, Math.sin(a)*s, dmg, col));
      }
      return;
    }

    if (count === 1) {
      this.enemyBullets.push(new EnemyBullet(enemy.x, enemy.y, (dx/dist)*s, (dy/dist)*s, dmg, col));
    } else {
      const base = Math.atan2(dy, dx);
      const step = 28 * Math.PI / 180;
      for (let i = -(count-1)/2; i <= (count-1)/2; i++) {
        const a = base + i * step;
        this.enemyBullets.push(new EnemyBullet(enemy.x, enemy.y, Math.cos(a)*s, Math.sin(a)*s, dmg, col));
      }
    }
  }

  updateArrows(dt, room, activeEnemies) {
    for (const a of this.arrows) {
      if (a.homing && activeEnemies && activeEnemies.length > 0) {
        let nearest = null; let nd = Infinity;
        for (const e of activeEnemies) {
          if (e.isInvincible || e.dead) continue;
          const d = Math.hypot(e.x - a.x, e.y - a.y);
          if (d < nd) { nd = d; nearest = e; }
        }
        if (nearest) {
          const ta = Math.atan2(nearest.y - a.y, nearest.x - a.x);
          const ca = Math.atan2(a.vy, a.vx);
          let diff = ta - ca;
          while (diff >  Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          const turn = Math.sign(diff) * Math.min(Math.abs(diff), 4 * dt);
          const na = ca + turn;
          const spd = Math.hypot(a.vx, a.vy);
          a.vx = Math.cos(na) * spd; a.vy = Math.sin(na) * spd; a.angle = na;
        }
      }
      a.update(dt, room);
    }
    this.arrows = this.arrows.filter(a => a.active);
  }

  updateEnemyBullets(dt, room) {
    for (const b of this.enemyBullets) b.update(dt, room);
    this.enemyBullets = this.enemyBullets.filter(b => b.active);
  }

  processArrowHits(activeEnemies, player) {
    this.arrowHitEvents = [];
    this.electricEvents = [];
    this.newArrows = [];
    const killed = [];
    for (const arrow of this.arrows) {
      if (!arrow.active) continue;
      for (const enemy of activeEnemies) {
        if (!arrow.active && arrow.piercesLeft <= 0) break;
        if (enemy.isInvincible || enemy.dead) continue;
        if (Math.hypot(arrow.x - enemy.x, arrow.y - enemy.y) < arrow.radius + enemy.radius) {
          this.arrowHitEvents.push({ x: enemy.x, y: enemy.y, isCrit: arrow.isCrit, type: enemy.type, elemType: arrow.elemType });
          // Compute atk with buffs
          let atkMul = 1;
          if (player.berserker > 0 && player.hp < player.maxHp * 0.5) atkMul *= (1 + 0.4 * player.berserker);
          if (player.woundWarrior > 0 && player.woundTimer > 0) atkMul *= (1 + 0.6 * player.woundWarrior);
          if (player.killWarrior > 0 && player.killWarriorTimer > 0) atkMul *= (1 + 0.3 * player.killWarrior);
          if (player.bossKiller > 0 && enemy.type.startsWith('boss')) atkMul *= (1 + 0.5 * player.bossKiller);
          const finalAtk = Math.max(1, Math.floor(arrow.atk * atkMul));
          if (enemy.takeDamage(finalAtk)) killed.push(enemy);
          if (player.lifesteal > 0) player.heal(Math.max(1, Math.floor(finalAtk * player.lifesteal)));
          if (!enemy.dead) {
            if (player.fire > 0) {
              const dur = CONFIG.BURN_DURATION * (1 + player.superFire * 0.4);
              const dps = player.atk * CONFIG.BURN_DPS_FACTOR * player.fire * (1 + player.superFire);
              enemy.burnTimer = dur; enemy.burnDps = dps;
            }
            if (player.ice > 0) {
              const dur = CONFIG.SLOW_DURATION * (1 + player.superIce * 0.4);
              const factor = player.superIce > 0 ? 0.2 : CONFIG.SLOW_FACTOR;
              enemy.slowTimer = dur; enemy.speedMod = factor;
            }
            if (player.poison > 0) {
              const dur = CONFIG.POISON_DURATION * (1 + player.superPoison * 0.4);
              const dps = player.atk * CONFIG.POISON_DPS_FACTOR * player.poison * (1 + player.superPoison);
              enemy.poisonTimer = dur; enemy.poisonDps = dps;
            }
          }
          if (player.electric > 0) {
            if (player.superElectric > 0) {
              this._processElectricCustom(enemy, activeEnemies, player, killed,
                CONFIG.ELECTRIC_RADIUS * 1.5, 2);
            } else {
              this._processElectric(enemy, activeEnemies, player, killed);
            }
          }
          // Split arrow: spawn split arrows on hit (only non-split arrows split)
          if (arrow.splitCount > 0 && !arrow.isSplit) {
            const perpA = arrow.angle + Math.PI / 2;
            const perpB = arrow.angle - Math.PI / 2;
            const spd = Math.hypot(arrow.vx, arrow.vy);
            const splitArrow1 = new Arrow(enemy.x, enemy.y, Math.cos(perpA) * spd, Math.sin(perpA) * spd,
              Math.max(1, Math.floor(arrow.atk * 0.7)), 0, arrow.isCrit, arrow.elemType);
            splitArrow1.isSplit = true; splitArrow1.homing = false; splitArrow1.bouncesLeft = 0;
            const splitArrow2 = new Arrow(enemy.x, enemy.y, Math.cos(perpB) * spd, Math.sin(perpB) * spd,
              Math.max(1, Math.floor(arrow.atk * 0.7)), 0, arrow.isCrit, arrow.elemType);
            splitArrow2.isSplit = true; splitArrow2.homing = false; splitArrow2.bouncesLeft = 0;
            this.newArrows.push(splitArrow1, splitArrow2);
          }
          if (arrow.piercesLeft > 0) arrow.piercesLeft--;
          else arrow.active = false;
        }
      }
    }
    this.arrows = this.arrows.filter(a => a.active);
    if (this.newArrows.length > 0) {
      this.arrows.push(...this.newArrows);
      this.newArrows = [];
    }
    return killed;
  }

  _processElectric(source, activeEnemies, player, killed) {
    const zapDmg = Math.max(1, Math.floor(player.atk * 0.35 * player.electric));
    for (const nearby of activeEnemies) {
      if (nearby === source || nearby.isInvincible || nearby.dead) continue;
      if (Math.hypot(nearby.x - source.x, nearby.y - source.y) <= CONFIG.ELECTRIC_RADIUS) {
        this.electricEvents.push({ fromX: source.x, fromY: source.y, toX: nearby.x, toY: nearby.y });
        if (nearby.takeDamage(zapDmg)) killed.push(nearby);
      }
    }
  }

  _processElectricCustom(source, activeEnemies, player, killed, radius, damageMul) {
    const zapDmg = Math.max(1, Math.floor(player.atk * 0.35 * player.electric * damageMul));
    for (const nearby of activeEnemies) {
      if (nearby === source || nearby.isInvincible || nearby.dead) continue;
      if (Math.hypot(nearby.x - source.x, nearby.y - source.y) <= radius) {
        this.electricEvents.push({ fromX: source.x, fromY: source.y, toX: nearby.x, toY: nearby.y });
        if (nearby.takeDamage(zapDmg)) killed.push(nearby);
      }
    }
  }

  processPoison(dt, activeEnemies) {
    const killed = [];
    for (const e of activeEnemies) {
      if (e.isInvincible || e.dead || e.poisonTimer <= 0) continue;
      if (e.takeDamage(e.poisonDps * dt)) killed.push(e);
    }
    return killed;
  }

  processOrbHits(orbs, player, activeEnemies) {
    const killed = [];
    for (const orb of orbs) {
      if (!orb.active) continue;
      const pos = orb.getPos(player.x, player.y);
      for (const e of activeEnemies) {
        if (e.isInvincible || e.dead) continue;
        if (orb.hitCooldowns.has(e)) continue;
        if (Math.hypot(pos.x - e.x, pos.y - e.y) < orb.orbRadius + e.radius) {
          orb.hitCooldowns.set(e, 0.8);
          const dmg = Math.max(1, Math.floor(player.atk * 0.55));
          if (!e.dead) {
            if (orb.elemType === 'fire') {
              e.burnTimer = CONFIG.BURN_DURATION * (1 + player.superFire * 0.4);
              e.burnDps = player.atk * CONFIG.BURN_DPS_FACTOR * (1 + player.superFire);
            }
            if (orb.elemType === 'ice') {
              e.slowTimer = CONFIG.SLOW_DURATION * (1 + player.superIce * 0.4);
              e.speedMod = player.superIce > 0 ? 0.2 : CONFIG.SLOW_FACTOR;
            }
            if (orb.elemType === 'electric') {
              const r = CONFIG.ELECTRIC_RADIUS * (1 + player.superElectric * 0.5);
              const mul = player.superElectric > 0 ? 2 : 1;
              this._processElectricCustom(e, activeEnemies, player, killed, r, mul);
            }
            if (orb.elemType === 'poison') {
              e.poisonTimer = CONFIG.POISON_DURATION * (1 + player.superPoison * 0.4);
              e.poisonDps = player.atk * CONFIG.POISON_DPS_FACTOR * (1 + player.superPoison);
            }
          }
          if (e.takeDamage(dmg)) killed.push(e);
        }
      }
    }
    return killed;
  }

  updateStrikes(dt, room) {
    for (const s of this.strikes) s.update(dt, room);
    this.strikes = this.strikes.filter(s => s.active);
  }

  processStrikeHits(activeEnemies, player) {
    const killed = [];
    for (const s of this.strikes) {
      if (!s.active) continue;
      for (const e of activeEnemies) {
        if (e.isInvincible || e.dead || s.hitEnemies.has(e)) continue;
        if (Math.hypot(s.x - e.x, s.y - e.y) < s.radius + e.radius) {
          s.hitEnemies.add(e);
          if (e.takeDamage(s.atk)) killed.push(e);
        }
      }
    }
    return killed;
  }

  spawnStrike(player, activeEnemies) {
    let nearest = null; let nd = Infinity;
    for (const e of activeEnemies) {
      if (e.isInvincible || e.dead) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < nd) { nd = d; nearest = e; }
    }
    if (!nearest) return;
    const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
    const spd = CONFIG.STRIKE_SPEED;
    const atk = Math.max(1, Math.floor(player.atk * 0.65));
    this.strikes.push(new Strike(player.x, player.y, Math.cos(angle) * spd, Math.sin(angle) * spd, atk));
  }

  updateMeteors(dt) {
    for (const m of this.meteors) m.update(dt);
  }

  processMeteorHits(activeEnemies, player) {
    const killed = [];
    const exploded = [];
    for (const m of this.meteors) {
      if (!m.active || !m.exploded) continue;
      exploded.push(m);
      const atk = Math.max(1, Math.floor(player.atk * 1.5));
      for (const e of activeEnemies) {
        if (e.isInvincible || e.dead) continue;
        if (Math.hypot(m.x - e.x, m.y - e.y) < m.blastRadius + e.radius) {
          if (m.elemType === 'fire' && !e.dead) { e.burnTimer = CONFIG.BURN_DURATION; e.burnDps = player.atk * CONFIG.BURN_DPS_FACTOR; }
          if (e.takeDamage(atk)) killed.push(e);
        }
      }
      m.active = false;
    }
    this.meteors = this.meteors.filter(m => m.active);
    return { killed, exploded };
  }

  spawnMeteor(player, targetX, targetY) {
    const atk = Math.max(1, Math.floor(player.atk * 1.4));
    const elemType = player.fire > 0 ? 'fire' : player.ice > 0 ? 'ice' : 'fire';
    this.meteors.push(new Meteor(targetX, targetY, atk, elemType));
  }

  spawnBossBomb(boss, playerPos, count, atk) {
    const spread = 55;
    for (let i = 0; i < count; i++) {
      const tx = playerPos.x + (Math.random() - 0.5) * spread * 2;
      const ty = playerPos.y + (Math.random() - 0.5) * spread * 2;
      this.bombs.push(new Bomb(boss.x, boss.y, tx, ty, atk));
    }
  }

  updateBombs(dt) {
    for (const b of this.bombs) b.update(dt);
    this.bombs = this.bombs.filter(b => b.active);
  }

  processBombHits(player) {
    const exploded = []; let playerHit = false;
    for (const b of this.bombs) {
      if (!b.active || !b.exploded) continue;
      b.active = false;
      exploded.push({ x: b.x, y: b.y });
      if (Math.hypot(player.x - b.x, player.y - b.y) < b.blastRadius + player.radius) {
        playerHit = true;
        if (player.shieldCount > 0) { player.shieldCount--; }
        else { player.takeDamage(b.atk); }
      }
    }
    return { exploded, playerHit };
  }

  updateBeams(dt) {
    for (const b of this.beams) b.update(dt);
    this.beams = this.beams.filter(b => b.active);
  }

  fireBeamIfReady(dt, player, activeEnemies) {
    this.beamHitEvents = [];
    this.justFiredBeam = false;
    if (player.beam <= 0) return [];

    this.beamTimer += dt;
    const cooldown = CONFIG.BEAM_COOLDOWN[Math.min(player.beam - 1, CONFIG.BEAM_COOLDOWN.length - 1)];
    if (this.beamTimer < cooldown) return [];
    this.beamTimer -= cooldown;

    let nearest = null; let nearestDist = Infinity;
    for (const e of activeEnemies) {
      if (e.isInvincible || e.dead) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < nearestDist) { nearestDist = d; nearest = e; }
    }
    if (!nearest) return [];

    const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
    this.beams.push(new Beam(player.x, player.y, angle));
    this.justFiredBeam = true;

    const atk = Math.max(1, Math.floor(player.atk * 0.5 * player.beam));
    const killed = [];
    for (const e of activeEnemies) {
      if (e.isInvincible || e.dead) continue;
      if (this._distPointToRay(e.x, e.y, player.x, player.y, angle) <= e.radius + 5) {
        this.beamHitEvents.push({ x: e.x, y: e.y });
        if (e.takeDamage(atk)) killed.push(e);
      }
    }
    return killed;
  }

  processBurn(dt, activeEnemies) {
    const killed = [];
    for (const e of activeEnemies) {
      if (e.isInvincible || e.dead || e.burnTimer <= 0) continue;
      if (e.takeDamage(e.burnDps * dt)) killed.push(e);
    }
    return killed;
  }

  _distPointToRay(px, py, rx, ry, angle) {
    const dx = px - rx; const dy = py - ry;
    if (dx * Math.cos(angle) + dy * Math.sin(angle) < 0) return Infinity;
    return Math.abs(dx * Math.sin(angle) - dy * Math.cos(angle));
  }

  processEnemyBulletHits(player) {
    let dmg = 0;
    for (const b of this.enemyBullets) {
      if (!b.active) continue;
      if (Math.hypot(player.x - b.x, player.y - b.y) < player.radius + b.radius) {
        dmg += b.dmg; b.active = false;
      }
    }
    this.enemyBullets = this.enemyBullets.filter(b => b.active);
    return dmg;
  }

  processEnemyContact(player, activeEnemies) {
    let dmg = 0;
    for (const e of activeEnemies) {
      if (e.isInvincible) continue;
      if (Math.hypot(player.x - e.x, player.y - e.y) < player.radius + e.radius) dmg += e.dmg;
    }
    return dmg;
  }

  processThorns(player, activeEnemies) {
    if (player.thorns <= 0) return [];
    const dmg = Math.max(1, Math.floor(player.atk * 0.1 * player.thorns));
    const killed = [];
    for (const e of activeEnemies) {
      if (e.isInvincible) continue;
      if (Math.hypot(player.x - e.x, player.y - e.y) < player.radius + e.radius) {
        if (e.takeDamage(dmg)) killed.push(e);
      }
    }
    return killed;
  }

  clearAll() { this.arrows = []; this.enemyBullets = []; this.beams = []; this.strikes = []; this.meteors = []; this.bombs = []; this.beamTimer = 0; }
}

// ─── CoinSystem ───────────────────────────────────────────────────────────────

class CoinSystem {
  constructor() { this.coins = []; }

  spawnCoins(enemy, player) {
    const goldMul   = 1 + player.goldMul;
    const totalGold = Math.round(enemy.gold * goldMul);
    const count     = Math.min(CONFIG.COINS.countMax, Math.max(CONFIG.COINS.countMin, totalGold));
    const val       = Math.max(1, Math.floor(totalGold / count));
    for (let i = 0; i < count; i++) this.coins.push(new Coin(enemy.x, enemy.y, val));
  }

  update(dt, room, player) {
    const collected = [];
    const magnetR = CONFIG.COIN_MAGNET_RADIUS;
    for (const c of this.coins) {
      if (!c.active) continue;
      // Magnetic pull: override velocity toward player when within range
      const mdx = player.x - c.x;
      const mdy = player.y - c.y;
      const mdist = Math.hypot(mdx, mdy);
      if (mdist < magnetR && mdist > 0) {
        const strength = 1 - mdist / magnetR;
        const pullSpeed = 180 + strength * 520;  // 180–700 px/s
        c.vx = (mdx / mdist) * pullSpeed;
        c.vy = (mdy / mdist) * pullSpeed;
      }
      c.update(dt, room);
      if (Math.hypot(player.x - c.x, player.y - c.y) < player.radius + c.radius) {
        player.gold += c.value; c.active = false;
        collected.push({ x: c.x, y: c.y });
      }
    }
    this.coins = this.coins.filter(c => c.active);
    return collected;
  }

  clear() { this.coins = []; }
}

// ─── DoorSystem ───────────────────────────────────────────────────────────────

class DoorSystem {
  constructor() { this.isOpen = false; this.pulsePhase = 0; this.rect = null; this.enemiesRemaining = 0; this.justOpened = false; }

  setup(room) {
    const dw = CONFIG.DOOR.w; const dh = CONFIG.DOOR.h;
    this.rect = { x: room.x + room.w/2 - dw/2, y: room.y - dh/2, w: dw, h: dh };
    this.isOpen = false; this.pulsePhase = 0;
  }

  update(dt, allDead, enemiesRemaining) {
    this.justOpened = false;
    if (allDead && !this.isOpen) { this.isOpen = true; this.justOpened = true; }
    if (this.isOpen) this.pulsePhase += dt * 3;
    this.enemiesRemaining = enemiesRemaining;
  }

  checkEnter(player) {
    if (!this.isOpen || !this.rect) return false;
    const r = this.rect;
    return player.x + player.radius > r.x && player.x - player.radius < r.x + r.w &&
           player.y - player.radius < r.y + r.h;
  }

  reset() { this.isOpen = false; this.pulsePhase = 0; }

  draw(ctx) {
    if (!this.rect) return;
    const r = this.rect;
    if (this.isOpen) {
      const pulse = 0.65 + 0.35 * Math.sin(this.pulsePhase);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = CONFIG.COLORS.doorOpen;
      ctx.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = CONFIG.COLORS.doorOpen;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('▲ NEXT', r.x + r.w/2, r.y + r.h/2 + 4);
    } else {
      ctx.fillStyle = CONFIG.COLORS.doorClosed;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#ccc'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(this.enemiesRemaining > 0 ? String(this.enemiesRemaining) : '...', r.x + r.w/2, r.y + r.h/2 + 4);
    }
  }
}

// ─── ProgressionSystem ────────────────────────────────────────────────────────

class ProgressionSystem {
  awardXP(gameState, amount) {
    const p = gameState.player;
    p.xp += Math.round(amount * (1 + p.xpMul));
    p.kills++;
    while (p.xp >= p.xpToNext && p.level < 30) {
      p.xp -= p.xpToNext;
      p.level++;
      p.xpToNext = p.level * CONFIG.XP_BASE;
      gameState.pendingLevelUps++;
    }
    if (p.level >= 30) { p.xp = p.xpToNext; }
  }

  advanceStage(gameState) {
    const { player, spawnSystem, combatSystem, doorSystem, coinSystem } = gameState;
    player.heal(20);
    spawnSystem.clearAll();
    combatSystem.clearAll();
    coinSystem.clear();
    gameState.orbs = gameState.orbs || [];
    // Replenish shields each stage
    if (player.shieldSkill > 0) player.shieldCount += player.shieldSkill;
    gameState.stage++;
    doorSystem.reset();
    spawnSystem.setupStage(gameState.stage, CONFIG.ROOM);
    doorSystem.setup(CONFIG.ROOM);
    const room = CONFIG.ROOM;
    player.x = room.x + room.w / 2;
    player.y = room.y + room.h - 50;
  }
}
