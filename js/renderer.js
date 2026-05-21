class Renderer {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width; this.h = canvas.height;
  }

  draw(gameState) {
    const { ctx } = this;
    const { player, spawnSystem, combatSystem, coinSystem, doorSystem } = gameState;
    const room = CONFIG.ROOM;

    ctx.fillStyle = CONFIG.COLORS.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    this._drawRoom(room);
    doorSystem.draw(ctx);

    for (const c of coinSystem.coins)          { if (c.visible) this._drawCoin(c); }
    for (const b of combatSystem.enemyBullets) this._drawEnemyBullet(b);
    for (const bm of combatSystem.beams)       this._drawBeam(bm, room);
    for (const m of combatSystem.meteors)      { if (!m.exploded) this._drawMeteor(m); }
    for (const a of combatSystem.arrows)       this._drawArrow(a);
    for (const s of combatSystem.strikes)      this._drawStrike(s);
    for (const orb of (gameState.orbs || []))  this._drawOrb(orb, player);
    for (const e of spawnSystem.activeEnemies) this._drawEnemy(e);
    this._drawPlayer(player);

    if (gameState.particleSystem) gameState.particleSystem.draw(ctx);

    if (spawnSystem.isBossStage && spawnSystem.activeBoss) {
      ctx.fillStyle = 'rgba(80,0,0,0.07)';
      ctx.fillRect(room.x, room.y, room.w, room.h);
    }

    // Shield indicator
    if (player.shieldCount > 0) {
      ctx.strokeStyle = 'rgba(255,220,80,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffdd44';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🛡' + player.shieldCount, player.x, player.y - player.radius - 10);
    }
  }

  // ─── Room ──────────────────────────────────────────────────────────────────

  _drawRoom(room) {
    const ctx = this.ctx;
    // Floor with subtle grid
    ctx.fillStyle = CONFIG.COLORS.wall;
    ctx.fillRect(room.x, room.y, room.w, room.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let gx = room.x; gx <= room.x + room.w; gx += gridSize) {
      ctx.beginPath(); ctx.moveTo(gx, room.y); ctx.lineTo(gx, room.y + room.h); ctx.stroke();
    }
    for (let gy = room.y; gy <= room.y + room.h; gy += gridSize) {
      ctx.beginPath(); ctx.moveTo(room.x, gy); ctx.lineTo(room.x + room.w, gy); ctx.stroke();
    }
    ctx.strokeStyle = CONFIG.COLORS.wallBorder;
    ctx.lineWidth = 8;
    ctx.strokeRect(room.x + 4, room.y + 4, room.w - 8, room.h - 8);
    // Inner corner accents
    ctx.strokeStyle = 'rgba(100,120,200,0.25)';
    ctx.lineWidth = 2;
    const cs = 18;
    [[room.x+4, room.y+4], [room.x+room.w-4, room.y+4],
     [room.x+4, room.y+room.h-4], [room.x+room.w-4, room.y+room.h-4]].forEach(([cx, cy]) => {
      const sx = cx === room.x+4 ? 1 : -1;
      const sy = cy === room.y+4 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(cx + sx*cs, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy*cs);
      ctx.stroke();
    });
  }

  // ─── Player ────────────────────────────────────────────────────────────────

  _drawPlayer(player) {
    const ctx = this.ctx;
    const { x, y, radius: r, aimAngle: angle } = player;
    const t     = player.animTime    || 0;
    const walk  = player.isWalking   || false;
    const atk   = player.attackAnim  || 0;   // 1→0 after fire
    const flash = player.attackFlash || 0;

    // Walk cycle values
    const freq  = 10;
    const bob   = walk ? Math.sin(t * freq) * 2.2  : Math.sin(t * 1.5) * 0.4;
    const sway  = walk ? Math.sin(t * freq) * 0.05 : 0;
    const stepA = walk ? Math.sin(t * freq)          : 0;  // left boot
    const stepB = walk ? Math.sin(t * freq + Math.PI): 0;  // right boot

    // ── Element aura ─────────────────────────────────────────────────────
    let auraC0, auraC1;
    if      (player.fire > 0 && player.ice > 0) { auraC0='rgba(200,80,255,0.42)'; auraC1='rgba(150,30,200,0)'; }
    else if (player.fire > 0)                   { auraC0='rgba(255,130,20,0.42)'; auraC1='rgba(255,60,0,0)';   }
    else if (player.ice > 0)                    { auraC0='rgba(60,190,255,0.42)'; auraC1='rgba(20,100,255,0)'; }
    else if (player.electric > 0)               { auraC0='rgba(255,240,60,0.35)'; auraC1='rgba(180,220,0,0)';  }
    else if (player.poison > 0)                 { auraC0='rgba(100,220,60,0.35)'; auraC1='rgba(60,180,0,0)';   }
    else                                        { auraC0='rgba(90,180,50,0.28)';  auraC1='rgba(60,140,20,0)';  }
    const auraG = ctx.createRadialGradient(x, y, 0, x, y, r * 2.8);
    auraG.addColorStop(0, auraC0); auraG.addColorStop(1, auraC1);
    ctx.fillStyle = auraG;
    ctx.beginPath(); ctx.arc(x, y, r * 2.8, 0, Math.PI * 2); ctx.fill();

    // ── Ground shadow (world-space, shrinks during bob) ───────────────────
    const shS = 1 - Math.abs(bob) * 0.05;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 1, y + r * 0.58, r * 0.72 * shS, r * 0.26 * shS, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y - bob * 0.65);
    ctx.rotate(angle);
    // Local space: +x = forward (aim), ±y = sides

    // ── Boots (alternating step animation) ───────────────────────────────
    for (let s = -1; s <= 1; s += 2) {
      const step = s < 0 ? stepA : stepB;
      const ext  = step * 2.8;
      const bx   = -10.5 + ext;
      const by   = s * 5.5;
      const skew = s * 0.32;

      // Boot AO shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(bx + 0.5, by + 1.8, 5, 2.8, skew, 0, Math.PI * 2); ctx.fill();

      // Boot 3D sphere
      const bG = ctx.createRadialGradient(bx - 1.5, by - 1.5, 0, bx, by, 5);
      bG.addColorStop(0, '#5a3020'); bG.addColorStop(0.5, '#2e1808'); bG.addColorStop(1, '#080402');
      ctx.fillStyle = bG;
      ctx.beginPath(); ctx.ellipse(bx, by, 5.5, 3.5, skew, 0, Math.PI * 2); ctx.fill();
      // Boot specular
      ctx.fillStyle = 'rgba(130,75,30,0.55)';
      ctx.beginPath(); ctx.ellipse(bx - 1.8, by - 1.5, 2.2, 1.4, skew, 0, Math.PI * 2); ctx.fill();
      // Boot rim light
      const bRim = ctx.createRadialGradient(bx + 4, by + 3, 2, bx, by, 5.8);
      bRim.addColorStop(0.7, 'rgba(170,215,255,0)');
      bRim.addColorStop(0.87, 'rgba(170,215,255,0.3)');
      bRim.addColorStop(1, 'rgba(170,215,255,0.08)');
      ctx.fillStyle = bRim;
      ctx.beginPath(); ctx.ellipse(bx, by, 5.5, 3.5, skew, 0, Math.PI * 2); ctx.fill();
    }

    // ── Cape (3D dome, sways with walk) ──────────────────────────────────
    ctx.save();
    ctx.rotate(sway);
    // Cape AO base
    ctx.fillStyle = '#061202';
    ctx.beginPath(); ctx.ellipse(-2, 1.5, r + 1.5, r * 0.88, 0, 0, Math.PI * 2); ctx.fill();
    // Cape dome gradient
    const cG = ctx.createRadialGradient(-9, -8, 0, -2, 0, r + 2);
    cG.addColorStop(0, '#88d840'); cG.addColorStop(0.2, '#5aA824');
    cG.addColorStop(0.52, '#367a12'); cG.addColorStop(0.8, '#1a4806'); cG.addColorStop(1, '#061202');
    ctx.fillStyle = cG;
    ctx.beginPath(); ctx.ellipse(-2, 0, r, r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
    // Cape specular gloss
    const cSpec = ctx.createRadialGradient(-9, -8, 0, -9, -8, 9);
    cSpec.addColorStop(0, 'rgba(200,255,120,0.4)');
    cSpec.addColorStop(0.55, 'rgba(200,255,120,0.15)');
    cSpec.addColorStop(1, 'rgba(200,255,120,0)');
    ctx.fillStyle = cSpec;
    ctx.beginPath(); ctx.ellipse(-2, 0, r, r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
    // Cloth fold lines
    ctx.strokeStyle = 'rgba(140,220,60,0.18)'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(-5, -6, 9, 5, -0.22, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-5,  6, 9, 5,  0.22, 0, Math.PI * 2); ctx.stroke();
    // Cape rim light (cool blue opposite side)
    const cRim = ctx.createRadialGradient(r + 4, 5, r * 0.5, 0, 0, r + 3);
    cRim.addColorStop(0.72, 'rgba(165,215,255,0)');
    cRim.addColorStop(0.86, 'rgba(165,215,255,0.32)');
    cRim.addColorStop(1, 'rgba(165,215,255,0.1)');
    ctx.fillStyle = cRim;
    ctx.beginPath(); ctx.ellipse(-2, 0, r + 1, r * 0.84, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ── Leather tunic (3D cylinder) ───────────────────────────────────────
    ctx.fillStyle = '#0e0400';
    ctx.beginPath(); ctx.ellipse(-1, 1, 6, 9.5, 0, 0, Math.PI * 2); ctx.fill();
    const tG = ctx.createLinearGradient(-7, -4, 6, 3);
    tG.addColorStop(0, '#c87040'); tG.addColorStop(0.28, '#8a4c28');
    tG.addColorStop(0.62, '#5a2c12'); tG.addColorStop(1, '#180600');
    ctx.fillStyle = tG;
    ctx.beginPath(); ctx.ellipse(-1, 0, 5.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    const tSheen = ctx.createRadialGradient(-5, -4, 0, -4, -3, 7);
    tSheen.addColorStop(0, 'rgba(220,150,80,0.32)'); tSheen.addColorStop(1, 'rgba(220,150,80,0)');
    ctx.fillStyle = tSheen;
    ctx.beginPath(); ctx.ellipse(-1, 0, 5.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    const tRim = ctx.createRadialGradient(5, 5, 2, 0, 0, 10);
    tRim.addColorStop(0.72, 'rgba(165,210,255,0)');
    tRim.addColorStop(0.86, 'rgba(165,210,255,0.32)');
    tRim.addColorStop(1, 'rgba(165,210,255,0.1)');
    ctx.fillStyle = tRim;
    ctx.beginPath(); ctx.ellipse(-1, 0, 5.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    // Belt
    ctx.fillStyle = '#0a0302';
    ctx.beginPath(); ctx.roundRect(-5, -2.2, 10, 4.2, 1.5); ctx.fill();
    const beltG = ctx.createLinearGradient(-5, -2, 5, 2);
    beltG.addColorStop(0, '#382010'); beltG.addColorStop(1, '#0e0802');
    ctx.fillStyle = beltG;
    ctx.beginPath(); ctx.roundRect(-4.5, -1.8, 9, 3.5, 1); ctx.fill();
    const bklG = ctx.createRadialGradient(0.5, -1, 0, 1.5, 0, 3);
    bklG.addColorStop(0, '#e8c060'); bklG.addColorStop(0.5, '#c89830'); bklG.addColorStop(1, '#604808');
    ctx.fillStyle = bklG;
    ctx.beginPath(); ctx.roundRect(-0.5, -1.5, 4, 3, 0.8); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,160,0.6)';
    ctx.beginPath(); ctx.arc(0.5, -1.2, 0.8, 0, Math.PI * 2); ctx.fill();

    // ── Head (3D sphere) ─────────────────────────────────────────────────
    const hx = 5, hy = 0, hr = 6.5;
    ctx.fillStyle = '#1c0800';
    ctx.beginPath(); ctx.arc(hx, hy + 0.8, hr + 0.5, 0, Math.PI * 2); ctx.fill();
    const hG = ctx.createRadialGradient(hx - 2.5, hy - 2.5, 0, hx, hy, hr);
    hG.addColorStop(0, '#ffd8a0'); hG.addColorStop(0.42, '#e2aa78');
    hG.addColorStop(0.72, '#b07848'); hG.addColorStop(1, '#5a2800');
    ctx.fillStyle = hG;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();

    // ── Hood dome (3D, over head) ─────────────────────────────────────────
    const hdCX = 3, hdCY = 0;
    ctx.fillStyle = '#051002';
    ctx.beginPath(); ctx.ellipse(hdCX - 1, hdCY + 1.2, 10.5, 9.2, 0, 0, Math.PI * 2); ctx.fill();
    const hdG = ctx.createRadialGradient(hdCX - 6, hdCY - 6, 0, hdCX, hdCY, 10.5);
    hdG.addColorStop(0, '#9ae050'); hdG.addColorStop(0.2, '#68b830');
    hdG.addColorStop(0.5, '#3e8018'); hdG.addColorStop(0.78, '#1c4806'); hdG.addColorStop(1, '#051002');
    ctx.fillStyle = hdG;
    ctx.beginPath(); ctx.ellipse(hdCX, hdCY, 10, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    const hdSpec = ctx.createRadialGradient(hdCX - 5, hdCY - 6, 0, hdCX - 5, hdCY - 6, 6.5);
    hdSpec.addColorStop(0, 'rgba(220,255,140,0.48)');
    hdSpec.addColorStop(0.55, 'rgba(220,255,140,0.18)');
    hdSpec.addColorStop(1, 'rgba(220,255,140,0)');
    ctx.fillStyle = hdSpec;
    ctx.beginPath(); ctx.ellipse(hdCX, hdCY, 10, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    const hdRim = ctx.createRadialGradient(hdCX + 8, hdCY + 7, 4, hdCX, hdCY, 11);
    hdRim.addColorStop(0.72, 'rgba(165,215,255,0)');
    hdRim.addColorStop(0.86, 'rgba(165,215,255,0.42)');
    hdRim.addColorStop(1, 'rgba(165,215,255,0.14)');
    ctx.fillStyle = hdRim;
    ctx.beginPath(); ctx.ellipse(hdCX, hdCY, 10.5, 9, 0, 0, Math.PI * 2); ctx.fill();

    // Hood peak (pointed cone, backward)
    const pkG = ctx.createLinearGradient(-5, 0, -18, -3);
    pkG.addColorStop(0, '#3e8018'); pkG.addColorStop(0.5, '#235008'); pkG.addColorStop(1, '#0c2204');
    ctx.fillStyle = pkG;
    ctx.beginPath();
    ctx.moveTo(-5, -2); ctx.quadraticCurveTo(-19, -8, -16, 0); ctx.quadraticCurveTo(-18, 7, -5, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,50,0.28)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-5, -1.5); ctx.quadraticCurveTo(-17, -6.5, -15, 0); ctx.stroke();

    // Hood face rim (crescent opening, 3D raised edge)
    ctx.fillStyle = '#7ad840';
    ctx.beginPath();
    ctx.arc(hx, hy, 9, -Math.PI * 0.58, Math.PI * 0.58);
    ctx.arc(hx, hy, 7.5, Math.PI * 0.58, -Math.PI * 0.58, true);
    ctx.fill();
    ctx.strokeStyle = '#a0f060'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(hx, hy, 8.6, -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
    ctx.strokeStyle = 'rgba(4,12,2,0.65)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(hx, hy, 8.0, -Math.PI * 0.52, Math.PI * 0.52); ctx.stroke();

    // Face skin through opening
    ctx.fillStyle = '#e2aa78';
    ctx.beginPath();
    ctx.arc(hx, hy, 7.2, -Math.PI * 0.52, Math.PI * 0.52);
    ctx.arc(hx, hy, 5.5, Math.PI * 0.52, -Math.PI * 0.52, true);
    ctx.fill();
    const faceShade = ctx.createRadialGradient(hx + 2, hy, 0, hx, hy, 7);
    faceShade.addColorStop(0, 'rgba(240,180,120,0.28)');
    faceShade.addColorStop(0.5, 'rgba(150,85,38,0.18)');
    faceShade.addColorStop(1, 'rgba(70,25,8,0.35)');
    ctx.fillStyle = faceShade;
    ctx.beginPath();
    ctx.arc(hx, hy, 7.2, -Math.PI * 0.52, Math.PI * 0.52);
    ctx.arc(hx, hy, 5.5, Math.PI * 0.52, -Math.PI * 0.52, true);
    ctx.fill();

    // Eyes (amber, with whites + shine)
    ctx.fillStyle = '#5a3010';
    ctx.beginPath(); ctx.ellipse(hx + 4, hy - 2, 1.4, 1.1, 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 4, hy + 2, 1.4, 1.1, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,245,225,0.75)';
    ctx.beginPath(); ctx.ellipse(hx + 3.8, hy - 2.2, 1.0, 0.7, 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 3.8, hy + 1.8, 1.0, 0.7, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(hx + 4.4, hy - 2.55, 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 4.4, hy + 1.45, 0.42, 0, Math.PI * 2); ctx.fill();
    // Nose
    ctx.fillStyle = 'rgba(150,75,28,0.5)';
    ctx.beginPath(); ctx.arc(hx + 5.8, hy + 0.3, 0.65, 0, Math.PI * 2); ctx.fill();

    // Head specular (in visible area through opening)
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.arc(hx + 3, hy - 2.5, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath(); ctx.arc(hx + 3.5, hy - 3, 1.2, 0, Math.PI * 2); ctx.fill();
    // Head rim light
    const hRim = ctx.createRadialGradient(hx + 5, hy + 4.5, hr * 0.5, hx, hy, hr * 1.1);
    hRim.addColorStop(0.72, 'rgba(170,215,255,0)');
    hRim.addColorStop(0.86, 'rgba(170,215,255,0.45)');
    hRim.addColorStop(1, 'rgba(170,215,255,0.15)');
    ctx.fillStyle = hRim;
    ctx.beginPath(); ctx.arc(hx, hy, hr * 1.08, 0, Math.PI * 2); ctx.fill();

    // ── Arm (3D cylinder, pulls back during attack) ───────────────────────
    const armOffX = atk * 1.5;
    const armX = 8 - armOffX;
    const aG = ctx.createRadialGradient(armX - 1, -1, 0, armX, 0, 4.2);
    aG.addColorStop(0, '#d8a070'); aG.addColorStop(0.5, '#b07848'); aG.addColorStop(1, '#5a2808');
    ctx.fillStyle = aG;
    ctx.beginPath(); ctx.ellipse(armX, 0, 2.5, 4.2, 0, 0, Math.PI * 2); ctx.fill();
    const aRim = ctx.createRadialGradient(armX + 3, 3, 1, armX, 0, 5);
    aRim.addColorStop(0.7, 'rgba(165,210,255,0)');
    aRim.addColorStop(0.87, 'rgba(165,210,255,0.36)');
    aRim.addColorStop(1, 'rgba(165,210,255,0.1)');
    ctx.fillStyle = aRim;
    ctx.beginPath(); ctx.ellipse(armX, 0, 2.5, 4.2, 0, 0, Math.PI * 2); ctx.fill();

    // ── Bow (3D wood arc + animated string) ──────────────────────────────
    const bowColor = player.fire > 0 ? '#c84010' : player.ice > 0 ? '#1870b8' : '#7a5010';
    const strColor = player.fire > 0 ? '#ff7030' : player.ice > 0 ? '#78c8f0' : '#d4bc50';
    const bowCx = 12, bowR = 10, bowSpan = Math.PI * 0.52;
    const ta1 = -bowSpan - 0.08, ta2 = bowSpan + 0.08;
    const t1x = bowCx + Math.cos(ta1) * bowR, t1y = Math.sin(ta1) * bowR;
    const t2x = bowCx + Math.cos(ta2) * bowR, t2y = Math.sin(ta2) * bowR;

    // Bow drop shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(bowCx + 0.8, 0.8, bowR, ta1, ta2); ctx.stroke();
    // Bow stave
    ctx.strokeStyle = bowColor; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(bowCx, 0, bowR, ta1, ta2); ctx.stroke();
    // Stave highlight (3D rounded edge)
    ctx.strokeStyle = 'rgba(220,180,100,0.42)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(bowCx, 0, bowR - 1.2, ta1 + 0.12, ta2 - 0.12); ctx.stroke();
    // Tip nocks (3D sphere)
    [[t1x, t1y], [t2x, t2y]].forEach(([nx, ny]) => {
      const nG = ctx.createRadialGradient(nx - 0.5, ny - 0.5, 0, nx, ny, 2.4);
      nG.addColorStop(0, '#e8c860'); nG.addColorStop(0.5, '#b09020'); nG.addColorStop(1, '#504010');
      ctx.fillStyle = nG;
      ctx.beginPath(); ctx.arc(nx, ny, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,160,0.55)';
      ctx.beginPath(); ctx.arc(nx - 0.6, ny - 0.8, 0.8, 0, Math.PI * 2); ctx.fill();
    });

    // Bowstring (draw animation: atk=1→string snaps forward, atk=0→fully drawn)
    const pullAmt = (1 - atk) * 5;  // 5=fully drawn, 0=just released
    const sMidX  = (t1x + t2x) / 2 - pullAmt;
    ctx.strokeStyle = strColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(t1x, t1y); ctx.quadraticCurveTo(sMidX, 0, t2x, t2y); ctx.stroke();

    // Nocked arrow (fades out right after fire)
    const arrAlpha = atk > 0.65 ? 0 : 1 - atk / 0.65;
    if (arrAlpha > 0) {
      ctx.globalAlpha = arrAlpha;
      const arrC = player.fire > 0 ? '#ff8030' : player.ice > 0 ? '#b0e0f8' : '#d0b848';
      const tipX = bowCx + bowR + 13;
      ctx.strokeStyle = arrC; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sMidX, 0); ctx.lineTo(tipX, 0); ctx.stroke();
      // Arrow tip (3D)
      const tipG = ctx.createRadialGradient(tipX - 1, -1, 0, tipX - 2, 0, 3);
      tipG.addColorStop(0, '#e4e4e4'); tipG.addColorStop(0.5, '#a0a0a0'); tipG.addColorStop(1, '#383838');
      ctx.fillStyle = tipG;
      ctx.beginPath(); ctx.moveTo(tipX, 0); ctx.lineTo(tipX - 3, -1.8); ctx.lineTo(tipX - 3, 1.8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(tipX - 0.5, -0.8, 0.5, 0, Math.PI * 2); ctx.fill();
      // Fletching
      ctx.strokeStyle = 'rgba(210,160,60,0.82)'; ctx.lineWidth = 1; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sMidX + 1, 0); ctx.lineTo(sMidX - 1, -2.8);
      ctx.moveTo(sMidX + 1, 0); ctx.lineTo(sMidX - 1,  2.8);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // ── Attack flash (world-space muzzle flash) ───────────────────────────
    if (flash > 0) {
      const fx = x + Math.cos(angle) * 26;
      const fy = y + Math.sin(angle) * 26;
      const fR = 16 * flash;
      const fc  = player.fire > 0 ? '255,180,60' : player.ice > 0 ? '180,240,255' : '255,255,180';
      const fG = ctx.createRadialGradient(fx, fy, 0, fx, fy, fR);
      fG.addColorStop(0, `rgba(${fc},${flash * 0.85})`);
      fG.addColorStop(1, `rgba(${fc},0)`);
      ctx.fillStyle = fG;
      ctx.beginPath(); ctx.arc(fx, fy, fR, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ─── Enemy ─────────────────────────────────────────────────────────────────

  _drawEnemy(enemy) {
    const ctx = this.ctx;
    ctx.globalAlpha = enemy.alpha;

    if (enemy.type === 'boss') {
      this._drawBoss(enemy);
    } else {
      const { x, y, radius: r, color } = enemy;

      // Base body with highlight
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      const hl = ctx.createRadialGradient(x - r*0.3, y - r*0.4, 0, x, y, r);
      hl.addColorStop(0, 'rgba(255,255,255,0.22)');
      hl.addColorStop(0.6, 'rgba(255,255,255,0)');
      hl.addColorStop(1,   'rgba(0,0,0,0.18)');
      ctx.fillStyle = hl;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

      // Type-specific details
      this._drawEnemyDetails(enemy);
      // Status overlays
      this._drawEnemyStatus(enemy);

      // HP bar
      if (!enemy.isInvincible && enemy.hp < enemy.maxHp) {
        const bw = r * 2 + 6; const bh = 5;
        const bx = x - bw/2; const by = y - r - 11;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(bx, by, bw, bh);
        const pct = Math.max(0, enemy.hp / enemy.maxHp);
        const hpColor = pct > 0.5 ? '#44dd44' : pct > 0.25 ? '#ffaa22' : '#ee2222';
        ctx.fillStyle = hpColor;
        ctx.fillRect(bx, by, bw * pct, bh);
      }
    }

    ctx.globalAlpha = 1;
  }

  _drawEnemyDetails(enemy) {
    const ctx = this.ctx;
    const { x, y, radius: r, type } = enemy;

    if (type === 'n') {
      ctx.strokeStyle = '#ff7070'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      // Angry eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(x - r*0.32, y - r*0.18, 2.8, 2.1, -0.28, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + r*0.32, y - r*0.18, 2.8, 2.1,  0.28, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#220000';
      ctx.beginPath(); ctx.arc(x - r*0.32, y - r*0.18, 1.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r*0.32, y - r*0.18, 1.3, 0, Math.PI*2); ctx.fill();
      // Frown
      ctx.strokeStyle = 'rgba(255,100,100,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y + r*0.3, r*0.3, 0.2, Math.PI - 0.2);
      ctx.stroke();

    } else if (type === 'r') {
      ctx.strokeStyle = '#ffcc44'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      // Speed lines trailing behind
      ctx.strokeStyle = 'rgba(255,200,60,0.55)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = Math.PI * (0.75 + i * 0.25);
        const len = 7 + i * 3;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2));
        ctx.lineTo(x + Math.cos(a) * (r + len), y + Math.sin(a) * (r + len));
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      // Arrow-like chevron face
      ctx.strokeStyle = 'rgba(255,220,100,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + r*0.5, y - r*0.25); ctx.lineTo(x + r*0.05, y); ctx.lineTo(x + r*0.5, y + r*0.25);
      ctx.stroke();

    } else if (type === 's') {
      ctx.strokeStyle = '#6aaeff'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      // Crosshair
      ctx.strokeStyle = 'rgba(150,210,255,0.75)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - r + 4, y); ctx.lineTo(x + r - 4, y);
      ctx.moveTo(x, y - r + 4); ctx.lineTo(x, y + r - 4);
      ctx.stroke();
      // Center dot (scope)
      ctx.fillStyle = '#ff8844';
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,140,60,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.stroke();

    } else if (type === 't') {
      ctx.strokeStyle = '#8ac040'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
      // Armor segments
      ctx.strokeStyle = 'rgba(130,200,50,0.45)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r*0.28, y + Math.sin(a) * r*0.28);
        ctx.lineTo(x + Math.cos(a) * r*0.82, y + Math.sin(a) * r*0.82);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(180,255,80,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, r*0.5, 0, Math.PI*2); ctx.stroke();

    } else if (type === 'p') {
      ctx.strokeStyle = '#ff9abb'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
      if (!enemy.isMini) {
        // X-crack
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - r*0.55, y - r*0.7); ctx.lineTo(x + r*0.1, y + r*0.1); ctx.lineTo(x + r*0.55, y + r*0.7);
        ctx.moveTo(x + r*0.5, y - r*0.65); ctx.lineTo(x - r*0.05, y + r*0.05); ctx.lineTo(x - r*0.5, y + r*0.65);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,200,220,0.6)';
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI*2); ctx.fill();
      }

    } else {
      ctx.strokeStyle = '#ff8080'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
    }
  }

  _drawEnemyStatus(enemy) {
    const ctx = this.ctx;
    const { x, y, radius: r } = enemy;

    if (enemy.burnTimer > 0) {
      const t = Math.min(1, enemy.burnTimer / CONFIG.BURN_DURATION);
      ctx.strokeStyle = `rgba(255, 120, 10, ${t * 0.9})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(255, 200, 50, ${t * 0.4})`;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(x, y, r + 6, 0, Math.PI * 2); ctx.stroke();
    }

    if (enemy.slowTimer > 0) {
      const t = Math.min(1, enemy.slowTimer / CONFIG.SLOW_DURATION);
      ctx.fillStyle = `rgba(100, 200, 255, ${t * 0.18})`;
      ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(130, 220, 255, ${t * 0.85})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.stroke();
      // Ice crystal spikes
      ctx.strokeStyle = `rgba(200, 245, 255, ${t * 0.65})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2));
        ctx.lineTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6));
        ctx.stroke();
      }
    }

    if (enemy.poisonTimer > 0) {
      const t = Math.min(1, enemy.poisonTimer / CONFIG.POISON_DURATION) * 0.9;
      ctx.strokeStyle = `rgba(100, 220, 50, ${t})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // ─── Boss ──────────────────────────────────────────────────────────────────

  _drawBoss(boss) {
    const ctx = this.ctx;
    const { x, y, radius: r } = boss;

    // Wide outer glow
    const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.2);
    const ga = boss.isPhase2 ? 0.55 : 0.32;
    glow.addColorStop(0, `rgba(200,40,40,${ga})`);
    glow.addColorStop(1, 'rgba(200,40,40,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill();

    // Crown spikes (phase 1 only)
    if (!boss.isPhase2) {
      ctx.fillStyle = '#aa1111';
      const spikes = [-0.7, 0, 0.7];
      spikes.forEach((offset, i) => {
        const sx = x + offset * r * 0.6;
        const sy = y - r + 2;
        const h  = i === 1 ? 16 : 11;
        ctx.beginPath();
        ctx.moveTo(sx - 5, sy); ctx.lineTo(sx, sy - h); ctx.lineTo(sx + 5, sy);
        ctx.fill();
      });
    }

    // Phase 2 rotating dashed ring
    if (boss.isPhase2) {
      ctx.strokeStyle = 'rgba(255,80,80,0.6)';
      ctx.lineWidth = 3; ctx.setLineDash([9, 6]);
      ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Body gradient
    const bodyGrad = ctx.createRadialGradient(x - r*0.35, y - r*0.35, 0, x, y, r);
    bodyGrad.addColorStop(0, boss.isPhase2 ? '#ff7070' : '#cc4444');
    bodyGrad.addColorStop(1, boss.isPhase2 ? '#770000' : '#440000');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = boss.isPhase2 ? '#ff6666' : '#cc3333';
    ctx.lineWidth = boss.isPhase2 ? 4 : 3; ctx.stroke();

    // Inner concentric ring
    ctx.strokeStyle = 'rgba(255,160,160,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();

    // Eyes
    ctx.fillStyle = boss.isPhase2 ? '#ffcccc' : '#ff9999';
    ctx.beginPath(); ctx.ellipse(x - 10, y - 5, 5, 3.5, -0.15, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 10, y - 5, 5, 3.5,  0.15, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = boss.isPhase2 ? '#ffffff' : '#881111';
    ctx.beginPath(); ctx.arc(x - 10, y - 5, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 10, y - 5, 2.5, 0, Math.PI*2); ctx.fill();
    if (boss.isPhase2) {
      // Pupils glow
      ctx.fillStyle = 'rgba(255,80,80,0.8)';
      ctx.beginPath(); ctx.arc(x - 10, y - 5, 1.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 10, y - 5, 1.2, 0, Math.PI*2); ctx.fill();
    }

    // BOSS label
    ctx.fillStyle = boss.isPhase2 ? '#ffaaaa' : '#ff9999';
    ctx.font = `bold ${boss.isPhase2 ? 11 : 10}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', x, y + 4);

    this._drawEnemyStatus(boss);
  }

  // ─── Arrow ─────────────────────────────────────────────────────────────────

  _drawArrow(arrow) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(arrow.x, arrow.y);
    ctx.rotate(arrow.angle);

    const len = (arrow.isCrit ? CONFIG.ARROW.length * 1.3 : CONFIG.ARROW.length);
    const wid = (arrow.isCrit ? CONFIG.ARROW.width * 1.5  : CONFIG.ARROW.width);

    let shaftColor, glowColor, tipColor;
    if (arrow.elemType === 'fire') {
      shaftColor = arrow.isCrit ? '#ffee44' : '#ff7722';
      glowColor  = 'rgba(255,100,20,0.45)';
      tipColor   = '#ffcc44';
    } else if (arrow.elemType === 'ice') {
      shaftColor = arrow.isCrit ? '#ffffff' : '#88ddff';
      glowColor  = 'rgba(100,210,255,0.45)';
      tipColor   = '#ddeeff';
    } else {
      shaftColor = arrow.isCrit ? '#fff07a' : CONFIG.COLORS.arrow;
      glowColor  = arrow.isCrit ? 'rgba(255,240,80,0.4)' : null;
      tipColor   = '#ffffff';
    }

    // Glow halo
    if (glowColor) {
      ctx.fillStyle = glowColor;
      ctx.fillRect(-len/2 - 3, -wid/2 - 3, len + 6, wid + 6);
    }
    // Shaft
    ctx.fillStyle = shaftColor;
    ctx.fillRect(-len/2, -wid/2, len, wid);
    // Tip triangle
    ctx.fillStyle = tipColor;
    ctx.beginPath();
    ctx.moveTo(len/2 + 4, 0);
    ctx.lineTo(len/2,     -wid/2 - 1);
    ctx.lineTo(len/2,      wid/2 + 1);
    ctx.fill();
    // Tail feathers
    ctx.strokeStyle = 'rgba(200,180,100,0.6)';
    ctx.lineWidth = 1; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-len/2, -wid - 1); ctx.lineTo(-len/2 + 6, 0);
    ctx.moveTo(-len/2,  wid + 1); ctx.lineTo(-len/2 + 6, 0);
    ctx.stroke();

    ctx.restore();
  }

  // ─── Beam ──────────────────────────────────────────────────────────────────

  _drawBeam(beam, room) {
    const ctx = this.ctx;
    const t = beam.life / beam.maxLife;
    const len = 650;
    const ex = beam.x + Math.cos(beam.angle) * len;
    const ey = beam.y + Math.sin(beam.angle) * len;
    ctx.save();
    ctx.beginPath(); ctx.rect(room.x, room.y, room.w, room.h); ctx.clip();
    ctx.globalAlpha = t * 0.85;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(80,200,255,0.3)';  ctx.lineWidth = 22;
    ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = 'rgba(140,230,255,0.65)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = '#ffffff';                ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ─── Strike ────────────────────────────────────────────────────────────────

  _drawStrike(s) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    const t = 1 - s.age / s.maxAge;
    ctx.globalAlpha = t;
    ctx.strokeStyle = '#ffeeaa'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
    // Crossguard
    ctx.strokeStyle = '#ddcc88'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(4, 6); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ─── Meteor ────────────────────────────────────────────────────────────────

  _drawMeteor(m) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = m.elemType === 'ice' ? '#88ccff' : '#ff6622';
    ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fill();
    // Trail
    ctx.strokeStyle = 'rgba(255,150,50,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(m.x, m.y - 30); ctx.lineTo(m.x, m.y); ctx.stroke();
    ctx.restore();
  }

  // ─── Orb ───────────────────────────────────────────────────────────────────

  _drawOrb(orb, player) {
    const ctx = this.ctx;
    const pos = orb.getPos(player.x, player.y);
    const colors = { fire: '#ff6622', ice: '#66ccff', electric: '#ffee44', poison: '#88ff44' };
    const c = colors[orb.elemType] || '#ffffff';
    // Glow
    const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, orb.orbRadius * 2.5);
    glow.addColorStop(0, c + 'aa');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, orb.orbRadius * 2.5, 0, Math.PI * 2); ctx.fill();
    // Core
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, orb.orbRadius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6;
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  // ─── Bullet / Coin ─────────────────────────────────────────────────────────

  _drawEnemyBullet(b) {
    const ctx = this.ctx;
    // Glow
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 2.5);
    g.addColorStop(0, b.color.replace(')', ',0.5)').replace('rgb', 'rgba'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
  }

  _drawCoin(coin) {
    const ctx = this.ctx;
    // Glow
    ctx.fillStyle = 'rgba(250,200,80,0.2)';
    ctx.beginPath(); ctx.arc(coin.x, coin.y, coin.radius + 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CONFIG.COLORS.coin;
    ctx.beginPath(); ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e8a840'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,180,0.4)';
    ctx.beginPath(); ctx.arc(coin.x - 1.5, coin.y - 1.5, coin.radius * 0.4, 0, Math.PI * 2); ctx.fill();
  }
}
