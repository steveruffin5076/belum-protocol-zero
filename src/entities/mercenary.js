// src/entities/mercenary.js - Ironclad Tactical Solutions PMC Guard & Commander Ward AI
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

      // Vision & Patrol
      this.fovDeg = this.role === 'spotter' ? 75 : 65;
      this.visionRange = this.role === 'spotter' ? 320 : 270;
      this.facingAngle = Number.isFinite(cfg.facingAngle) ? cfg.facingAngle : Math.PI;
      this.facingRight = Math.cos(this.facingAngle) >= 0;

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

      // 8-frame animators
      this.animPatrol = Animator ? new Animator({ fps: 8, framePrefix: 'merc_patrol' }) : null;
      this.animFire = Animator ? new Animator({ fps: 12, framePrefix: 'merc_fire' }) : null;
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

    isBehindMe(px, py) {
      const toPlayerAngle = Math.atan2(py - this.centerY, px - this.centerX);
      const diff = Math.abs(normalizeAngle(toPlayerAngle - this.facingAngle));
      return diff > Math.PI * 0.55;
    }

    hearSound(sx, sy, priority) {
      if (this.dead) return;
      if (this.state === 'ALERT' && !priority) return;
      this.state = 'SUSPICIOUS';
      this.suspicionTarget = { x: sx, y: sy };
      this.suspicionTimer = 5.5;
      this.alertMarkTimer = 1.6;
    }

    triggerAlert(tx, ty, ctxEvents) {
      if (this.dead) return;
      const wasAlert = this.state === 'ALERT';
      this.state = 'ALERT';
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
        // Section 7.2: 100% invisible unless physically colliding
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

      // 1. Check Faction Infighting: scan hostile/nearby Mutated Boars (FAUNA)
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

      // 2. Check Player visibility (respects fern/log concealment)
      if (player && !player.dead) {
        const seesPlayer = this._canSeeTarget(player.centerX, player.centerY, player.isConcealed, obstacles);
        const distP = Math.hypot(player.centerX - this.centerX, player.centerY - this.centerY);
        // Sprinting loudly right next to guard triggers suspicion
        if (seesPlayer && distP < targetDist) {
          activeTarget = { x: player.centerX, y: player.centerY, ref: player, faction: 'PLAYER' };
          targetDist = distP;
        } else if (player.sprinting && distP < 130 && this.state === 'PATROL') {
          this.hearSound(player.centerX, player.centerY, false);
        }
      }

      let isMoving = false;

      if (activeTarget) {
        this.triggerAlert(activeTarget.x, activeTarget.y, ctxEvents);
        this.facingAngle = Math.atan2(activeTarget.y - this.centerY, activeTarget.x - this.centerX);
        this.facingRight = Math.cos(this.facingAngle) >= 0;

        // Maintain tactical firing distance or engage with 3-round bursts
        if (targetDist > 210) {
          isMoving = this._moveToward(activeTarget.x, activeTarget.y, this.alertSpeed, safeDt, level);
        }

        // Fire 3-round burst
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
      } else if (this.state === 'ALERT') {
        this.alertMemoryTimer -= safeDt;
        if (this.suspicionTarget) {
          const dist = Math.hypot(this.suspicionTarget.x - this.centerX, this.suspicionTarget.y - this.centerY);
          if (dist > 28) {
            isMoving = this._moveToward(this.suspicionTarget.x, this.suspicionTarget.y, this.alertSpeed, safeDt, level);
          } else {
            this.facingAngle += 1.4 * safeDt;
          }
        }
        if (this.alertMemoryTimer <= 0) {
          this.state = 'PATROL';
        }
      } else if (this.state === 'SUSPICIOUS') {
        this.suspicionTimer -= safeDt;
        if (this.suspicionTarget) {
          const dist = Math.hypot(this.suspicionTarget.x - this.centerX, this.suspicionTarget.y - this.centerY);
          if (dist > 34) {
            isMoving = this._moveToward(this.suspicionTarget.x, this.suspicionTarget.y, this.patrolSpeed * 1.15, safeDt, level);
          } else {
            // Look around cautiously
            this.facingAngle += Math.sin(this.suspicionTimer * 2.5) * 1.1 * safeDt;
          }
        }
        if (this.suspicionTimer <= 0) {
          this.state = 'PATROL';
          this.suspicionTarget = null;
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

      this.facingRight = Math.cos(this.facingAngle) >= 0;

      // Update 8-frame animations
      if (this.firingAnimTimer > 0 && this.animFire) {
        this.animFire.update(safeDt, true);
      } else if (this.animPatrol) {
        this.animPatrol.update(safeDt, isMoving);
      }
    }

    _moveToward(tx, ty, speed, dt, level) {
      const dx = tx - this.centerX;
      const dy = ty - this.centerY;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) return false;
      const vx = (dx / dist) * speed;
      const vy = (dy / dist) * speed;
      this.facingAngle = Math.atan2(dy, dx);

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

    draw(ctx) {
      if (!ctx) return;
      ctx.save();
      if (this.dead) {
        ctx.globalAlpha = 0.32;
      }

      // Ground ink shadow
      ctx.fillStyle = 'rgba(17, 30, 51, 0.22)';
      ctx.beginPath();
      ctx.ellipse(this.centerX, this.y + this.height - 4, 21, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      const drawW = this.role === 'commander' ? 96 : 84;
      const drawH = this.role === 'commander' ? 96 : 84;
      const drawX = this.centerX - drawW * 0.5;
      const drawY = this.y + this.height - drawH + 8;

      let drawn = false;
      if (this.dead) {
        // Ink silhouette marker for neutralized guard
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.centerX - 14, this.y + this.height - 10);
        ctx.lineTo(this.centerX + 14, this.y + this.height - 2);
        ctx.moveTo(this.centerX + 14, this.y + this.height - 10);
        ctx.lineTo(this.centerX - 14, this.y + this.height - 2);
        ctx.stroke();
        drawn = true;
      } else if (this.firingAnimTimer > 0 && this.animFire && this.animFire.isReady()) {
        drawn = this.animFire.draw(ctx, drawX, drawY, drawW, drawH, !this.facingRight);
      } else if (this.animPatrol && this.animPatrol.isReady()) {
        drawn = this.animPatrol.draw(ctx, drawX, drawY, drawW, drawH, !this.facingRight);
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

      // Crimson alert "!" or "?" mark
      if (!this.dead && (this.state === 'ALERT' || this.state === 'SUSPICIOUS')) {
        ctx.fillStyle = this.state === 'ALERT' ? '#F85A5A' : '#C9323B';
        ctx.font = '900 22px "Georgia", serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.state === 'ALERT' ? '!' : '?', this.centerX, this.y - 18);
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
