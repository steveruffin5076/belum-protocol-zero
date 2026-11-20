// src/entities/boar.js - Mutated Babi Hutan AI with 1.2s Red Telegraph, Faction Infighting & 2.6s Matador Wall-Stun Concussion
(function (global) {
  'use strict';

  const Animator =
    (global.BelumGame && global.BelumGame.Sprite8FrameAnimator) ||
    (typeof require !== 'undefined' ? require('../engine/animator.js') : null);

  class MutatedBoar {
    constructor(opts) {
      const cfg = opts || {};
      this.id = cfg.id || `boar_${Math.random().toString(36).slice(2, 7)}`;
      this.faction = 'FAUNA';
      this.x = Number.isFinite(cfg.x) ? cfg.x : 2480;
      this.y = Number.isFinite(cfg.y) ? cfg.y : 525;
      this.homeX = this.x;
      this.homeY = this.y;
      this.width = 64;
      this.height = 54;

      this.maxHp = cfg.hp || 110;
      this.hp = this.maxHp;
      this.dead = false;
      this.meatHarvested = false;

      // State Machine: 'GRAZE' | 'AGITATED' | 'TELEGRAPH' | 'CHARGE' | 'RECOIL' | 'STUNNED' | 'DEAD'
      this.state = 'GRAZE';
      this.telegraphDuration = 1.2;
      this.telegraphTimer = 0;
      this.telegraphRadius = 96;
      this.chargeDuration = 0.78;
      this.chargeTimer = 0;
      this.chargeSpeed = 420;
      this.chargeDirX = 1;
      this.chargeDirY = 0;
      this.chargeDamage = 78;
      this.playerChargeDamage = 4;
      this.hitSet = new Set();

      // AAA Matador Wall-Crash Concussion (2.6s stun with 3 orbiting ink stars)
      this.stunDuration = 2.6;
      this.stunTimer = 0;

      this.recoilTimer = 0;
      this.grazeTimer = 1.5;
      this.grazeDir = { x: 1, y: 0 };
      this.facingRight = true;
      this.hurtFlashTimer = 0;
      this.provokedTarget = null;

      this.animIdle = Animator ? new Animator({ fps: 8, framePrefix: 'boar_idle' }) : null;
      // Enemy Part A4: Split telegraph pawing (frames 0-2) from full-speed charge gallop (frames 3-7)
      this.animPaw = Animator ? new Animator({ fps: 6, firstFrame: 0, lastFrame: 2, loop: true, framePrefix: 'boar_charge' }) : null;
      this.animRun = Animator ? new Animator({ fps: 14, firstFrame: 3, lastFrame: 7, loop: true, framePrefix: 'boar_charge' }) : null;
      this.animCharge = this.animRun;
    }

    get centerX() {
      return this.x + this.width * 0.5;
    }

    get centerY() {
      return this.y + this.height * 0.65;
    }

    get sortY() {
      return this.y + this.height;
    }

    provokeToward(tx, ty, ctxEvents) {
      if (this.dead || this.state === 'STUNNED') return;
      this.provokedTarget = { x: tx, y: ty };
      if (this.state === 'GRAZE' || this.state === 'AGITATED') {
        this._beginTelegraph(tx, ty, ctxEvents);
      }
    }

    takeDamage(amount, attackerPos, ctxEvents) {
      if (this.dead) return 0;
      // Bonus vulnerability during STUNNED concussion window
      const mult = this.state === 'STUNNED' ? 1.35 : 1.0;
      const dmg = Math.max(1, Math.round((amount || 1) * mult));
      this.hp = Math.max(0, this.hp - dmg);
      this.hurtFlashTimer = 0.22;
      if (this.hp <= 0) {
        this.dead = true;
        this.state = 'DEAD';
        if (ctxEvents && ctxEvents.onBoarKilled) {
          ctxEvents.onBoarKilled(this);
        }
      } else if (attackerPos && this.state === 'GRAZE') {
        this._beginTelegraph(attackerPos.x, attackerPos.y, ctxEvents);
      }
      return dmg;
    }

    _beginTelegraph(tx, ty, ctxEvents) {
      this.state = 'TELEGRAPH';
      this.telegraphTimer = 0;
      const dx = tx - this.centerX;
      const dy = ty - this.centerY;
      const mag = Math.hypot(dx, dy) || 1;
      this.chargeDirX = dx / mag;
      this.chargeDirY = dy / mag;
      this.facingRight = this.chargeDirX >= 0;
      if (this.animPaw) this.animPaw.reset();
      if (this.animRun) this.animRun.reset();
      if (ctxEvents && ctxEvents.onBoarTelegraph) {
        ctxEvents.onBoarTelegraph(this);
      }
    }

    update(dt, player, mercenaries, level, ctxEvents) {
      if (this.dead) return;
      const safeDt = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0.016));
      if (this.hurtFlashTimer > 0) this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - safeDt);

      // Handle STUNNED concussion state (2.6s)
      if (this.state === 'STUNNED') {
        this.stunTimer -= safeDt;
        if (this.animIdle) this.animIdle.update(safeDt * 0.35, true);
        if (this.stunTimer <= 0) {
          this.state = 'GRAZE';
        }
        return;
      }

      // Find nearest valid target (Mercenaries OR non-concealed Player)
      let nearest = null;
      let nearestDist = 275;

      if (Array.isArray(mercenaries)) {
        for (let i = 0; i < mercenaries.length; i++) {
          const m = mercenaries[i];
          if (m.dead) continue;
          const d = Math.hypot(m.centerX - this.centerX, m.centerY - this.centerY);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = { x: m.centerX, y: m.centerY, entity: m, faction: 'MERC' };
          }
        }
      }
      if (player && !player.dead && !player.isConcealed) {
        const dp = Math.hypot(player.centerX - this.centerX, player.centerY - this.centerY);
        if (dp < nearestDist) {
          nearestDist = dp;
          nearest = { x: player.centerX, y: player.centerY, entity: player, faction: 'PLAYER' };
        }
      }

      if (this.state === 'GRAZE') {
        if (nearest && nearestDist < 225) {
          this._beginTelegraph(nearest.x, nearest.y, ctxEvents);
        } else {
          this.grazeTimer -= safeDt;
          if (this.grazeTimer <= 0) {
            this.grazeTimer = 1.6 + Math.random() * 1.6;
            const ang = Math.random() * Math.PI * 2;
            this.grazeDir = { x: Math.cos(ang), y: Math.sin(ang) };
            if (Math.hypot(this.x - this.homeX, this.y - this.homeY) > 130) {
              const hx = this.homeX - this.x;
              const hy = this.homeY - this.y;
              const hm = Math.hypot(hx, hy) || 1;
              this.grazeDir = { x: hx / hm, y: hy / hm };
            }
          }
          const nx = this.x + this.grazeDir.x * 34 * safeDt;
          const ny = this.y + this.grazeDir.y * 34 * safeDt;
          if (!this._hitsSolid(nx, this.y, level)) this.x = nx;
          if (!this._hitsSolid(this.x, ny, level)) this.y = ny;
          this.facingRight = this.grazeDir.x >= 0;
        }
        if (this.animIdle) this.animIdle.update(safeDt, true);
      } else if (this.state === 'TELEGRAPH') {
        this.telegraphTimer += safeDt;
        if (this.animPaw) this.animPaw.update(safeDt, true);
        if (this.telegraphTimer >= this.telegraphDuration) {
          this.state = 'CHARGE';
          this.chargeTimer = this.chargeDuration;
          this.hitSet.clear();
          if (this.animRun) this.animRun.reset();
          if (ctxEvents && ctxEvents.onBoarCharge) {
            ctxEvents.onBoarCharge(this);
          }
        }
      } else if (this.state === 'CHARGE') {
        this.chargeTimer -= safeDt;
        const nx = this.x + this.chargeDirX * this.chargeSpeed * safeDt;
        const ny = this.y + this.chargeDirY * this.chargeSpeed * safeDt;
        const hitObsX = this._hitsSolid(nx, this.y, level);
        const hitObsY = this._hitsSolid(this.x, ny, level);
        if (!hitObsX) this.x = nx;
        if (!hitObsY) this.y = ny;

        const collidedObs = hitObsX || hitObsY;

        this._checkChargeImpacts(player, mercenaries, ctxEvents);

        if (this.animRun) this.animRun.update(safeDt, true);

        if (collidedObs) {
          // AAA Matador Wall-Crash Concussion!
          this.state = 'STUNNED';
          this.stunTimer = this.stunDuration;
          this.provokedTarget = null;
          if (ctxEvents && ctxEvents.onBoarWallStun) {
            ctxEvents.onBoarWallStun(this, collidedObs);
          }
        } else if (this.chargeTimer <= 0) {
          this.state = 'RECOIL';
          this.recoilTimer = 0.85;
          this.provokedTarget = null;
        }
      } else if (this.state === 'RECOIL') {
        this.recoilTimer -= safeDt;
        if (this.animIdle) this.animIdle.update(safeDt * 0.6, true);
        if (this.recoilTimer <= 0) {
          if (nearest && nearestDist < 260) {
            this._beginTelegraph(nearest.x, nearest.y, ctxEvents);
          } else {
            this.state = 'GRAZE';
          }
        }
      }
    }

    _checkChargeImpacts(player, mercenaries, ctxEvents) {
      const impactR = 46;

      if (Array.isArray(mercenaries)) {
        for (let i = 0; i < mercenaries.length; i++) {
          const m = mercenaries[i];
          if (m.dead || this.hitSet.has(m.id)) continue;
          if (this.faction !== m.faction) {
            const dist = Math.hypot(m.centerX - this.centerX, m.centerY - this.centerY);
            if (dist < impactR) {
              this.hitSet.add(m.id);
              const dealt = m.takeDamage(this.chargeDamage, { x: this.centerX, y: this.centerY }, ctxEvents, 'FAUNA');
              if (ctxEvents && ctxEvents.onBoarImpact) {
                ctxEvents.onBoarImpact(m, dealt, '78', this);
              }
            }
          }
        }
      }

      if (player && !player.dead && !this.hitSet.has('PLAYER')) {
        const distP = Math.hypot(player.centerX - this.centerX, player.centerY - this.centerY);
        if (distP < impactR) {
          this.hitSet.add('PLAYER');
          const dealt = player.takeDamage(this.playerChargeDamage);
          if (dealt > 0 && ctxEvents && ctxEvents.onBoarImpact) {
            ctxEvents.onBoarImpact(player, dealt, `-${dealt} HP`, this);
          }
        }
      }
    }

    _hitsSolid(testX, testY, level) {
      if (!level || !Array.isArray(level.obstacles)) return null;
      const cx = testX + this.width * 0.5;
      const cy = testY + this.height * 0.72;
      const r = 20;
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
          return obs;
        }
      }
      return null;
    }

    _drawStunStars(ctx, time) {
      const cx = this.centerX;
      const cy = this.y - 8;
      const t = (time || 0) * 4.8;
      ctx.save();
      // Orbit ring
      ctx.strokeStyle = 'rgba(17, 30, 51, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 22, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3 orbiting hand-drawn ink stars
      for (let s = 0; s < 3; s++) {
        const ang = t + (s * Math.PI * 2) / 3;
        const sx = cx + Math.cos(ang) * 22;
        const sy = cy + Math.sin(ang) * 8;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.fillStyle = s === 0 ? '#F85A5A' : '#F7F3E8';
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let p = 0; p < 5; p++) {
          const outerA = (p * Math.PI * 2) / 5 - Math.PI * 0.5;
          const innerA = outerA + Math.PI / 5;
          const ox = Math.cos(outerA) * 6;
          const oy = Math.sin(outerA) * 6;
          const ix = Math.cos(innerA) * 2.5;
          const iy = Math.sin(innerA) * 2.5;
          if (p === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
          ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    draw(ctx, time) {
      if (!ctx) return;
      ctx.save();
      if (this.dead) {
        ctx.globalAlpha = 0.4;
      }

      ctx.fillStyle = 'rgba(17, 30, 51, 0.22)';
      ctx.beginPath();
      ctx.ellipse(this.centerX, this.y + this.height - 4, 28, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      const drawW = 104;
      const drawH = 102;
      const drawX = this.centerX - drawW * 0.5;
      const drawY = this.y + this.height - drawH + 8;

      let drawn = false;
      if (this.state === 'TELEGRAPH' && this.animPaw && this.animPaw.isReady()) {
        drawn = this.animPaw.draw(ctx, drawX, drawY, drawW, drawH, !this.facingRight);
      } else if (this.state === 'CHARGE' && this.animRun && this.animRun.isReady()) {
        drawn = this.animRun.draw(ctx, drawX, drawY, drawW, drawH, !this.facingRight);
      } else if (this.animIdle && this.animIdle.isReady()) {
        drawn = this.animIdle.draw(ctx, drawX, drawY, drawW, drawH, !this.facingRight);
      }

      if (!drawn) {
        ctx.fillStyle = '#E6DAC0';
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(this.centerX, this.centerY, 26, 17, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      if (!this.dead && this.state === 'STUNNED') {
        this._drawStunStars(ctx, time);
      }

      if (!this.dead && this.hp < this.maxHp) {
        const bw = 48;
        const bx = this.centerX - bw * 0.5;
        const by = this.y - 10;
        ctx.fillStyle = '#F7F3E8';
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 1.4;
        ctx.fillRect(bx, by, bw, 6);
        ctx.fillStyle = '#F85A5A';
        ctx.fillRect(bx, by, bw * Math.max(0, this.hp / this.maxHp), 6);
        ctx.strokeRect(bx, by, bw, 6);
      }

      if (this.hurtFlashTimer > 0) {
        if (global.BelumGame && global.BelumGame.reduceFlash) {
          ctx.fillStyle = 'rgba(248, 90, 90, 0.22)';
          ctx.beginPath();
          ctx.ellipse(this.centerX, this.centerY, 30, 22, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = '#F85A5A';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(this.centerX, this.centerY, 32, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MutatedBoar;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.MutatedBoar = MutatedBoar;
})(typeof window !== 'undefined' ? window : globalThis);
