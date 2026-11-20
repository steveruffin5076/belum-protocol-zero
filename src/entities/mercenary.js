// src/entities/mercenary.js - Ironclad PMC AI with Gradual 0.85s Ink-Eye Suspicion Meter, 4.2 rad/s Turn Inertia & Footprint Investigation
(function (global) {
  'use strict';

  const Animator =
    (global.BelumGame && global.BelumGame.Sprite8FrameAnimator) ||
    (typeof require !== 'undefined' ? require('../engine/animator.js') : null);

  function normalizeAngle(a) {
    let r = a;
    while (r > Math.PI) r -= Math.PI * 2;
    while (r < -Math.PI) r += Math.PI * 2;
    return r;
  }

  function hasLineOfSight(x1, y1, x2, y2, obstacles) {
    if (!Array.isArray(obstacles)) return true;
    const steps = 10;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (!obs.solid || obs.blocksVision === false) continue;
        if (obs.type === 'culvert_grate' && obs.unlocked) continue;
        const bx = obs.colX !== undefined ? obs.colX : obs.x;
        const by = obs.colY !== undefined ? obs.colY : obs.y;
        const bw = obs.colW !== undefined ? obs.colW : obs.width;
        const bh = obs.colH !== undefined ? obs.colH : obs.height;
        if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) {
          return false;
        }
      }
    }
    return true;
  }

  class Mercenary {
    constructor(opts) {
      const cfg = opts || {};
      this.id = cfg.id || `merc_${Math.random().toString(36).slice(2, 7)}`;
      this.faction = 'MERC';
      this.role = cfg.role || 'rifleman'; // 'rifleman' | 'spotter' | 'commander'
      this.name = cfg.name || (this.role === 'commander' ? 'Commander Ward' : 'Ironclad PMC');

      this.x = Number.isFinite(cfg.x) ? cfg.x : 500;
      this.y = Number.isFinite(cfg.y) ? cfg.y : 500;
      this.width = this.role === 'commander' ? 54 : 48;
      this.height = this.role === 'commander' ? 74 : 68;

      this.maxHp = cfg.hp || (this.role === 'commander' ? 140 : 60);
      this.hp = this.maxHp;
      this.dead = false;
      this.sector = cfg.sector || 1;

      // Vision, Turn Inertia (4.2 rad/s max angular speed) & Gradual Suspicion Meter
      this.fovDeg = this.role === 'spotter' ? 75 : 65;
      this.visionRange = this.role === 'spotter' ? 320 : 270;
      this.facingAngle = Number.isFinite(cfg.facingAngle) ? cfg.facingAngle : Math.PI;
      this.targetFacingAngle = this.facingAngle;
      this.maxTurnSpeed = 4.2; // rad/s (240 deg/s) — eliminates instant 180 snaps
      this.facingRight = Math.cos(this.facingAngle) >= 0;

      // AAA Gradual Suspicion Meter (0.0 -> 1.0 over 0.85s)
      this.suspicionMeter = 0.0;
      this.suspicionFillTime = 0.85;
      this.sweepBaseAngle = this.facingAngle;
      this.sweepPhase = 0;
      this.lastFootprintCheck = 0;

      this.waypoints = Array.isArray(cfg.waypoints) && cfg.waypoints.length
        ? cfg.waypoints
        : [{ x: this.x, y: this.y }];
      this.waypointIdx = 0;
      this.waitTimer = 0;
      this.patrolSpeed = cfg.patrolSpeed || 68;
      this.alertSpeed = cfg.alertSpeed || 108;

      // State Machine: PATROL | SUSPICIOUS | ALERT | DEAD
      this.state = 'PATROL';
      this.suspicionTarget = null;
      this.suspicionTimer = 0;
      this.alertMemoryTimer = 0;
      this.alertMarkTimer = 0;
      this.hurtFlashTimer = 0;

      // 3-round burst firing logic
      this.fireCooldown = 0.6;
      this.burstRemaining = 0;
      this.burstIntervalTimer = 0;
      this.firingAnimTimer = 0;
      this.bulletDamage = this.role === 'commander' ? 4 : 3;

      // 8-frame animators (Phase B3: side + up/down directional sheets with graceful fallback)
      this.animPatrol = Animator ? new Animator({ fps: 8, framePrefix: 'merc_patrol' }) : null;
      this.animPatrolUp = Animator ? new Animator({ fps: 8, framePrefix: 'merc_patrol_up' }) : null;
      this.animPatrolDown = Animator ? new Animator({ fps: 8, framePrefix: 'merc_patrol_down' }) : null;
      this.animFire = Animator ? new Animator({ fps: 12, framePrefix: 'merc_fire' }) : null;
      this.animFireUp = null;
      this.animFireDown = null;
      this.spriteDir = 'side';
      this._updateSpriteDir();
    }

    get centerX() {
      return this.x + this.width * 0.5;
    }

    get centerY() {
      return this.y + this.height * 0.7;
    }

    get sortY() {
      return this.y + this.height;
    }

    _updateSpriteDir() {
      const s = Math.sin(Number.isFinite(this.facingAngle) ? this.facingAngle : 0);
      if (this.spriteDir === 'side') {
        if (s < -0.65) this.spriteDir = 'up';
        else if (s > 0.65) this.spriteDir = 'down';
      } else if (this.spriteDir === 'up') {
        if (s > 0.65) this.spriteDir = 'down';
        else if (s > -0.55) this.spriteDir = 'side';
      } else if (this.spriteDir === 'down') {
        if (s < -0.65) this.spriteDir = 'up';
        else if (s < 0.55) this.spriteDir = 'side';
      }
      return this.spriteDir;
    }

    _rotateToward(desiredAngle, dt) {
      this.targetFacingAngle = desiredAngle;
      const diff = normalizeAngle(desiredAngle - this.facingAngle);
      const maxStep = this.maxTurnSpeed * dt;
      if (Math.abs(diff) <= maxStep) {
        this.facingAngle = desiredAngle;
      } else {
        this.facingAngle = normalizeAngle(this.facingAngle + Math.sign(diff) * maxStep);
      }
      this.facingRight = Math.cos(this.facingAngle) >= 0;
      this._updateSpriteDir();
    }

    isBehindMe(px, py) {
      const toPlayerAngle = Math.atan2(py - this.centerY, px - this.centerX);
      const diff = Math.abs(normalizeAngle(toPlayerAngle - this.facingAngle));
      return diff > Math.PI * 0.55;
    }

    hearSound(sx, sy, priority) {
      if (this.dead) return;
      if (this.state === 'ALERT' && !priority) return;
      this.state = 'SUSPICIOUS';
      this.suspicionMeter = Math.max(this.suspicionMeter, 0.45);
      this.suspicionTarget = { x: sx, y: sy };
      this.suspicionTimer = 5.5;
      this.alertMarkTimer = 1.6;
      this.sweepBaseAngle = Math.atan2(sy - this.centerY, sx - this.centerX);
    }

    inspectFootprint(fx, fy, trackAngle) {
      if (this.dead || this.state === 'ALERT') return;
      this.suspicionMeter = Math.min(0.95, this.suspicionMeter + 0.2);
      this.state = 'SUSPICIOUS';
      this.suspicionTarget = {
        x: fx + Math.cos(trackAngle || 0) * 65,
        y: fy + Math.sin(trackAngle || 0) * 65
      };
      this.suspicionTimer = Math.max(this.suspicionTimer, 4.0);
      this.sweepBaseAngle = Number.isFinite(trackAngle) ? trackAngle : Math.atan2(fy - this.centerY, fx - this.centerX);
    }

    triggerAlert(tx, ty, ctxEvents) {
      if (this.dead) return;
      const wasAlert = this.state === 'ALERT';
      this.state = 'ALERT';
      this.suspicionMeter = 1.0;
      this.suspicionTarget = { x: tx, y: ty };
      this.alertMemoryTimer = 6.5;
      this.alertMarkTimer = 2.0;
      if (!wasAlert && ctxEvents && ctxEvents.onRadioAlert) {
        ctxEvents.onRadioAlert(this);
      }
    }

    takeDamage(amount, attackerPos, ctxEvents) {
      if (this.dead) return 0;
      const dmg = Math.max(1, Math.round(amount || 1));
      this.hp = Math.max(0, this.hp - dmg);
      this.hurtFlashTimer = 0.25;
      if (this.hp <= 0) {
        this.dead = true;
        this.state = 'DEAD';
        this.suspicionMeter = 0;
        if (ctxEvents && ctxEvents.onMercKilled) {
          ctxEvents.onMercKilled(this);
        }
      } else if (attackerPos) {
        this.triggerAlert(attackerPos.x, attackerPos.y, ctxEvents);
      }
      return dmg;
    }

    _canSeeTarget(tx, ty, isConcealed, obstacles) {
      if (isConcealed) {
        const dist = Math.hypot(tx - this.centerX, ty - this.centerY);
        return dist < 24;
      }
      const dx = tx - this.centerX;
      const dy = ty - this.centerY;
      const dist = Math.hypot(dx, dy);
      if (dist > this.visionRange) return false;
      const angle = Math.atan2(dy, dx);
      const halfFov = (this.fovDeg * Math.PI / 180) * 0.5;
      if (Math.abs(normalizeAngle(angle - this.facingAngle)) > halfFov) return false;
      return hasLineOfSight(this.centerX, this.centerY, tx, ty, obstacles);
    }

    update(dt, player, boars, level, ctxEvents) {
      if (this.dead) return;
      const safeDt = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0.016));
      if (this.hurtFlashTimer > 0) this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - safeDt);
      if (this.alertMarkTimer > 0) this.alertMarkTimer = Math.max(0, this.alertMarkTimer - safeDt);
      if (this.firingAnimTimer > 0) this.firingAnimTimer = Math.max(0, this.firingAnimTimer - safeDt);
      if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - safeDt);

      const obstacles = level ? level.obstacles : [];
      let activeTarget = null;
      let targetDist = Infinity;

      // 1. Faction Infighting: scan hostile/nearby Mutated Boars (FAUNA)
      if (Array.isArray(boars)) {
        for (let i = 0; i < boars.length; i++) {
          const b = boars[i];
          if (b.dead) continue;
          const dist = Math.hypot(b.centerX - this.centerX, b.centerY - this.centerY);
          const boarAggro = b.state === 'TELEGRAPH' || b.state === 'CHARGE' || b.state === 'AGITATED';
          const visible = dist < 310 && (boarAggro || this._canSeeTarget(b.centerX, b.centerY, false, obstacles));
          if (visible && dist < targetDist) {
            activeTarget = { x: b.centerX, y: b.centerY, ref: b, faction: 'FAUNA' };
            targetDist = dist;
          }
        }
      }

      // 2. Gradual Player Detection (0.85s Inking Eye Suspicion Meter)
      let seesPlayer = false;
      if (player && !player.dead) {
        seesPlayer = this._canSeeTarget(player.centerX, player.centerY, player.isConcealed, obstacles);
        const distP = Math.hypot(player.centerX - this.centerX, player.centerY - this.centerY);

        if (seesPlayer) {
          if (this.state === 'ALERT') {
            if (distP < targetDist) {
              activeTarget = { x: player.centerX, y: player.centerY, ref: player, faction: 'PLAYER' };
              targetDist = distP;
            }
          } else {
            // Fill suspicion gradually over 0.85s (faster if very close)
            const fillDuration = distP < 90 ? 0.38 : this.suspicionFillTime;
            this.suspicionMeter = Math.min(1.0, this.suspicionMeter + safeDt / fillDuration);
            this.suspicionTarget = { x: player.centerX, y: player.centerY };
            this.suspicionTimer = 4.8;
            this.sweepBaseAngle = Math.atan2(player.centerY - this.centerY, player.centerX - this.centerX);

            if (this.suspicionMeter >= 1.0) {
              this.triggerAlert(player.centerX, player.centerY, ctxEvents);
              if (distP < targetDist) {
                activeTarget = { x: player.centerX, y: player.centerY, ref: player, faction: 'PLAYER' };
                targetDist = distP;
              }
            } else {
              this.state = 'SUSPICIOUS';
            }
          }
        } else {
          // Decay suspicion gently when player dives into ferns or behind hollow log
          if (this.state !== 'ALERT' && this.suspicionMeter > 0) {
            this.suspicionMeter = Math.max(0, this.suspicionMeter - safeDt * 0.24);
          }
          if (player.sprinting && distP < 130 && this.state === 'PATROL') {
            this.hearSound(player.centerX, player.centerY, false);
          }
        }
      }

      let isMoving = false;

      if (activeTarget) {
        this.triggerAlert(activeTarget.x, activeTarget.y, ctxEvents);
        const desiredAngle = Math.atan2(activeTarget.y - this.centerY, activeTarget.x - this.centerX);
        this._rotateToward(desiredAngle, safeDt);

        if (targetDist > 210) {
          isMoving = this._moveToward(activeTarget.x, activeTarget.y, this.alertSpeed, safeDt, level);
        }

        // Only fire when laser sight is reasonably aligned with target (respects turn inertia!)
        const aimErr = Math.abs(normalizeAngle(desiredAngle - this.facingAngle));
        if (aimErr < 0.35) {
          if (this.burstRemaining > 0) {
            this.burstIntervalTimer -= safeDt;
            if (this.burstIntervalTimer <= 0) {
              this.burstRemaining--;
              this.burstIntervalTimer = 0.13;
              this.firingAnimTimer = 0.22;
              if (ctxEvents && ctxEvents.onMercFire) {
                const spread = (Math.random() - 0.5) * 0.08;
                ctxEvents.onMercFire(this, this.facingAngle + spread, this.bulletDamage);
              }
            }
          } else if (this.fireCooldown <= 0) {
            this.burstRemaining = this.role === 'commander' ? 2 : 3;
            this.burstIntervalTimer = 0;
            this.fireCooldown = this.role === 'commander' ? 1.15 : 1.55;
          }
        }
      } else if (this.state === 'ALERT') {
        this.alertMemoryTimer -= safeDt;
        if (this.suspicionTarget) {
          const dist = Math.hypot(this.suspicionTarget.x - this.centerX, this.suspicionTarget.y - this.centerY);
          if (dist > 28) {
            isMoving = this._moveToward(this.suspicionTarget.x, this.suspicionTarget.y, this.alertSpeed, safeDt, level);
          } else {
            this.sweepPhase += safeDt * 2.2;
            this._rotateToward(this.sweepBaseAngle + Math.sin(this.sweepPhase) * 0.78, safeDt);
          }
        }
        if (this.alertMemoryTimer <= 0) {
          this.state = 'SUSPICIOUS';
          this.suspicionMeter = 0.55;
          this.suspicionTimer = 3.0;
        }
      } else if (this.state === 'SUSPICIOUS') {
        this.suspicionTimer -= safeDt;
        if (this.suspicionTarget) {
          const dist = Math.hypot(this.suspicionTarget.x - this.centerX, this.suspicionTarget.y - this.centerY);
          if (seesPlayer) {
            // Pause & track movement while eye meter fills
            const lookAng = Math.atan2(this.suspicionTarget.y - this.centerY, this.suspicionTarget.x - this.centerX);
            this._rotateToward(lookAng, safeDt);
          } else if (dist > 34) {
            isMoving = this._moveToward(this.suspicionTarget.x, this.suspicionTarget.y, this.patrolSpeed * 1.12, safeDt, level);
          } else {
            // 45-degree laser sweep inspection before returning to patrol
            this.sweepPhase += safeDt * 2.4;
            const sweepOffset = Math.sin(this.sweepPhase) * (Math.PI * 0.25); // +/- 45 deg
            this._rotateToward(this.sweepBaseAngle + sweepOffset, safeDt);
          }
        }
        if (this.suspicionTimer <= 0 && !seesPlayer) {
          this.state = 'PATROL';
          this.suspicionTarget = null;
          this.suspicionMeter = 0;
        }
      } else {
        // PATROL state
        if (this.waypoints.length > 1) {
          if (this.waitTimer > 0) {
            this.waitTimer -= safeDt;
          } else {
            const wp = this.waypoints[this.waypointIdx];
            const dist = Math.hypot(wp.x - this.centerX, wp.y - this.centerY);
            if (dist < 18) {
              this.waypointIdx = (this.waypointIdx + 1) % this.waypoints.length;
              this.waitTimer = 1.25;
            } else {
              isMoving = this._moveToward(wp.x, wp.y, this.patrolSpeed, safeDt, level);
            }
          }
        }
      }

      this._updateSpriteDir();
      if (this.firingAnimTimer > 0) {
        if (this.spriteDir === 'up' && this.animFireUp) this.animFireUp.update(safeDt, true);
        else if (this.spriteDir === 'down' && this.animFireDown) this.animFireDown.update(safeDt, true);
        else if (this.animFire) this.animFire.update(safeDt, true);
      } else {
        if (this.animPatrol) this.animPatrol.update(safeDt, isMoving);
        if (this.animPatrolUp) this.animPatrolUp.update(safeDt, isMoving);
        if (this.animPatrolDown) this.animPatrolDown.update(safeDt, isMoving);
      }
    }

    _moveToward(tx, ty, speed, dt, level) {
      const dx = tx - this.centerX;
      const dy = ty - this.centerY;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) return false;
      const vx = (dx / dist) * speed;
      const vy = (dy / dist) * speed;
      this._rotateToward(Math.atan2(dy, dx), dt);

      const nx = this.x + vx * dt;
      if (!this._hitsSolid(nx, this.y, level)) this.x = nx;
      const ny = this.y + vy * dt;
      if (!this._hitsSolid(this.x, ny, level)) this.y = ny;
      return true;
    }

    _hitsSolid(testX, testY, level) {
      if (!level || !Array.isArray(level.obstacles)) return false;
      const cx = testX + this.width * 0.5;
      const cy = testY + this.height * 0.8;
      const r = 16;
      for (let i = 0; i < level.obstacles.length; i++) {
        const obs = level.obstacles[i];
        if (!obs.solid) continue;
        if (obs.type === 'blast_gate' && level.blastGateOpen) continue;
        const bx = obs.colX !== undefined ? obs.colX : obs.x;
        const by = obs.colY !== undefined ? obs.colY : obs.y;
        const bw = obs.colW !== undefined ? obs.colW : obs.width;
        const bh = obs.colH !== undefined ? obs.colH : obs.height;
        const clX = Math.max(bx, Math.min(cx, bx + bw));
        const clY = Math.max(by, Math.min(cy, by + bh));
        if ((cx - clX) * (cx - clX) + (cy - clY) * (cy - clY) < r * r) {
          return true;
        }
      }
      return false;
    }

    _drawInkSuspicionEye(ctx) {
      const cx = this.centerX;
      const cy = this.y - 24;
      const fill = Math.max(0, Math.min(1, this.suspicionMeter));

      ctx.save();
      // Hand-drawn parchment eye silhouette
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy);
      ctx.quadraticCurveTo(cx, cy - 11, cx + 14, cy);
      ctx.quadraticCurveTo(cx, cy + 11, cx - 14, cy);
      ctx.closePath();
      ctx.fillStyle = '#F7F3E8';
      ctx.fill();

      // Clip interior & fill upward with Prussian Blue -> Crimson ink as suspicion rises
      ctx.save();
      ctx.clip();
      const fillH = 22 * fill;
      ctx.fillStyle = fill > 0.72 ? '#F85A5A' : '#111E33';
      ctx.fillRect(cx - 15, cy + 11 - fillH, 30, fillH);
      // Pupil ring
      ctx.strokeStyle = fill > 0.5 ? '#F7F3E8' : '#111E33';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Outer dip-pen ink rim
      ctx.strokeStyle = fill > 0.72 ? '#C9323B' : '#111E33';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }

    _drawFacingChevron(ctx) {
      const ox = this.centerX;
      const oy = this.y + this.height - 4;
      const ang = Number.isFinite(this.facingAngle) ? this.facingAngle : 0;
      const cx = ox + Math.cos(ang) * 26;
      const cy = oy + Math.sin(ang) * 26 * 0.4;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.strokeStyle = (this.state === 'SUSPICIOUS' || this.state === 'ALERT')
        ? '#F85A5A'
        : 'rgba(17, 30, 51, 0.75)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // 10px long x 8px wide hand-drawn ink chevron pointing along facingAngle
      ctx.beginPath();
      ctx.moveTo(-5, -4);
      ctx.lineTo(5, 0);
      ctx.lineTo(-5, 4);
      ctx.stroke();
      ctx.restore();
    }

    draw(ctx) {
      if (!ctx) return;
      this._updateSpriteDir();
      ctx.save();
      if (this.dead) {
        ctx.globalAlpha = 0.34;
      }

      ctx.fillStyle = 'rgba(17, 30, 51, 0.22)';
      ctx.beginPath();
      ctx.ellipse(this.centerX, this.y + this.height - 4, 21, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Phase A1: Ground-projected facing chevron under feet (hidden when dead)
      if (!this.dead) {
        this._drawFacingChevron(ctx);
      }

      const drawW = this.role === 'commander' ? 96 : 84;
      const drawH = this.role === 'commander' ? 96 : 84;
      const drawX = this.centerX - drawW * 0.5;
      const drawY = this.y + this.height - drawH + 8;

      let drawn = false;
      if (this.dead) {
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.centerX - 14, this.y + this.height - 10);
        ctx.lineTo(this.centerX + 14, this.y + this.height - 2);
        ctx.moveTo(this.centerX + 14, this.y + this.height - 10);
        ctx.lineTo(this.centerX - 14, this.y + this.height - 2);
        ctx.stroke();
        drawn = true;
      } else if (this.firingAnimTimer > 0) {
        if (this.spriteDir === 'up' && this.animFireUp && this.animFireUp.isReady()) {
          drawn = this.animFireUp.draw(ctx, drawX, drawY, drawW, drawH, false);
        } else if (this.spriteDir === 'down' && this.animFireDown && this.animFireDown.isReady()) {
          drawn = this.animFireDown.draw(ctx, drawX, drawY, drawW, drawH, false);
        } else if (this.animFire && this.animFire.isReady()) {
          drawn = this.animFire.draw(ctx, drawX, drawY, drawW, drawH, !this.facingRight);
        }
      } else {
        if (this.spriteDir === 'up' && this.animPatrolUp && this.animPatrolUp.isReady()) {
          drawn = this.animPatrolUp.draw(ctx, drawX, drawY, drawW, drawH, false);
        } else if (this.spriteDir === 'down' && this.animPatrolDown && this.animPatrolDown.isReady()) {
          drawn = this.animPatrolDown.draw(ctx, drawX, drawY, drawW, drawH, false);
        } else if (this.animPatrol && this.animPatrol.isReady()) {
          drawn = this.animPatrol.draw(ctx, drawX, drawY, drawW, drawH, !this.facingRight);
        }
      }

      if (!drawn) {
        ctx.fillStyle = '#E6DAC0';
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(this.centerX - 13, this.y + 16, 26, 36, 4);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.centerX, this.y + 10, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Commander Ward nameplate & HP bar
      if (!this.dead && (this.role === 'commander' || this.hp < this.maxHp)) {
        const bw = this.role === 'commander' ? 54 : 38;
        const bx = this.centerX - bw * 0.5;
        const by = this.y - 12;
        ctx.fillStyle = '#F7F3E8';
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 1.4;
        ctx.fillRect(bx, by, bw, 6);
        ctx.fillStyle = '#F85A5A';
        ctx.fillRect(bx, by, bw * Math.max(0, this.hp / this.maxHp), 6);
        ctx.strokeRect(bx, by, bw, 6);
        if (this.role === 'commander') {
          ctx.fillStyle = '#111E33';
          ctx.font = 'bold 10px "Courier New", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('CMDR WARD', this.centerX, by - 4);
        }
      }

      // Phase A2: Priority "!" (ALERT) -> "?" (SUSPICIOUS) -> nothing (PATROL)
      // When suspicion eye is also visible, offset "?" cleanly to the right of the eye so they never overlap
      if (!this.dead) {
        if (this.state === 'ALERT') {
          ctx.fillStyle = '#F85A5A';
          ctx.font = '900 22px "Georgia", serif';
          ctx.textAlign = 'center';
          ctx.fillText('!', this.centerX, this.y - 20);
        } else {
          const showEye = this.suspicionMeter > 0.04;
          if (showEye) {
            this._drawInkSuspicionEye(ctx);
          }
          if (this.state === 'SUSPICIOUS') {
            ctx.fillStyle = '#111E33';
            ctx.font = '900 22px "Georgia", serif';
            ctx.textAlign = 'center';
            const qx = showEye ? this.centerX + 24 : this.centerX;
            ctx.fillText('?', qx, this.y - 20);
          }
        }
      }

      if (this.hurtFlashTimer > 0) {
        ctx.strokeStyle = '#F85A5A';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.centerX, this.y + this.height * 0.5, 28, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Mercenary;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.Mercenary = Mercenary;
})(typeof window !== 'undefined' ? window : globalThis);
