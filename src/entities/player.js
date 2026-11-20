// src/entities/player.js - Operator Kancil: 11 HP Hardcore Stealth, Fern Concealment & Arsenal
(function (global) {
  'use strict';

  const Animator =
    (global.BelumGame && global.BelumGame.Sprite8FrameAnimator) ||
    (typeof require !== 'undefined' ? require('../engine/animator.js') : null);

  class Player {
    constructor(x, y) {
      this.faction = 'PLAYER';
      this.x = Number.isFinite(x) ? x : 190;
      this.y = Number.isFinite(y) ? y : 660;
      this.width = 48;
      this.height = 68;
      this.colRadius = 16;

      // Hardcore lethality: 11 HP (2-3 mercenary hits kill)
      this.maxHp = 11;
      this.hp = 11;
      this.dead = false;
      this.hurtFlashTimer = 0;

      // Stamina & Hydration
      this.maxStamina = 100;
      this.stamina = 100;
      this.hydrationBuffTimer = 0; // +50% stamina regen when Pure Drinking Water active

      // Movement speeds (px/sec)
      this.walkSpeed = 162;
      this.sprintSpeed = 248;
      this.crouchSpeed = 96;
      this.crouching = false;
      this.sprinting = false;
      this.moving = false;
      this.dodgeTimer = 0;
      this.dodgeCooldown = 0;
      this.dodgeDir = { x: 1, y: 0 };

      // Concealment state
      this.inFern = false;
      this.behindLog = false;
      this.isConcealed = false;
      this.opacity = 1.0;

      // Facing & aiming
      this.facingRight = true;
      this.aimAngle = 0;

      // Combat & Arsenal
      this.activeWeapon = 'parang'; // 'parang' | 'crossbow' | 'pistol' | 'decoy'
      this.unlockedWeapons = {
        parang: true,
        crossbow: false,
        pistol: false,
        decoy: true
      };
      this.ammo = {
        crossbow: 0,
        pistol: 0,
        decoy: 4
      };
      this.attackCooldown = 0;
      this.parangAnimTimer = 0;
      this.sporeTickTimer = 0;

      // Inventory for "Go Home" Bivouac Camp & Mission Objectives
      this.inventory = {
        hasParangPickup: false,
        hasKeycard: false,
        encryptedDrives: 0,
        decryptedLore: [],
        dirtyWater: 1,
        pureWater: 1,
        bambooShoots: 1,
        boarMeat: 0,
        jungleStew: 1,
        scrapWire: 1
      };

      // 8-Frame Animators (Player Part A5: scale=1.06 matches slash height to walk height)
      this.animWalk = Animator ? new Animator({ fps: 8, framePrefix: 'kancil_walk' }) : null;
      this.animStealth = Animator ? new Animator({ fps: 8, framePrefix: 'kancil_stealth' }) : null;
      this.animParang = Animator ? new Animator({ fps: 16, framePrefix: 'kancil_parang', loop: false, scale: 1.06 }) : null;
    }

    get centerX() {
      return this.x + this.width * 0.5;
    }

    get centerY() {
      return this.y + this.height * 0.72;
    }

    get sortY() {
      return this.y + this.height;
    }

    selectWeapon(weaponId) {
      if (this.unlockedWeapons[weaponId]) {
        this.activeWeapon = weaponId;
        return true;
      }
      return false;
    }

    takeDamage(amount) {
      if (this.dead || this.dodgeTimer > 0) return 0;
      const dmg = Math.max(1, Math.round(amount || 1));
      this.hp = Math.max(0, this.hp - dmg);
      this.hurtFlashTimer = 0.28;
      if (this.hp <= 0) {
        this.dead = true;
      }
      return dmg;
    }

    heal(amount) {
      if (this.dead) return 0;
      const before = this.hp;
      this.hp = Math.min(this.maxHp, this.hp + (amount || 0));
      return this.hp - before;
    }

    useQuickConsumable() {
      if (this.hp < this.maxHp && this.inventory.jungleStew > 0) {
        this.inventory.jungleStew--;
        const healed = this.heal(6);
        return { used: 'jungleStew', message: `Ate Jungle Stew Ration (+${healed} HP)` };
      }
      if (this.inventory.pureWater > 0) {
        this.inventory.pureWater--;
        this.hydrationBuffTimer = 60;
        this.stamina = Math.min(this.maxStamina, this.stamina + 35);
        return { used: 'pureWater', message: 'Drank Pure Water (+50% Stamina Regen for 60s)' };
      }
      return { used: null, message: 'No rations ready — visit Go Home Bivouac Camp [B]' };
    }

    triggerDodge(moveVec) {
      if (this.dodgeCooldown > 0 || this.stamina < 24 || this.dead) return false;
      this.stamina -= 24;
      this.dodgeTimer = 0.24;
      this.dodgeCooldown = 0.65;
      const mx = moveVec && Number.isFinite(moveVec.x) ? moveVec.x : 0;
      const my = moveVec && Number.isFinite(moveVec.y) ? moveVec.y : 0;
      const mag = Math.hypot(mx, my);
      if (mag > 0.1) {
        this.dodgeDir = { x: mx / mag, y: my / mag };
      } else {
        this.dodgeDir = { x: Math.cos(this.aimAngle), y: Math.sin(this.aimAngle) };
      }
      return true;
    }

    updateConcealment(level) {
      let inFern = false;
      let behindLog = false;
      const px = this.centerX;
      const py = this.centerY;

      if (level && Array.isArray(level.obstacles)) {
        for (let i = 0; i < level.obstacles.length; i++) {
          const obs = level.obstacles[i];
          if (obs.type === 'fern') {
            if (
              px >= obs.x - 6 &&
              px <= obs.x + obs.width + 6 &&
              py >= obs.y + 8 &&
              py <= obs.y + obs.height + 10
            ) {
              inFern = true;
            }
          } else if (obs.type === 'hollow_log') {
            // Walking or crouching immediately behind a fallen hollow log conceals the player
            if (
              px >= obs.x - 8 &&
              px <= obs.x + obs.width + 8 &&
              py >= obs.y - 34 &&
              py <= obs.y + obs.height * 0.55
            ) {
              behindLog = true;
            }
          }
        }
      }

      this.inFern = inFern;
      this.behindLog = behindLog;
      // Section 7.2: Stepping into dense ferns or behind fallen logs makes player translucent (40%) & 100% invisible
      this.isConcealed = (this.inFern || (this.behindLog && this.crouching) || this.behindLog) && !this.sprinting;
      this.opacity = this.isConcealed ? 0.4 : 1.0;
      return this.isConcealed;
    }

    update(dt, input, level) {
      if (this.dead) return;
      const safeDt = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0.016));

      if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - safeDt);
      if (this.parangAnimTimer > 0) this.parangAnimTimer = Math.max(0, this.parangAnimTimer - safeDt);
      if (this.hurtFlashTimer > 0) this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - safeDt);
      if (this.dodgeCooldown > 0) this.dodgeCooldown = Math.max(0, this.dodgeCooldown - safeDt);
      if (this.hydrationBuffTimer > 0) this.hydrationBuffTimer = Math.max(0, this.hydrationBuffTimer - safeDt);

      const moveVec = (input && input.moveVector) || { x: 0, y: 0 };
      const aimVec = (input && input.aimVector) || { x: 1, y: 0 };

      this.aimAngle = Math.atan2(aimVec.y, aimVec.x);
      if (Math.abs(aimVec.x) > 0.08) {
        this.facingRight = aimVec.x >= 0;
      }

      this.crouching = !!(input && input.crouchToggle);
      const moveMag = Math.hypot(moveVec.x, moveVec.y);
      this.moving = moveMag > 0.08;

      // Sprinting overrides crouch and drains stamina
      const wantsSprint = !!(input && input.sprintHeld && this.moving && this.stamina > 2);
      this.sprinting = wantsSprint;
      if (this.sprinting) {
        this.crouching = false;
        if (input) input.crouchToggle = false;
      }

      // Compute velocity
      let vx = 0;
      let vy = 0;
      if (this.dodgeTimer > 0) {
        this.dodgeTimer = Math.max(0, this.dodgeTimer - safeDt);
        vx = this.dodgeDir.x * 360;
        vy = this.dodgeDir.y * 360;
      } else {
        const speed = this.sprinting ? this.sprintSpeed : (this.crouching ? this.crouchSpeed : this.walkSpeed);
        vx = moveVec.x * speed;
        vy = moveVec.y * speed;
      }

      // Stamina drain & regen (+50% faster when hydrated)
      const regenMult = this.hydrationBuffTimer > 0 ? 1.5 : 1.0;
      if (this.sprinting) {
        this.stamina = Math.max(0, this.stamina - 26 * safeDt);
      } else if (this.crouching) {
        this.stamina = Math.min(this.maxStamina, this.stamina + 24 * regenMult * safeDt);
      } else {
        this.stamina = Math.min(this.maxStamina, this.stamina + 16 * regenMult * safeDt);
      }

      // Axis-separated movement & collision
      const prevX = this.x;
      const prevY = this.y;
      const nextX = this.x + vx * safeDt;
      if (!this._collidesSolid(nextX, this.y, level)) {
        this.x = nextX;
      }
      const nextY = this.y + vy * safeDt;
      if (!this._collidesSolid(this.x, nextY, level)) {
        this.y = nextY;
      }

      // Clamp to world bounds (avoid walking into deep river on left)
      const minX = level && level.riverZone ? level.riverZone.x + level.riverZone.width + 8 : 16;
      const maxX = level ? level.worldW - this.width - 16 : 4100;
      const maxY = level ? level.worldH - this.height - 16 : 1400;
      this.x = Math.max(minX, Math.min(maxX, this.x));
      this.y = Math.max(24, Math.min(maxY, this.y));

      // Player Part A3: Match walk/sprint/crouch animation fps to actual movement speed (px/s)
      const actualSpeed = safeDt > 0 ? Math.hypot(this.x - prevX, this.y - prevY) / safeDt : 0;

      // Update fern / hollow log concealment
      this.updateConcealment(level);

      // Update 8-frame animators
      if (this.parangAnimTimer > 0 && this.animParang) {
        this.animParang.update(safeDt, true);
      } else if (this.crouching && this.animStealth) {
        this.animStealth.fps = Math.max(4, Math.min(12, (8 * actualSpeed) / 96));
        this.animStealth.update(safeDt, this.moving && actualSpeed > 1);
      } else if (this.animWalk) {
        this.animWalk.fps = Math.max(4, Math.min(16, (8 * actualSpeed) / 162));
        this.animWalk.update(safeDt, this.moving && actualSpeed > 1);
      }
    }

    _collidesSolid(testX, testY, level) {
      if (!level || !Array.isArray(level.obstacles)) return false;
      const cx = testX + this.width * 0.5;
      const cy = testY + this.height * 0.8;
      const r = this.colRadius;
      for (let i = 0; i < level.obstacles.length; i++) {
        const obs = level.obstacles[i];
        if (!obs.solid) continue;
        // Culvert grate is passable once unlocked
        if (obs.type === 'culvert_grate' && obs.unlocked) continue;
        // Blast gate is passable once open
        if (obs.type === 'blast_gate' && level.blastGateOpen) continue;

        const bx = obs.colX !== undefined ? obs.colX : obs.x;
        const by = obs.colY !== undefined ? obs.colY : obs.y;
        const bw = obs.colW !== undefined ? obs.colW : obs.width;
        const bh = obs.colH !== undefined ? obs.colH : obs.height;

        const closestX = Math.max(bx, Math.min(cx, bx + bw));
        const closestY = Math.max(by, Math.min(cy, by + bh));
        const dx = cx - closestX;
        const dy = cy - closestY;
        if (dx * dx + dy * dy < r * r) {
          return true;
        }
      }
      return false;
    }

    draw(ctx) {
      if (!ctx) return;
      ctx.save();
      const alpha = this.dead ? 0.35 : this.opacity;
      ctx.globalAlpha = alpha;

      // Ground contact ink shadow
      ctx.fillStyle = 'rgba(17, 30, 51, 0.22)';
      ctx.beginPath();
      ctx.ellipse(this.centerX, this.y + this.height - 4, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Subtle concealed leaf aura ring
      if (this.isConcealed && !this.dead) {
        ctx.strokeStyle = 'rgba(62, 124, 89, 0.7)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(this.centerX, this.y + this.height - 4, 26, 11, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw active 8-frame sprite sheet
      let drawn = false;
      const drawW = 84;
      const drawH = 84;
      const drawX = this.centerX - drawW * 0.5;
      const drawY = this.y + this.height - drawH + 8;

      if (this.parangAnimTimer > 0 && this.animParang && this.animParang.isReady()) {
        drawn = this.animParang.draw(ctx, drawX, drawY, drawW, drawH, !this.facingRight, alpha);
      } else if (this.crouching && this.animStealth && this.animStealth.isReady()) {
        drawn = this.animStealth.draw(ctx, drawX, drawY, drawW, drawH, !this.facingRight, alpha);
      } else if (this.animWalk && this.animWalk.isReady()) {
        drawn = this.animWalk.draw(ctx, drawX, drawY, drawW, drawH, !this.facingRight, alpha);
      }

      // Dip-pen ink procedural fallback while images load
      if (!drawn) {
        this._drawFallbackInk(ctx);
      }

      // Hurt flash indicator (steady soft tint when Reduce flashing is enabled)
      if (this.hurtFlashTimer > 0) {
        if (global.BelumGame && global.BelumGame.reduceFlash) {
          ctx.fillStyle = 'rgba(248, 90, 90, 0.22)';
          ctx.beginPath();
          ctx.ellipse(this.centerX, this.y + this.height * 0.52, 22, 26, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = '#F85A5A';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(this.centerX, this.y + this.height * 0.5, 28, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Subtle aim directional tick when armed with ranged/decoy
      if (!this.dead && this.activeWeapon !== 'parang') {
        const ax = this.centerX + Math.cos(this.aimAngle) * 34;
        const ay = this.centerY - 10 + Math.sin(this.aimAngle) * 34;
        ctx.strokeStyle = this.activeWeapon === 'decoy' ? '#1C2844' : '#F85A5A';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(this.centerX + Math.cos(this.aimAngle) * 18, this.centerY - 10 + Math.sin(this.aimAngle) * 18);
        ctx.lineTo(ax, ay);
        ctx.stroke();
      }

      ctx.restore();
    }

    _drawFallbackInk(ctx) {
      const cx = this.centerX;
      const topY = this.crouching ? this.y + 18 : this.y + 4;
      ctx.fillStyle = '#F4ECD8';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2;
      // Torso & backpack
      ctx.beginPath();
      ctx.roundRect(cx - 12, topY + 14, 24, this.crouching ? 24 : 32, 5);
      ctx.fill();
      ctx.stroke();
      // Head
      ctx.beginPath();
      ctx.arc(cx, topY + 8, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Parang blade
      const dir = this.facingRight ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(cx + dir * 10, topY + 26);
      ctx.lineTo(cx + dir * 28, topY + 20);
      ctx.stroke();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.Player = Player;
})(typeof window !== 'undefined' ? window : globalThis);
