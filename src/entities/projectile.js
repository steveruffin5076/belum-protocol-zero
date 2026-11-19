// src/entities/projectile.js - Crossbow bolts, Suppressed 9mm rounds, PMC bullets, and Thrown Decoy Rocks
(function (global) {
  'use strict';

  class Projectile {
    constructor(opts) {
      const cfg = opts || {};
      this.id = cfg.id || `proj_${Math.random().toString(36).slice(2, 8)}`;
      this.type = cfg.type || 'bolt'; // 'bolt' | 'pistol9mm' | 'merc_bullet' | 'decoy_rock'
      this.faction = cfg.faction || 'PLAYER'; // 'PLAYER' | 'MERC'
      this.x = Number.isFinite(cfg.x) ? cfg.x : 0;
      this.y = Number.isFinite(cfg.y) ? cfg.y : 0;
      this.startX = this.x;
      this.startY = this.y;
      this.vx = Number.isFinite(cfg.vx) ? cfg.vx : 0;
      this.vy = Number.isFinite(cfg.vy) ? cfg.vy : 0;
      this.angle = Math.atan2(this.vy, this.vx);
      this.damage = Number.isFinite(cfg.damage) ? cfg.damage : 55;
      this.maxRange = Number.isFinite(cfg.maxRange) ? cfg.maxRange : 450;
      this.traveled = 0;
      this.radius = cfg.radius || 5;
      this.height = 12;
      this.dead = false;
      this.retrievable = this.type === 'bolt';

      // Decoy rock arc parameters
      this.targetDist = cfg.targetDist || 260;
      this.arcHeight = 0;
      this.landed = false;
    }

    get sortY() {
      return this.y + this.height;
    }

    update(dt, obstacles) {
      if (this.dead) return null;
      const safeDt = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0.016));
      const stepX = this.vx * safeDt;
      const stepY = this.vy * safeDt;
      this.x += stepX;
      this.y += stepY;
      this.traveled += Math.hypot(stepX, stepY);

      if (this.type === 'decoy_rock') {
        const t = Math.min(1, this.traveled / Math.max(40, this.targetDist));
        this.arcHeight = Math.sin(t * Math.PI) * 58;
        if (t >= 1) {
          this.dead = true;
          this.landed = true;
          return { event: 'DECOY_LANDED', x: this.x, y: this.y, radius: 280 };
        }
        return null;
      }

      // Check solid obstacle collision
      if (Array.isArray(obstacles)) {
        for (let i = 0; i < obstacles.length; i++) {
          const obs = obstacles[i];
          if (!obs.solid || obs.blocksProjectiles === false) continue;
          const bx = obs.colX !== undefined ? obs.colX : obs.x;
          const by = obs.colY !== undefined ? obs.colY : obs.y;
          const bw = obs.colW !== undefined ? obs.colW : obs.width;
          const bh = obs.colH !== undefined ? obs.colH : obs.height;
          if (this.x >= bx && this.x <= bx + bw && this.y >= by && this.y <= by + bh) {
            this.dead = true;
            return { event: 'HIT_WALL', x: this.x, y: this.y, dropBolt: this.retrievable };
          }
        }
      }

      if (this.traveled >= this.maxRange) {
        this.dead = true;
        return { event: 'EXPIRED', x: this.x, y: this.y, dropBolt: this.retrievable };
      }

      return null;
    }

    draw(ctx) {
      if (this.dead || !ctx) return;
      ctx.save();
      if (this.type === 'decoy_rock') {
        // Ground shadow
        ctx.fillStyle = 'rgba(17, 30, 51, 0.22)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 4, 6, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Pebble in flight
        ctx.fillStyle = '#E6DAC0';
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.arcHeight, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (this.type === 'bolt') {
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        // Crimson fletching
        ctx.strokeStyle = '#F85A5A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-12, -3);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-12, 3);
        ctx.stroke();
      } else {
        // 9mm suppressed round or PMC rifle tracer
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = this.faction === 'MERC' ? '#F85A5A' : '#1C2844';
        ctx.lineWidth = this.faction === 'MERC' ? 2.6 : 2.2;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
        ctx.fillStyle = '#F85A5A';
        ctx.beginPath();
        ctx.arc(6, 0, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Projectile;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.Projectile = Projectile;
})(typeof window !== 'undefined' ? window : globalThis);
