const gameState = {
  stage: 1,
  isGameOver: false,
  isPaused: false,
  pendingLevelUps: 0,
  pendingShop: false,
  player: null,
  spawnSystem:       null,
  combatSystem:      null,
  coinSystem:        null,
  doorSystem:        null,
  progressionSystem: new ProgressionSystem(),
  particleSystem:    null,
  orbs:              []
};

let renderer, canvas;
let lastTime = 0;
let touchPos = null;
let lastContactTime   = 0;
let lastBulletHitTime = 0;
let lastCoinSoundTime = 0;
let particleSystem;
let audioSystem;
let settings;
let bgmStarted = false;

// ─── Joystick state ───────────────────────────────────────────────────────────
let joystickDir    = null; // {x, y} normalized direction, or null
let joystickActive = false;
let joystickOrigin = null;
let joystickTouchId = null;
const JOYSTICK_MAX = 38;   // max knob displacement in CSS px

function startBGMOnce() {
  if (!bgmStarted) {
    bgmStarted = true;
    if (settings && settings.bgm) audioSystem.startBGM();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function initGame() {
  const room = CONFIG.ROOM;
  gameState.player           = new Player(room.x + room.w / 2, room.y + room.h - 50);
  gameState.stage            = 1;
  gameState.isGameOver       = false;
  gameState.isPaused         = false;
  gameState.pendingLevelUps  = 0;
  gameState.pendingShop      = false;
  gameState.spawnSystem      = new SpawnSystem();
  gameState.combatSystem     = new CombatSystem();
  gameState.coinSystem       = new CoinSystem();
  gameState.doorSystem       = new DoorSystem();

  particleSystem = new ParticleSystem();
  gameState.particleSystem = particleSystem;
  gameState.orbs = [];

  settings = GameStorage.getSettings();
  if (!audioSystem) audioSystem = new AudioSystem();
  audioSystem.sfxEnabled = settings.sfx;
  audioSystem.bgmEnabled = settings.bgm;
  updateSettingsUI();

  gameState.spawnSystem.setupStage(1, room);
  gameState.doorSystem.setup(room);

  touchPos = null;
  joystickDir = null; joystickActive = false;
  lastContactTime = 0; lastBulletHitTime = 0; lastCoinSoundTime = 0;

  ['gameOverOverlay','levelUpOverlay','shopOverlay','skillTreeOverlay','settingsOverlay']
    .forEach(id => document.getElementById(id).style.display = 'none');
  updateHUD();
}

// ─── Game loop ────────────────────────────────────────────────────────────────

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 1 / 30);
  lastTime = timestamp;

  if (!gameState.isGameOver) {
    if (!gameState.isPaused) update(dt, timestamp / 1000);
    particleSystem.update(dt);
    renderer.draw(gameState);
    updateHUD();
    if (!gameState.isPaused && !gameState.isGameOver) {
      if (gameState.pendingLevelUps > 0) showLevelUpOverlay();
      else if (gameState.pendingShop)    showShopOverlay();
    }
  }
  requestAnimationFrame(gameLoop);
}

// ─── Update ──────────────────────────────────────────────────────────────────

function update(dt, now) {
  const { player, spawnSystem, combatSystem, coinSystem, doorSystem, progressionSystem } = gameState;
  const room = CONFIG.ROOM;

  if (joystickDir) {
    player.move(player.x + joystickDir.x * 200, player.y + joystickDir.y * 200, dt, room);
    player.aimAngle = Math.atan2(joystickDir.y, joystickDir.x);
  }

  // Animation state
  player.animTime  += dt;
  player.isWalking  = joystickDir !== null;
  if (combatSystem.justFired) { player.attackAnim = 1.0; player.attackFlash = 1.0; }
  player.attackAnim  = Math.max(0, player.attackAnim  - dt * 7);
  player.attackFlash = Math.max(0, player.attackFlash - dt * 14);

  // Spawn & AI (sets justSpawnedBossAt, justEnteredPhase2 on enemies)
  spawnSystem.update(dt, { x: player.x, y: player.y }, combatSystem);

  if (spawnSystem.justSpawnedBossAt) {
    const b = spawnSystem.justSpawnedBossAt;
    particleSystem.bossAppear(b.x, b.y);
    audioSystem.bossAppear();
  }

  for (const e of spawnSystem.activeEnemies) {
    if (e.justEnteredPhase2) {
      particleSystem.bossPhase2(e.x, e.y);
      audioSystem.bossPhase2();
      flashScreen('red');
    }
  }

  combatSystem.updateArrows(dt, room, spawnSystem.activeEnemies);
  combatSystem.updateEnemyBullets(dt, room);
  combatSystem.update(now, player, spawnSystem.activeEnemies);

  if (combatSystem.justFired) audioSystem.fire();

  // Coins
  const collected = coinSystem.update(dt, room, player);
  for (const c of collected) {
    particleSystem.coinCollect(c.x, c.y);
    if (now - lastCoinSoundTime >= 0.15) { audioSystem.coin(); lastCoinSoundTime = now; }
  }

  // Arrow hits
  const prevLevelUps = gameState.pendingLevelUps;
  let killed = combatSystem.processArrowHits(spawnSystem.activeEnemies, player);

  for (const ev of combatSystem.arrowHitEvents) {
    if      (ev.elemType === 'fire')   particleSystem.fireHit(ev.x, ev.y);
    else if (ev.elemType === 'ice')    particleSystem.iceHit(ev.x, ev.y);
    else if (ev.elemType === 'poison') particleSystem.poisonHit(ev.x, ev.y);
    else                               particleSystem.arrowHit(ev.x, ev.y, ev.isCrit);
  }
  for (const ev of combatSystem.electricEvents) particleSystem.electricZap(ev.fromX, ev.fromY, ev.toX, ev.toY);
  // Burn / poison tick particles
  for (const e of spawnSystem.activeEnemies) {
    if (e.burnTimer > 0 && Math.random() < dt * 18) particleSystem.burnTick(e.x, e.y);
    if (e.poisonTimer > 0 && Math.random() < dt * 15) particleSystem.poisonTick(e.x, e.y);
  }

  if (combatSystem.arrowHitEvents.length > 0) {
    const hasBossHit    = combatSystem.arrowHitEvents.some(ev => ev.type === 'boss');
    const bossWasKilled = killed.some(e => e.type === 'boss');
    if (hasBossHit && !bossWasKilled) audioSystem.bossHit();
    else if (!hasBossHit)             audioSystem.hit(combatSystem.arrowHitEvents[0].isCrit);
  }

  // Beam
  combatSystem.updateBeams(dt);
  const beamKilled = combatSystem.fireBeamIfReady(dt, player, spawnSystem.activeEnemies);
  if (combatSystem.justFiredBeam) {
    audioSystem.fire();
    for (const ev of combatSystem.beamHitEvents) particleSystem.beamHit(ev.x, ev.y);
  }
  killed = killed.concat(beamKilled);

  // Burn DoT
  killed = killed.concat(combatSystem.processBurn(dt, spawnSystem.activeEnemies));

  // Poison DoT
  killed = killed.concat(combatSystem.processPoison(dt, spawnSystem.activeEnemies));

  // Orbs
  for (const orb of gameState.orbs) orb.update(dt);
  const orbKilled = combatSystem.processOrbHits(gameState.orbs, player, spawnSystem.activeEnemies);
  killed = killed.concat(orbKilled);

  // Strikes
  combatSystem.updateStrikes(dt, CONFIG.ROOM);
  const strikeKilled = combatSystem.processStrikeHits(spawnSystem.activeEnemies, player);
  for (const e of strikeKilled) { if (!killed.includes(e)) particleSystem.strikeHit(e.x, e.y); }
  killed = killed.concat(strikeKilled);
  if (combatSystem.justFiredStrike) {
    combatSystem.justFiredStrike = false;
    combatSystem.spawnStrike(player, spawnSystem.activeEnemies);
  }

  // Meteors
  combatSystem.updateMeteors(dt);
  const { killed: mKilled, exploded: mExploded } = combatSystem.processMeteorHits(spawnSystem.activeEnemies, player);
  killed = killed.concat(mKilled);
  for (const m of mExploded) particleSystem.meteorExplosion(m.x, m.y);
  if (combatSystem.justFiredMeteor) {
    combatSystem.justFiredMeteor = false;
    const tgt = spawnSystem.activeEnemies.find(e => !e.isInvincible && !e.dead);
    if (tgt) combatSystem.spawnMeteor(player, tgt.x, tgt.y);
  }

  // Slow field
  if (player.slowField > 0) {
    const sfRadius = CONFIG.SLOW_FIELD_RADIUS * (1 + player.slowField * 0.3);
    for (const e of spawnSystem.activeEnemies) {
      if (e.isInvincible || e.dead) continue;
      if (Math.hypot(e.x - player.x, e.y - player.y) < sfRadius) {
        e.slowTimer = 0.2;
        e.speedMod = Math.min(e.speedMod, 0.55);
      }
    }
  }

  // HP regen
  if (player.hpRegen > 0) {
    player.regenTimer = (player.regenTimer || 0) + dt;
    if (player.regenTimer >= 1) {
      player.regenTimer = 0;
      player.heal(Math.max(1, Math.floor(player.maxHp * 0.005 * player.hpRegen)));
    }
  }

  // Wound/kill warrior timers
  if (player.woundTimer > 0) player.woundTimer -= dt;
  if (player.killWarriorTimer > 0) player.killWarriorTimer -= dt;

  // Boss killer: heal on boss appear
  if (spawnSystem.justSpawnedBossAt && player.bossKiller > 0) {
    player.heal(player.maxHp);
    flashScreen('gold');
  }

  if (player.chain > 0 && killed.length > 0)
    killed = killed.concat(_processChain(killed, spawnSystem.activeEnemies, player));

  // Enemy contact + thorns
  if (now - lastContactTime >= CONFIG.CONTACT_COOLDOWN) {
    const dmg = combatSystem.processEnemyContact(player, spawnSystem.activeEnemies);
    if (dmg > 0) {
      lastContactTime = now;
      if (player.thorns > 0) {
        const tk = combatSystem.processThorns(player, spawnSystem.activeEnemies);
        if (player.chain > 0 && tk.length > 0)
          tk.push(..._processChain(tk, spawnSystem.activeEnemies, player));
        killed = killed.concat(tk);
      }
      particleSystem.playerHit(player.x, player.y);
      audioSystem.playerHit();
      flashScreen('red');
      haptic(60);
      // Wound warrior: buff on hit
      if (player.woundWarrior > 0) player.woundTimer = 5;
      // Shield absorbs damage
      if (player.shieldCount > 0) {
        player.shieldCount--;
      } else {
        if (player.takeDamage(dmg)) {
          // Revive check
          if (!player.reviveUsed && player.reviveSkill) {
            player.reviveUsed = true;
            player.hp = player.maxHp;
            flashScreen('gold');
          } else {
            triggerGameOver(); return;
          }
        }
      }
    }
  }

  // Enemy bullet hits
  if (now - lastBulletHitTime >= 0.25) {
    const bDmg = combatSystem.processEnemyBulletHits(player);
    if (bDmg > 0) {
      lastBulletHitTime = now;
      particleSystem.playerHit(player.x, player.y);
      audioSystem.playerHit();
      flashScreen('red');
      haptic(60);
      // Wound warrior: buff on hit
      if (player.woundWarrior > 0) player.woundTimer = 5;
      // Shield absorbs damage
      if (player.shieldCount > 0) {
        player.shieldCount--;
      } else {
        if (player.takeDamage(bDmg)) {
          // Revive check
          if (!player.reviveUsed && player.reviveSkill) {
            player.reviveUsed = true;
            player.hp = player.maxHp;
            flashScreen('gold');
          } else {
            triggerGameOver(); return;
          }
        }
      }
    }
  }

  // Process kills
  const miniQueue = [];
  const bossKilled = killed.some(e => e.type === 'boss');

  for (const e of killed) {
    spawnSystem.removeEnemy(e);
    progressionSystem.awardXP(gameState, e.xp);
    coinSystem.spawnCoins(e, player);
    if (e.type !== 'boss') {
      particleSystem.enemyDeath(e.x, e.y, e.color);
      audioSystem.enemyDeath();
    }
    if (e.type === 'p' && !e.isMini) miniQueue.push(e);
    // Kill regen
    if (player.killRegen > 0) player.heal(Math.max(1, Math.floor(player.maxHp * 0.05 * player.killRegen)));
    // Kill warrior buff
    if (player.killWarrior > 0) player.killWarriorTimer = 4;
    // Strike combo: spawn strike on kill
    if (player.strikeCombo > 0) {
      for (let i = 0; i < player.strikeCombo; i++) combatSystem.spawnStrike(player, spawnSystem.activeEnemies);
    }
    // Meteor kill: spawn meteor at kill location (not for mini)
    if (player.meteorKill > 0 && !e.isMini) {
      for (let i = 0; i < player.meteorKill; i++) combatSystem.spawnMeteor(player, e.x, e.y);
    }
  }

  if (bossKilled) {
    const boss = killed.find(e => e.type === 'boss');
    particleSystem.bossDeath(boss.x, boss.y);
    audioSystem.bossDeath();
    flashScreen('gold');
    haptic([100, 50, 100]);
    const survivors = [...spawnSystem.activeEnemies];
    for (const e of survivors) {
      spawnSystem.removeEnemy(e);
      coinSystem.spawnCoins(e, player);
    }
    spawnSystem.queue = [];
  }

  for (const e of miniQueue) {
    spawnSystem.activeEnemies.push(Enemy.createMini(e.x, e.y, spawnSystem.stage));
    spawnSystem.activeEnemies.push(Enemy.createMini(e.x, e.y, spawnSystem.stage));
  }

  // Level-up particles (audio fires in showLevelUpOverlay)
  if (gameState.pendingLevelUps > prevLevelUps) {
    particleSystem.levelUp(player.x, player.y);
  }

  // Door
  doorSystem.update(dt, spawnSystem.allDead(), spawnSystem.enemiesRemaining);
  if (doorSystem.justOpened) {
    particleSystem.doorOpen(
      doorSystem.rect.x + doorSystem.rect.w / 2,
      doorSystem.rect.y + doorSystem.rect.h / 2
    );
    audioSystem.doorOpen();
  }
  if (doorSystem.checkEnter(player)) {
    doorSystem.isOpen = false;
    gameState.pendingShop = true;
  }
}

function _processChain(initialKills, activeEnemies, player) {
  const allChain = []; let targets = initialKills;
  for (let depth = 0; depth < player.chain; depth++) {
    const newKills = [];
    for (const k of targets) {
      for (const e of activeEnemies) {
        if (initialKills.includes(e) || allChain.includes(e) || newKills.includes(e)) continue;
        if (e.isInvincible) continue;
        if (Math.hypot(e.x - k.x, e.y - k.y) <= CONFIG.CHAIN_RADIUS)
          if (e.takeDamage(Math.max(1, Math.floor(player.atk * 0.5)))) newKills.push(e);
      }
    }
    allChain.push(...newKills); targets = newKills;
    if (!targets.length) break;
  }
  return allChain;
}

// ─── Joystick ─────────────────────────────────────────────────────────────────

function initJoystick() {
  const base    = document.getElementById('joystickBase');
  const knob    = document.getElementById('joystickKnob');
  const wrapper = document.getElementById('gameWrapper');

  function showBase(clientX, clientY) {
    const rect = wrapper.getBoundingClientRect();
    base.style.left    = (clientX - rect.left) + 'px';
    base.style.top     = (clientY - rect.top)  + 'px';
    base.style.display = 'block';
    knob.style.transform = 'translate(-50%, -50%)';
  }

  function hideBase() {
    base.style.display = 'none';
    knob.style.transform = 'translate(-50%, -50%)';
  }

  function updateKnob(clientX, clientY) {
    const dx = clientX - joystickOrigin.x;
    const dy = clientY - joystickOrigin.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, JOYSTICK_MAX);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    joystickDir = dist > 5 ? { x: nx, y: ny } : null;
    knob.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;
  }

  function onMoveGlobal(e) {
    if (!joystickActive) return;
    e.preventDefault();
    const src = e.touches
      ? (joystickTouchId !== null
          ? Array.from(e.touches).find(t => t.identifier === joystickTouchId)
          : e.touches[0])
      : e;
    if (src) updateKnob(src.clientX, src.clientY);
  }

  function onEndGlobal() {
    joystickActive = false; joystickDir = null; joystickTouchId = null;
    hideBase();
    document.removeEventListener('mousemove',   onMoveGlobal);
    document.removeEventListener('mouseup',     onEndGlobal);
    document.removeEventListener('touchmove',   onMoveGlobal);
    document.removeEventListener('touchend',    onEndGlobal);
    document.removeEventListener('touchcancel', onEndGlobal);
  }

  canvas.addEventListener('mousedown', e => {
    e.preventDefault();
    startBGMOnce();
    if (gameState.isPaused || gameState.isGameOver) return;
    joystickActive = true; joystickTouchId = null;
    joystickOrigin = { x: e.clientX, y: e.clientY };
    showBase(e.clientX, e.clientY);
    document.addEventListener('mousemove', onMoveGlobal);
    document.addEventListener('mouseup',   onEndGlobal);
  });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    startBGMOnce();
    if (gameState.isPaused || gameState.isGameOver) return;
    const touch = e.changedTouches[0];
    joystickActive = true; joystickTouchId = touch.identifier;
    joystickOrigin = { x: touch.clientX, y: touch.clientY };
    showBase(touch.clientX, touch.clientY);
    document.addEventListener('touchmove',   onMoveGlobal, { passive: false });
    document.addEventListener('touchend',    onEndGlobal);
    document.addEventListener('touchcancel', onEndGlobal);
  }, { passive: false });
}

// ─── Screen flash + haptics ───────────────────────────────────────────────────

function flashScreen(type) {
  const el = document.getElementById('screenFlash');
  if (!el) return;
  el.className = '';
  void el.offsetWidth;
  el.className = `flash-${type}`;
}

function haptic(pattern) {
  if (settings && settings.haptics && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

// ─── Game over / clear ────────────────────────────────────────────────────────

function triggerGameOver() {
  gameState.isGameOver = true;
  GameStorage.updateBestStage(gameState.stage);
  GameStorage.addKills(gameState.player.kills);
  GameStorage.incrementRuns();
  audioSystem.gameOver();
  audioSystem.stopBGM();
  const best = GameStorage.getBestStage();
  document.getElementById('gameOverTitle').textContent = 'GAME OVER';
  document.getElementById('gameOverTitle').style.color = '#e24b4a';
  document.getElementById('gameOverStage').textContent = `到達ステージ: ${gameState.stage}`;
  document.getElementById('gameOverKills').textContent = `撃破数: ${gameState.player.kills}`;
  document.getElementById('gameOverBest').textContent  = `ベスト: ${best}`;
  document.getElementById('gameOverOverlay').style.display = 'flex';
  renderer.draw(gameState);
}

function triggerGameClear() {
  gameState.isGameOver = true;
  GameStorage.updateBestStage(30);
  GameStorage.addKills(gameState.player.kills);
  GameStorage.incrementRuns();
  audioSystem.gameClear();
  audioSystem.stopBGM();
  const best = GameStorage.getBestStage();
  document.getElementById('gameOverTitle').textContent = 'GAME CLEAR!';
  document.getElementById('gameOverTitle').style.color = '#5DCAA5';
  document.getElementById('gameOverStage').textContent = '全30ステージ踏破！おめでとう！';
  document.getElementById('gameOverKills').textContent = `撃破数: ${gameState.player.kills}`;
  document.getElementById('gameOverBest').textContent  = `ベスト: ${best}`;
  document.getElementById('gameOverOverlay').style.display = 'flex';
}

function restartGame() {
  bgmStarted = false;
  initGame();
  lastTime = performance.now();
}

// ─── HUD ─────────────────────────────────────────────────────────────────────

function updateHUD() {
  const p = gameState.player; if (!p) return;
  const sp = gameState.spawnSystem;

  document.getElementById('hpBar').style.width    = (p.hp / p.maxHp * 100) + '%';
  document.getElementById('hpText').textContent   = `${p.hp} / ${p.maxHp}`;
  document.getElementById('xpBar').style.width    = (p.xp / p.xpToNext * 100) + '%';
  document.getElementById('levelText').textContent = `Lv ${p.level}`;
  document.getElementById('stageText').textContent = `Stage ${gameState.stage} / 30`;
  document.getElementById('killsText').textContent  = `Kills: ${p.kills}`;
  document.getElementById('xpText').textContent     = `XP: ${p.xp} / ${p.xpToNext}`;
  document.getElementById('goldText').textContent   = `${p.gold} G`;
  document.getElementById('progressBar').style.width = ((gameState.stage - 1) / 30 * 100) + '%';

  const boss    = sp ? sp.activeBoss : null;
  const bossRow = document.getElementById('bossHpRow');
  if (boss) {
    bossRow.style.display = 'flex';
    const pct = boss.hp / boss.maxHp * 100;
    document.getElementById('bossHpBar').style.width = pct + '%';
    document.getElementById('bossHpBar').style.background =
      boss.isPhase2 ? 'linear-gradient(90deg,#881111,#ff4444)' : 'linear-gradient(90deg,#661111,#cc2222)';
    document.getElementById('bossHpText').textContent = `${Math.max(0, boss.hp)} / ${boss.maxHp}`;
    document.getElementById('bossLabel').textContent  = boss.isPhase2 ? 'BOSS ★' : 'BOSS';
  } else {
    bossRow.style.display = 'none';
  }
}

// ─── Level-up overlay ─────────────────────────────────────────────────────────

function getRandomSkillCards(player) {
  const available = CONFIG.SKILLS.filter(s => (player.skillStacks[s.id] || 0) < s.max);
  if (!available.length) return [];
  const pool = [];
  for (const s of available) {
    const w = CONFIG.SKILL_TIER_WEIGHTS[s.tier];
    for (let i = 0; i < w; i++) pool.push(s);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = []; const seen = new Set();
  for (const s of pool) {
    if (!seen.has(s.id)) { seen.add(s.id); picked.push(s); if (picked.length >= 3) break; }
  }
  return picked;
}

function showLevelUpOverlay() {
  gameState.isPaused = true;
  audioSystem.levelUp();
  const player = gameState.player;
  const cards  = getRandomSkillCards(player);
  if (!cards.length) { gameState.pendingLevelUps--; _afterLevelUp(); return; }

  document.getElementById('levelUpSub').textContent = `Lv ${player.level} 到達！スキルを選択`;
  const el = document.getElementById('skillCards');
  el.innerHTML = '';
  for (const skill of cards) {
    const stacks = player.skillStacks[skill.id] || 0;
    const card   = document.createElement('div');
    card.className = `skill-card tier-${skill.tier.toLowerCase()}`;
    card.innerHTML =
      `<div class="card-icon">${skill.icon}</div>` +
      `<div class="card-name">${skill.name}</div>` +
      `<div class="card-desc">${skill.desc}</div>` +
      `<div class="card-footer"><span class="card-tier">${skill.tier}</span><span class="card-stack">${stacks}/${skill.max}</span></div>`;
    card.addEventListener('click', () => selectSkill(skill));
    el.appendChild(card);
  }
  document.getElementById('levelUpOverlay').style.display = 'flex';
}

function selectSkill(skill) {
  const player = gameState.player;
  skill.apply(player);
  player.skillStacks[skill.id] = (player.skillStacks[skill.id] || 0) + 1;
  gameState.pendingLevelUps--;
  document.getElementById('levelUpOverlay').style.display = 'none';
  _afterLevelUp();
}

function _afterLevelUp() {
  if (gameState.pendingLevelUps > 0) { showLevelUpOverlay(); return; }
  if (gameState.pendingShop)         { showShopOverlay();    return; }
  gameState.isPaused = false;
}

// ─── Shop overlay ─────────────────────────────────────────────────────────────

function showShopOverlay() {
  gameState.isPaused = true; gameState.pendingShop = false;
  const player = gameState.player;
  const isBoss = gameState.spawnSystem.isBossStage;

  document.getElementById('shopStageLabel').textContent =
    (isBoss ? 'ボス撃破ショップ' : 'ショップ') + ` — Stage ${gameState.stage}`;
  document.getElementById('shopGold').textContent = `所持金: ${player.gold} G`;

  const el = document.getElementById('shopItems');
  el.innerHTML = '';
  for (const item of CONFIG.SHOP_ITEMS) {
    const stacks   = player.shopStacks[item.id] || 0;
    const atMax    = stacks >= item.max;
    const canAfford= player.gold >= item.price;
    const disabled = atMax || !canAfford;
    const div = document.createElement('div');
    div.className = 'shop-item' + (disabled ? ' disabled' : '');
    div.innerHTML =
      `<div class="shop-name">${item.name}</div>` +
      `<div class="shop-desc">${item.desc}</div>` +
      `<div class="shop-footer"><span class="shop-price">${item.price} G</span>` +
      `<span class="shop-stack">${atMax ? 'MAX' : (!canAfford ? '不足' : stacks + '/' + item.max)}</span></div>`;
    if (!disabled) div.addEventListener('click', () => buyItem(item));
    el.appendChild(div);
  }
  document.getElementById('shopOverlay').style.display = 'flex';
}

function buyItem(item) {
  const player = gameState.player;
  if (player.gold < item.price || (player.shopStacks[item.id] || 0) >= item.max) return;
  player.gold -= item.price;
  item.apply(player);
  player.shopStacks[item.id] = (player.shopStacks[item.id] || 0) + 1;
  showShopOverlay();
}

function onShopNext() {
  touchPos = null;
  document.getElementById('shopOverlay').style.display = 'none';
  if (gameState.stage >= 30) { triggerGameClear(); return; }
  gameState.progressionSystem.advanceStage(gameState);
  gameState.isPaused = false;
  updateHUD();
}

// ─── Skill Tree ───────────────────────────────────────────────────────────────

function toggleSkillTree() {
  const el = document.getElementById('skillTreeOverlay');
  if (el.style.display === 'flex') {
    el.style.display = 'none';
    const anyOther = ['levelUpOverlay','shopOverlay'].some(
      id => document.getElementById(id).style.display === 'flex'
    );
    if (!anyOther && !gameState.isGameOver) gameState.isPaused = false;
  } else {
    gameState.isPaused = true;
    renderSkillTree();
    el.style.display = 'flex';
  }
}

function renderSkillTree() {
  const player = gameState.player;
  const el = document.getElementById('skillTreeContent');
  el.innerHTML = '';
  for (const skill of CONFIG.SKILLS) {
    const stacks = player.skillStacks[skill.id] || 0;
    const row = document.createElement('div');
    row.className = 'st-row' + (stacks > 0 ? ' acquired' : '');
    row.innerHTML =
      `<span class="st-icon">${skill.icon}</span>` +
      `<div class="st-info"><div class="st-name">${skill.name}</div><div class="st-desc">${skill.desc}</div></div>` +
      `<div class="st-stack ${stacks > 0 ? 'acquired' : ''}">${stacks}/${skill.max}</div>`;
    el.appendChild(row);
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function toggleSettings() {
  const el = document.getElementById('settingsOverlay');
  if (el.style.display === 'flex') {
    el.style.display = 'none';
    const anyOther = ['levelUpOverlay','shopOverlay'].some(
      id => document.getElementById(id).style.display === 'flex'
    );
    if (!anyOther && !gameState.isGameOver) gameState.isPaused = false;
  } else {
    gameState.isPaused = true;
    updateSettingsUI();
    el.style.display = 'flex';
  }
}

function toggleSetting(key) {
  settings[key] = !settings[key];
  GameStorage.setSettings(settings);
  if (key === 'sfx') {
    audioSystem.sfxEnabled = settings.sfx;
  } else if (key === 'bgm') {
    audioSystem.bgmEnabled = settings.bgm;
    if (settings.bgm && bgmStarted) audioSystem.startBGM();
    else audioSystem.stopBGM();
  }
  updateSettingsUI();
}

function updateSettingsUI() {
  if (!settings) return;
  ['sfx','bgm','haptics'].forEach(key => {
    const btn = document.getElementById(key + 'Toggle');
    if (!btn) return;
    btn.textContent = settings[key] ? 'ON' : 'OFF';
    btn.classList.toggle('on', settings[key]);
  });
}

// ─── Input ────────────────────────────────────────────────────────────────────

function getCanvasPos(e) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const src    = e.touches ? e.touches[0] : e;
  return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
}

window.addEventListener('load', () => {
  canvas = document.getElementById('gameCanvas');
  canvas.width  = CONFIG.CANVAS.width;
  canvas.height = CONFIG.CANVAS.height;

  renderer     = new Renderer(canvas);
  audioSystem  = new AudioSystem();
  initGame();
  initJoystick();

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
});
