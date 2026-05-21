const CONFIG = {
  CANVAS: { width: 390, height: 700 },
  ROOM: { x: 20, y: 150, w: 350, h: 470 },
  DOOR: { w: 60, h: 28 },
  PLAYER: { hp: 100, atk: 18, fireRateMs: 380, speed: 2.8, range: 220, radius: 16 },
  SPAWN: { minDist: 130, maxActive: 12, intervalMin: 35, intervalMax: 100, fadeMs: 200 },
  ARROW:  { speed: 480, radius: 5, length: 16, width: 4 },
  BULLET: { radius: 6 },
  COINS: {
    countMin: 1, countMax: 5, baseSpeed: 90, friction: 0.88,
    restitution: 0.5, lifetime: 6.0, blinkAt: 1.2, radius: 6
  },
  DEADZONE: 18,
  CONTACT_COOLDOWN: 0.5,
  XP_BASE: 50,
  CHAIN_RADIUS: 100,
  ELECTRIC_RADIUS: 90,
  BEAM_COOLDOWN: [3.5, 2.5],
  BURN_DURATION: 3,
  BURN_DPS_FACTOR: 0.12,
  SLOW_DURATION: 2.5,
  SLOW_FACTOR: 0.42,
  POISON_DURATION: 5,
  POISON_DPS_FACTOR: 0.08,
  ORB_ORBIT_RADIUS: 65,
  ORB_SPEED: 2.0,
  STRIKE_SPEED: 620,
  METEOR_BLAST_RADIUS: 55,
  SLOW_FIELD_RADIUS: 80,
  COIN_MAGNET_RADIUS: 90,
  TIMEATTACK_ROOM: { x: 0, y: 0, w: 1050, h: 1050 },
  TIMEATTACK_VIEWPORT: { x: 20, y: 150, w: 350, h: 470 },
  VISIBILITY_RADIUS: 140,
  COLORS: {
    bg: '#1a1d2e', player: '#7F77DD', wall: '#23294a', wallBorder: '#3d4470',
    doorClosed: '#4a3060', doorOpen: '#5DCAA5', arrow: '#FFD966', coin: '#FAC775'
  },

  // ── Enemy type definitions ──────────────────────────────────────────────────
  ENEMY_TYPES: {
    n: {
      label: 'Normal', color: '#E24B4A', radius: 14,
      baseHp: 30, hpMul: 8, baseDmg: 8, dmgMul: 1,
      baseSpeed: 1.2, speedMul: 0.05,
      xp: 20, gold: 4, fireRate: 0
    },
    r: {
      label: 'Runner', color: '#EF9F27', radius: 11,
      baseHp: 18, hpMul: 5, baseDmg: 10, dmgMul: 1.5,
      baseSpeed: 2.5, speedMul: 0.09,
      xp: 25, gold: 5, fireRate: 0
    },
    s: {
      label: 'Shooter', color: '#378ADD', radius: 13,
      baseHp: 25, hpMul: 7, baseDmg: 3, dmgMul: 0.3,
      baseSpeed: 0.65, speedMul: 0.02,
      xp: 30, gold: 6,
      fireRate: 1.8, bulletSpeed: 185, bulletDmgBase: 9, bulletDmgMul: 1.5
    },
    t: {
      label: 'Tank', color: '#639922', radius: 19,
      baseHp: 80, hpMul: 22, baseDmg: 18, dmgMul: 2,
      baseSpeed: 0.75, speedMul: 0.03,
      xp: 50, gold: 10, fireRate: 0
    },
    p: {
      label: 'Splitter', color: '#D4537E', radius: 14,
      baseHp: 25, hpMul: 6, baseDmg: 8, dmgMul: 1,
      baseSpeed: 1.5, speedMul: 0.05,
      xp: 35, gold: 8, fireRate: 0, splitCount: 2
    },
    boss: {
      label: 'BOSS', color: '#A32D2D', radius: 30,
      baseHp: 320, hpMul: 100, baseDmg: 22, dmgMul: 3,
      baseSpeed: 0.85, speedMul: 0.04,
      xp: 200, gold: 80,
      fireRate: 1.3, bulletSpeed: 200, bulletDmgBase: 14, bulletDmgMul: 2.5,
      phase2Color: '#cc3333', phase2FireRate: 0.65, phase2BulletCount: 3, phase2SpeedBoost: 1.35
    },
    boss_inferno: {
      label:'炎魔王', color:'#FF5500', radius:27,
      baseHp:280, hpMul:88, baseDmg:18, dmgMul:2.5,
      baseSpeed:0.9, speedMul:0.04,
      xp:200, gold:80,
      fireRate:1.4, bulletSpeed:210, bulletDmgBase:16, bulletDmgMul:2.5,
      bulletElem:'fire',
      phase2Color:'#FF2200', phase2FireRate:0.55, phase2BulletCount:3, phase2SpeedBoost:1.3
    },
    boss_frost: {
      label:'氷魔王', color:'#22AAFF', radius:27,
      baseHp:300, hpMul:95, baseDmg:14, dmgMul:2,
      baseSpeed:0.7, speedMul:0.03,
      xp:200, gold:80,
      fireRate:1.1, bulletSpeed:175, bulletDmgBase:12, bulletDmgMul:2,
      bulletElem:'ice',
      phase2Color:'#0055FF', phase2FireRate:0.6, phase2BulletCount:5, phase2SpeedBoost:1.2
    },
    boss_titan: {
      label:'タイタン', color:'#888888', radius:38,
      baseHp:650, hpMul:190, baseDmg:32, dmgMul:4,
      baseSpeed:0.45, speedMul:0.02,
      xp:200, gold:80,
      fireRate:0, bulletSpeed:0, bulletDmgBase:0, bulletDmgMul:0,
      bulletElem:'normal',
      phase2Color:'#CCCCCC', phase2FireRate:0, phase2BulletCount:1, phase2SpeedBoost:2.2
    },
    boss_poison: {
      label:'毒蛇王', color:'#44CC44', radius:26,
      baseHp:260, hpMul:82, baseDmg:14, dmgMul:2,
      baseSpeed:0.85, speedMul:0.04,
      xp:200, gold:80,
      fireRate:0.9, bulletSpeed:158, bulletDmgBase:10, bulletDmgMul:1.8,
      bulletElem:'poison',
      phase2Color:'#22AA22', phase2FireRate:0.5, phase2BulletCount:4, phase2SpeedBoost:1.2
    },
    boss_bomb: {
      label:'爆弾魔王', color:'#CC6600', radius:29,
      baseHp:350, hpMul:105, baseDmg:20, dmgMul:3,
      baseSpeed:0.7, speedMul:0.03,
      xp:200, gold:80,
      fireRate:0.45, bulletSpeed:0, bulletDmgBase:0, bulletDmgMul:0,
      bulletElem:'normal',
      bombDmgBase:28, bombDmgMul:4,
      phase2Color:'#FF4400', phase2FireRate:0.3, phase2BulletCount:2, phase2SpeedBoost:1.15
    },
    boss_shadow: {
      label:'影の王', color:'#7722AA', radius:24,
      baseHp:220, hpMul:70, baseDmg:16, dmgMul:2,
      baseSpeed:2.0, speedMul:0.08,
      xp:200, gold:80,
      fireRate:2.2, bulletSpeed:240, bulletDmgBase:14, bulletDmgMul:2,
      bulletElem:'shadow',
      teleportCooldown:3.5,
      phase2Color:'#AA44FF', phase2FireRate:1.4, phase2BulletCount:2, phase2SpeedBoost:1.3
    },
  },

  // ── Stage composition ──────────────────────────────────────────────────────
  // Returns array of type IDs weighted by frequency
  stageEnemyPool(stage) {
    if (stage <= 2)  return ['n','n','n'];
    if (stage <= 4)  return ['n','n','r'];
    if (stage <= 6)  return ['n','n','r','s'];
    if (stage <= 9)  return ['n','r','s','t','p'];
    return ['n','r','s','t','p'];
  },

  // ── Skill & shop definitions ───────────────────────────────────────────────
  SKILL_TIER_WEIGHTS: { COMMON: 6, RARE: 3, EPIC: 1 },
  SKILLS: [
    { id: 'atk',  icon: '⚔',  name: '攻撃力+20%',   tier: 'COMMON', max: 8,  desc: '攻撃力 ×1.2',
      apply: p => { p.atk = Math.round(p.atk * 1.2); } },
    { id: 'rate', icon: '⚡', name: '連射+15%',     tier: 'COMMON', max: 8,  desc: '射撃間隔 ×0.85 (下限100ms)',
      apply: p => { p.fireRateMs = Math.max(100, Math.round(p.fireRateMs * 0.85)); } },
    { id: 'spd',  icon: '👟', name: '移動+12%',     tier: 'COMMON', max: 6,  desc: '移動速度 ×1.12',
      apply: p => { p.speed = +(p.speed * 1.12).toFixed(3); } },
    { id: 'rng',  icon: '🎯', name: '射程+20%',     tier: 'COMMON', max: 5,  desc: '射程 ×1.2',
      apply: p => { p.range = +(p.range * 1.2).toFixed(1); } },
    { id: 'hp',   icon: '❤',  name: '最大HP+30',    tier: 'COMMON', max: 8,  desc: '最大HP +30・全回復',
      apply: p => { p.maxHp += 30; p.hp = p.maxHp; } },
    { id: 'mul',  icon: '↔',  name: '多重射撃',     tier: 'RARE',   max: 4,  desc: '矢を1本追加（扇状）',
      apply: p => { p.multi += 1; } },
    { id: 'prc',  icon: '📌', name: '貫通',          tier: 'RARE',   max: 3,  desc: '矢が敵1体を貫通',
      apply: p => { p.pierce += 1; } },
    { id: 'crt',  icon: '🔥', name: 'クリティカル',  tier: 'RARE',   max: 5,  desc: 'クリ率+15% / 2倍ダメージ',
      apply: p => { p.crit = Math.min(1.0, +(p.crit + 0.15).toFixed(2)); } },
    { id: 'lfs',  icon: '💧', name: '吸血',          tier: 'RARE',   max: 4,  desc: 'ダメージの8%をHPに変換',
      apply: p => { p.lifesteal = +(p.lifesteal + 0.08).toFixed(2); } },
    { id: 'thn',  icon: '🛡',  name: '反射',          tier: 'RARE',   max: 3,  desc: '接触敵にATK×10%の反射ダメージ',
      apply: p => { p.thorns += 1; } },
    { id: 'elc',  icon: '⛈',  name: '感電',          tier: 'RARE',   max: 3,  desc: '矢命中時、周囲90pxの敵に感電ダメージ',
      apply: p => { p.electric += 1; } },
    { id: 'fir',  icon: '🔥', name: '炎矢',          tier: 'RARE',   max: 3,  desc: '矢命中で燃焼（継続ダメージ3秒）',
      apply: p => { p.fire += 1; } },
    { id: 'ice',  icon: '❄',  name: '氷矢',          tier: 'RARE',   max: 3,  desc: '矢命中で凍結・速度-58%（2.5秒）',
      apply: p => { p.ice += 1; } },
    { id: 'bck',  icon: '↩',  name: '後方射撃',      tier: 'EPIC',   max: 1,  desc: '後方にも矢を同時発射',
      apply: p => { p.backshot = true; } },
    { id: 'xpm',  icon: '✨', name: 'XP倍増',        tier: 'EPIC',   max: 2,  desc: 'XP獲得 +50%',
      apply: p => { p.xpMul = +(p.xpMul + 0.5).toFixed(1); } },
    { id: 'chn',  icon: '⛓',  name: 'チェイン',      tier: 'EPIC',   max: 2,  desc: '撃破時に100px内の敵に連鎖ダメージ',
      apply: p => { p.chain += 1; } },
    { id: 'bem',  icon: '━',  name: 'ビーム',        tier: 'EPIC',   max: 2,  desc: '定期的にビームで複数の敵を貫通攻撃',
      apply: p => { p.beam += 1; } },

    // ── 属性系 ────────────────────────────────────────────────────────────────
    { id: 'psn',  icon: '☠',  name: 'ポイズン',      tier: 'RARE',   max: 3,  desc: '矢命中で毒状態（5秒継続ダメージ ATK×8%/秒×スタック）',
      apply: p => { p.poison += 1; } },

    // ── 属性強化系（スーパー） ─────────────────────────────────────────────────
    { id: 'sfr',  icon: '🌋', name: 'スーパーブレイズ', tier: 'EPIC', max: 2,  desc: '炎のburnDps×2、継続時間×1.5',
      apply: p => { p.superFire += 1; } },
    { id: 'sic',  icon: '🌊', name: 'スーパーフリーズ', tier: 'EPIC', max: 2,  desc: '氷のスロー強化（0.2）、継続時間×1.5',
      apply: p => { p.superIce += 1; } },
    { id: 'sel',  icon: '⚡', name: 'スーパーボルト',  tier: 'EPIC', max: 2,  desc: '感電半径×1.5、ダメージ×2',
      apply: p => { p.superElectric += 1; } },
    { id: 'spn',  icon: '💀', name: 'スーパーポイズン', tier: 'EPIC', max: 2,  desc: '毒のDps×2、継続時間×1.5',
      apply: p => { p.superPoison += 1; } },

    // ── サークル系 ────────────────────────────────────────────────────────────
    { id: 'fco',  icon: '🔴', name: 'ファイアサークル', tier: 'EPIC', max: 2,  desc: '炎のオーブを+2個追加（プレイヤー周囲を回転、接触で燃焼）',
      apply: p => { p.fire = Math.max(1, p.fire); const ba = Math.floor(gameState.orbs.length / 2) * Math.PI / 4; gameState.orbs.push(new Orb('fire', CONFIG.ORB_ORBIT_RADIUS, ba, CONFIG.ORB_SPEED)); gameState.orbs.push(new Orb('fire', CONFIG.ORB_ORBIT_RADIUS, ba + Math.PI, CONFIG.ORB_SPEED)); } },
    { id: 'ico',  icon: '🔵', name: 'アイスサークル',  tier: 'EPIC', max: 2,  desc: '氷のオーブを+2個追加（接触で凍結）',
      apply: p => { p.ice = Math.max(1, p.ice); const ba = Math.floor(gameState.orbs.length / 2) * Math.PI / 4; gameState.orbs.push(new Orb('ice', CONFIG.ORB_ORBIT_RADIUS, ba, CONFIG.ORB_SPEED)); gameState.orbs.push(new Orb('ice', CONFIG.ORB_ORBIT_RADIUS, ba + Math.PI, CONFIG.ORB_SPEED)); } },
    { id: 'eco',  icon: '⚡', name: 'ボルトサークル',  tier: 'EPIC', max: 2,  desc: '電気オーブを+2個追加（接触で感電）',
      apply: p => { p.electric = Math.max(1, p.electric); const ba = Math.floor(gameState.orbs.length / 2) * Math.PI / 4; gameState.orbs.push(new Orb('electric', CONFIG.ORB_ORBIT_RADIUS, ba, CONFIG.ORB_SPEED)); gameState.orbs.push(new Orb('electric', CONFIG.ORB_ORBIT_RADIUS, ba + Math.PI, CONFIG.ORB_SPEED)); } },
    { id: 'pco',  icon: '☠',  name: 'ポイズンサークル', tier: 'EPIC', max: 2, desc: '毒オーブを+2個追加（接触で毒化）',
      apply: p => { p.poison = Math.max(1, p.poison); const ba = Math.floor(gameState.orbs.length / 2) * Math.PI / 4; gameState.orbs.push(new Orb('poison', CONFIG.ORB_ORBIT_RADIUS, ba, CONFIG.ORB_SPEED)); gameState.orbs.push(new Orb('poison', CONFIG.ORB_ORBIT_RADIUS, ba + Math.PI, CONFIG.ORB_SPEED)); } },

    // ── ストライク系 ──────────────────────────────────────────────────────────
    { id: 'stb',  icon: '⚔',  name: 'ストライクブラスト', tier: 'RARE', max: 3, desc: '攻撃時25%の確率でストライク（高速剣）を1本召喚',
      apply: p => { p.strikeBlast += 1; } },
    { id: 'stc',  icon: '🗡', name: 'ストライクコンボ', tier: 'RARE', max: 2,  desc: '敵撃破時にストライクを召喚',
      apply: p => { p.strikeCombo += 1; } },

    // ── メテオ系 ──────────────────────────────────────────────────────────────
    { id: 'mtk',  icon: '☄',  name: '魔物殺しのメテオ', tier: 'RARE', max: 3,  desc: '敵撃破時にその場所にメテオを召喚（着弾AoE）',
      apply: p => { p.meteorKill += 1; } },
    { id: 'mts',  icon: '🌠', name: 'メテオコンボ',    tier: 'RARE', max: 2,  desc: '攻撃時20%の確率でメテオを召喚',
      apply: p => { p.meteorCombo += 1; } },

    // ── 強化矢系 ──────────────────────────────────────────────────────────────
    { id: 'dag',  icon: '✦',  name: 'ダイアゴナルアロー', tier: 'RARE', max: 2, desc: '斜め±45°にも矢を追加（スタックごとに+2本）',
      apply: p => { p.diagonal += 1; } },
    { id: 'hom',  icon: '🎯', name: '追跡の目',        tier: 'RARE', max: 1,  desc: '矢が敵を自動追尾する',
      apply: p => { p.homing = true; } },
    { id: 'spl',  icon: '✦',  name: '分裂アロー',      tier: 'RARE', max: 2,  desc: '矢が命中時に左右2方向に分裂（分裂矢は再分裂しない）',
      apply: p => { p.splitArrow += 1; } },
    { id: 'bnc',  icon: '↪',  name: 'バウンドアロー',   tier: 'RARE', max: 3,  desc: '矢が壁に当たると反射（スタック×1回ずつ）',
      apply: p => { p.bounceArrow += 1; } },

    // ── 防御系 ────────────────────────────────────────────────────────────────
    { id: 'hly',  icon: '🛡',  name: '神聖なる加護',    tier: 'EPIC', max: 3,  desc: '各ステージ開始時にシールド+1（ダメージを1回分吸収）',
      apply: p => { p.shieldSkill += 1; p.shieldCount += 1; } },
    { id: 'rvv',  icon: '💫', name: '復活',            tier: 'EPIC', max: 1,  desc: '死亡時にHP全回復して1回復活（1ゲームにつき1回）',
      apply: p => { p.reviveSkill = true; } },

    // ── 回復系 ────────────────────────────────────────────────────────────────
    { id: 'hrg',  icon: '💚', name: 'HP回復',          tier: 'COMMON', max: 5, desc: '毎秒最大HPの0.5%を自動回復',
      apply: p => { p.hpRegen += 1; } },
    { id: 'krg',  icon: '💖', name: '魔物狩りの回復',  tier: 'RARE', max: 3,  desc: '敵撃破時にHP5%回復',
      apply: p => { p.killRegen += 1; } },

    // ── 特殊系 ────────────────────────────────────────────────────────────────
    { id: 'bsk',  icon: '💀', name: 'ボスキラー',       tier: 'EPIC', max: 2,  desc: 'ボスへのダメージ+50%、ボス出現時HP全回復',
      apply: p => { p.bossKiller += 1; } },
    { id: 'brs',  icon: '😡', name: '火事場力【狂熱】', tier: 'RARE', max: 2,  desc: 'HP50%以下で攻撃力+40%・攻撃速度+15%',
      apply: p => { p.berserker += 1; } },
    { id: 'wwd',  icon: '🩸', name: '傷だらけの戦士',  tier: 'RARE', max: 2,  desc: '被弾時に攻撃力+60%（5秒、重複リセット）',
      apply: p => { p.woundWarrior += 1; } },
    { id: 'kwd',  icon: '⚔',  name: '魔物狩りの戦士',  tier: 'RARE', max: 2,  desc: '敵撃破時に攻撃力+30%（4秒）',
      apply: p => { p.killWarrior += 1; } },
    { id: 'slf',  icon: '🌀', name: 'スローフィールド', tier: 'RARE', max: 2,  desc: '周囲80pxの敵を常に減速（speedMod=0.55）',
      apply: p => { p.slowField += 1; } },
    { id: 'gnt',  icon: '🏔', name: '巨人の力',        tier: 'EPIC', max: 1,  desc: 'HP+200・ATK×1.5・移動速度×0.8・radius+8',
      apply: p => { p.maxHp += 200; p.hp = Math.min(p.hp + 200, p.maxHp); p.atk = Math.round(p.atk * 1.5); p.speed = +(p.speed * 0.8).toFixed(3); p.radius += 8; } }
  ],
  SHOP_ITEMS: [
    { id: 'sa', name: '攻撃強化',  desc: '攻撃力 +15%',         price: 40, max: 5,
      apply: p => { p.atk = Math.round(p.atk * 1.15); } },
    { id: 'sh', name: '体力強化',  desc: '最大HP +40・全回復',   price: 35, max: 5,
      apply: p => { p.maxHp += 40; p.hp = p.maxHp; } },
    { id: 'ss', name: '軽量化',    desc: '移動速度 +10%',        price: 30, max: 4,
      apply: p => { p.speed = +(p.speed * 1.10).toFixed(3); } },
    { id: 'sf', name: '弓改造',    desc: '射撃間隔 -12%',        price: 40, max: 5,
      apply: p => { p.fireRateMs = Math.max(100, Math.round(p.fireRateMs * 0.88)); } },
    { id: 'sr', name: '回復薬',    desc: 'HP 50% 回復',          price: 25, max: 99,
      apply: p => { p.hp = Math.min(p.maxHp, p.hp + Math.floor(p.maxHp * 0.5)); } },
    { id: 'sg', name: '金矢尻',    desc: 'ゴールド獲得 +30%',    price: 50, max: 3,
      apply: p => { p.goldMul = +(p.goldMul + 0.3).toFixed(1); } },
    { id: 'shr', name: '完全回復',  desc: 'HP を全回復',           price: 65, max: 99,
      apply: p => { p.hp = p.maxHp; } },
    { id: 'ssd', name: 'シールド',  desc: 'シールド+1（被弾1回吸収）', price: 55, max: 99,
      apply: p => { p.shieldCount += 1; } },
    { id: 'srn', name: '射程強化',  desc: '射程 +15%',             price: 40, max: 5,
      apply: p => { p.range = +(p.range * 1.15).toFixed(1); } },
    { id: 'scr', name: 'クリ強化',  desc: 'クリ率 +10%',           price: 50, max: 5,
      apply: p => { p.crit = Math.min(1.0, +(p.crit + 0.10).toFixed(2)); } }
  ],

  SKILL_SHOP_PRICES: { COMMON: 60, RARE: 95, EPIC: 145 },
  BOSS_TYPES: ['boss','boss_inferno','boss_frost','boss_titan','boss_poison','boss_bomb','boss_shadow'],
};
