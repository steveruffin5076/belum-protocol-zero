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

      // Stamina, Hydration & Energy (Task 6a)
      this.maxStamina = 100;
      this.stamina = 100;
      this.hydration = 100;
      this.energy = 100;
      this.hydrationBuffTimer = 0; // +50% stamina regen when Pure Drinking Water active
      this.dehydrationHpTimer = 0;

      // Injuries & Modern Survival Conditions (Task 6b)
      this.bleeding = false;
      this.bleedTickTimer = 0;
      this.bleedDripTimer = 0;
      this.tourniquetRestricted = false;
      this.sporeExposure = 0; // 0..100; at 100 blurred vision & 1 HP / 4s
      this.sporeHpTimer = 0;
      this.filterMaskOn = false;
      this.filterCartridgeTimer = 0; // 90s per cartridge
      this.leeches = 0; // 0..3, -10% max stamina each
      this.wadeTimer = 0;

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

      // Inventory for Field Cache & Mission Objectives
      this.inventory = {
        hasParangPickup: false,
        hasLockerKey: false,
        hasBoltCutters: false,
        hasShedKey: false,
        hasPumpFuse: false,
        hasSafeCode: false,
        hasKeycard: false,
        encryptedDrives: 0,
        decryptedLore: [],
        dirtyWater: 1,
        pureWater: 1,
        purificationTabs: 2,
        bambooShoots: 1,
        boarMeat: 0,
        jungleStew: 1,
        energyGel: 1,
        medkit: 1,
        bandage: 2,
        tourniquet: 1,
        filterMask: false,
        filterCartridge: 0,
        sporeInjector: 1,
        scrapWire: 1,
        emptyCan: 0,
        pebbles: 1,
        flare: 0,
        rag: 0,
        diesel: 0,
        radioParts: 0,
        battery: 0,
        tripwireFlares: 0,
        smokeRags: 0,
        radioJammers: 0
      };
      this.discoveredRecipes = [];

      // Task 7: Operator Proficiency (Service Record — no XP/levels)
      this.proficiency = {
        closeQuarters: 0,
        fieldcraft: 0,
        marksmanship: 0,
        fieldMedic: 0
      };
      this.draggingBody = null;

      // 8-Frame Animators (Player Part A5: scale=1.06 matches slash height to walk height)
      this.animWalk = Animator ? new Animator({ fps: 8, framePrefix: 'kancil_walk' }) : null;
      this.animStealth = Animator ? new Animator({ fps: 8, framePrefix: 'kancil_stealth' }) : null;
      this.animParang = Animator ? new Animator({ fps: 16, framePrefix: 'kancil_parang', loop: false, scale: 1.06 }) : null;
    }

    getProficiencyRank(key) {
      const n = (this.proficiency && Number.isFinite(this.proficiency[key])) ? this.proficiency[key] : 0;
      if (n >= 12) return 2;
      if (n >= 5) return 1;
      return 0;
    }

    getEffectiveMaxStamina() {
      let mult = 1.0;
      if (this.energy <= 0) mult *= 0.6; // Task 6a: -40% max stamina when energy empty
      if (this.leeches > 0) mult *= Math.max(0.2, 1 - 0.1 * Math.min(3, this.leeches)); // Task 6b: -10% per leech
      return Math.max(20, this.maxStamina * mult);
    }

    /**
     * Task 6a: Update hydration & energy needs with exact Operator rates.
     * Hydration walking: 100->25 in 6 min (360s), 100->0 in 8 min (480s). Sprinting drains 2x faster.
     * Energy walking/sprinting: 100->25 in 9 min (540s), 100->0 in 12 min (720s).
     */
    updateNeeds(dt, opts) {
      if (this.dead) return { dehydratedTick: false };
      const safeDt = Math.max(0, Number.isFinite(dt) ? dt : 0);
      const cfg = opts || {};
      const isMoving = cfg.isMoving !== undefined ? !!cfg.isMoving : !!this.moving;
      const isSprinting = cfg.isSprinting !== undefined ? !!cfg.isSprinting : !!this.sprinting;
      const drainMult = Number.isFinite(cfg.drainMult) ? cfg.drainMult : 1.0;

      const hydBase = Player.HYDRATION_WALK_RATE;
      const engBase = Player.ENERGY_WALK_RATE;
      const hydMoveFactor = isMoving ? (isSprinting ? 2.0 : 1.0) : 0.35;
      const engMoveFactor = isMoving ? 1.0 : 0.35;

      this.hydration = Math.max(0, this.hydration - hydBase * hydMoveFactor * drainMult * safeDt);
      this.energy = Math.max(0, this.energy - engBase * engMoveFactor * drainMult * safeDt);

      let dehydratedTick = false;
      if (this.hydration <= 0) {
        this.dehydrationHpTimer += safeDt;
        if (this.dehydrationHpTimer >= 20.0) {
          this.dehydrationHpTimer -= 20.0;
          this.takeDamage(1);
          dehydratedTick = true;
        }
      } else {
        this.dehydrationHpTimer = 0;
      }

      const effMax = this.getEffectiveMaxStamina();
      if (this.stamina > effMax) this.stamina = effMax;
      return { dehydratedTick };
    }

    applyTourniquet() {
      if (!this.bleeding) return { ok: false, message: 'Not bleeding.' };
      if ((this.inventory.tourniquet || 0) <= 0) return { ok: false, message: 'No tourniquet available.' };
      this.inventory.tourniquet--;
      this.bleeding = false;
      this.bleedTickTimer = 0;
      this.tourniquetRestricted = true;
      return { ok: true, message: 'Tourniquet applied — bleeding stopped (-20% speed until Field Cache rest).' };
    }

    toggleFilterMask() {
      if (!this.inventory.filterMask) {
        return { ok: false, message: 'No respirator filter mask acquired yet.' };
      }
      if (!this.filterMaskOn) {
        if (this.filterCartridgeTimer <= 0) {
          if ((this.inventory.filterCartridge || 0) > 0) {
            this.inventory.filterCartridge--;
            this.filterCartridgeTimer = 90;
          } else {
            return { ok: false, message: 'Filter mask cartridge depleted — salvage a fresh cartridge.' };
          }
        }
        this.filterMaskOn = true;
        return { ok: true, message: `Filter mask ON (${Math.ceil(this.filterCartridgeTimer)}s cartridge left).` };
      }
      this.filterMaskOn = false;
      return { ok: true, message: 'Filter mask removed.' };
    }

    useSporeInjector() {
      if ((this.inventory.sporeInjector || 0) <= 0) {
        return { ok: false, message: 'No spore auto-injector in pack.' };
      }
      this.inventory.sporeInjector--;
      this.sporeExposure = 0;
      this.sporeHpTimer = 0;
      return { ok: true, message: 'Spore auto-injector used — BT-09 exposure cleared!' };
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
      // Priority 1: Spore auto-injector if spore exposure is critical (>= 75)
      if (this.sporeExposure >= 75 && (this.inventory.sporeInjector || 0) > 0) {
        const res = this.useSporeInjector();
        return { used: 'sporeInjector', message: res.message };
      }
      // Priority 2: Tourniquet if bleeding & no bandage (or bandages handled by Hold/Press H)
      if (this.bleeding && (this.inventory.bandage || 0) <= 0 && (this.inventory.tourniquet || 0) > 0) {
        const res = this.applyTourniquet();
        return { used: 'tourniquet', message: res.message };
      }
      // Priority 3: Medical kit (+4 HP) when injured by >= 4 HP; Field Ration MRE (+2 HP + 50% energy)
      if (this.hp <= this.maxHp - 4 && this.inventory.medkit > 0) {
        this.inventory.medkit--;
        const healed = this.heal(4);
        return { used: 'medkit', message: `Used Medical Kit (+${healed} HP)` };
      }
      if (this.hp < this.maxHp && this.inventory.jungleStew > 0) {
        this.inventory.jungleStew--;
        const healed = this.heal(2);
        this.energy = Math.min(100, this.energy + 50);
        return { used: 'jungleStew', message: `Ate Field Ration (MRE) (+${healed} HP, +50% Energy)` };
      }
      if (this.hp < this.maxHp && this.inventory.medkit > 0) {
        this.inventory.medkit--;
        const healed = this.heal(4);
        return { used: 'medkit', message: `Used Medical Kit (+${healed} HP)` };
      }
      // Priority 4: Hydration when below 60%
      if (this.hydration <= 60 && this.inventory.pureWater > 0) {
        this.inventory.pureWater--;
        this.hydrationBuffTimer = 60;
        this.stamina = Math.min(this.getEffectiveMaxStamina(), this.stamina + 35);
        this.hydration = Math.min(100, this.hydration + 60);
        return { used: 'pureWater', message: 'Drank Purified Water (+60% Hydration, +50% Stamina Regen)' };
      }
      // Priority 5: Energy restoration when below 65%
      if (this.energy <= 65 && (this.inventory.energyGel || 0) > 0) {
        this.inventory.energyGel--;
        this.energy = Math.min(100, this.energy + 25);
        return { used: 'energyGel', message: 'Used Energy Gel (+25% Energy)' };
      }
      if (this.energy <= 65 && this.inventory.jungleStew > 0) {
        this.inventory.jungleStew--;
        this.energy = Math.min(100, this.energy + 50);
        return { used: 'jungleStew', message: 'Ate Field Ration (MRE) (+50% Energy)' };
      }
      if (this.energy <= 75 && (this.inventory.bambooShoots || 0) > 0) {
        this.inventory.bambooShoots--;
        this.energy = Math.min(100, this.energy + 15);
        return { used: 'bambooShoots', message: 'Ate Wild Bamboo Shoots (+15% Energy)' };
      }
      if (this.inventory.pureWater > 0) {
        this.inventory.pureWater--;
        this.hydrationBuffTimer = 60;
        this.stamina = Math.min(this.getEffectiveMaxStamina(), this.stamina + 35);
        this.hydration = Math.min(100, this.hydration + 60);
        return { used: 'pureWater', message: 'Drank Purified Water (+60% Hydration, +50% Stamina Regen)' };
      }
      return { used: null, message: 'No rations ready — visit a Field Cache (basha site)' };
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

      // Compute velocity (Task 6b: tourniquet restricts move speed by -20% until Field Cache rest)
      let vx = 0;
      let vy = 0;
      const speedMult = this.tourniquetRestricted ? 0.8 : 1.0;
      if (this.dodgeTimer > 0) {
        this.dodgeTimer = Math.max(0, this.dodgeTimer - safeDt);
        vx = this.dodgeDir.x * 360 * speedMult;
        vy = this.dodgeDir.y * 360 * speedMult;
      } else {
        const speed = (this.sprinting ? this.sprintSpeed : (this.crouching ? this.crouchSpeed : this.walkSpeed)) * speedMult;
        vx = moveVec.x * speed;
        vy = moveVec.y * speed;
      }

      // Stamina drain & regen (+50% when hydrated buff active; -50% when hydration empty; cap scales with energy & leeches)
      let regenMult = this.hydrationBuffTimer > 0 ? 1.5 : 1.0;
      if (this.hydration <= 0) regenMult *= 0.5;
      const effMaxStamina = this.getEffectiveMaxStamina();
      if (this.sprinting) {
        this.stamina = Math.max(0, this.stamina - 26 * safeDt);
      } else if (this.crouching) {
        this.stamina = Math.min(effMaxStamina, this.stamina + 24 * regenMult * safeDt);
      } else {
        this.stamina = Math.min(effMaxStamina, this.stamina + 16 * regenMult * safeDt);
      }
      if (this.stamina > effMaxStamina) this.stamina = effMaxStamina;

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

      // Clamp to world bounds (allow wading into shallow riverZone x < 135 for Fix 3 leeches, block walking off-map)
      const minX = level && level.riverZone ? Math.max(16, level.riverZone.x + 56) : 16;
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

  // Exact Operator drain rates (Task 6a):
  // Hydration: 100->25 in 6 min (360s), 100->0 in 8 min (480s); sprinting 2x faster
  // Energy: 100->25 in 9 min (540s), 100->0 in 12 min (720s)
  Player.HYDRATION_WALK_RATE = 100 / 480;
  Player.ENERGY_WALK_RATE = 100 / 720;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.Player = Player;
})(typeof window !== 'undefined' ? window : globalThis);
