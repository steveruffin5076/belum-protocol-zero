// src/entities/drone.js - PMC Surveillance Quadcopter Drone (Task 4: Sector 3/4 Aerial Threat)
(function (global) {
  'use strict';

  // TODO: optionally replace procedural quadcopter drawing with a 688x384 ink prop in assets/environment/pmc_drone.png
  class SurveillanceDrone {
    constructor(opts) {
      const cfg = opts || {};
      this.id = cfg.id || 'drone_s34_1';
      this.sector = cfg.sector || 4;
      this.waypoints = Array.isArray(cfg.waypoints) && cfg.waypoints.length
        ? cfg.waypoints
        : [
            { x: 2980, y: 500 },
            { x: 3420, y: 460 },
            { x: 3640, y: 720 },
            { x: 3180, y: 760 }
          ];
      this.waypointIdx = 0;
      this.x = this.waypoints[0].x;
      this.y = this.waypoints[0].y;
      this.speed = cfg.speed || 92;
      this.coneRadius = cfg.coneRadius || 128;
      this.alertCallRadius = cfg.alertCallRadius || 520;
      this.altitude = 56;
      this.rotorPhase = 0;
      this.spottedPlayer = false;
      this.alertCooldown = 0;
      this.active = true;
    }

    get centerX() {
      return this.x;
    }

    get centerY() {
      return this.y;
    }

    get sortY() {
      // Aerial drone draws above ground characters
      return this.y + 180;
    }

    update(dt, player, mercenaries, ctxEvents) {
      if (!this.active) return;
      const safeDt = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0.016));
      this.rotorPhase += safeDt * 24;
      if (this.alertCooldown > 0) this.alertCooldown = Math.max(0, this.alertCooldown - safeDt);

      // Patrol waypoint loop
      const wp = this.waypoints[this.waypointIdx];
      if (wp) {
        const dx = wp.x - this.x;
        const dy = wp.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 10) {
          this.waypointIdx = (this.waypointIdx + 1) % this.waypoints.length;
        } else {
          this.x += (dx / dist) * this.speed * safeDt;
          this.y += (dy / dist) * this.speed * safeDt;
        }
      }

      // Downward vision cone check on ground directly beneath drone
      this.spottedPlayer = false;
      if (player && !player.dead) {
        const distP = Math.hypot(player.centerX - this.x, player.centerY - this.y);
        // Concealed player in ferns is hidden from overhead drone unless moving directly beneath (<42px)
        const effectiveRadius = player.isConcealed ? (player.moving ? 42 : 0) : this.coneRadius;
        if (effectiveRadius > 0 && distP <= effectiveRadius) {
          this.spottedPlayer = true;
          if (this.alertCooldown <= 0) {
            this.alertCooldown = 2.6;
            if (Array.isArray(mercenaries)) {
              for (let i = 0; i < mercenaries.length; i++) {
                const m = mercenaries[i];
                if (!m.dead && Math.hypot(m.centerX - this.x, m.centerY - this.y) <= this.alertCallRadius) {
                  m.triggerAlert(player.centerX, player.centerY, ctxEvents, 'PLAYER');
                }
              }
            }
            if (ctxEvents && ctxEvents.onDroneSpot) {
              ctxEvents.onDroneSpot(this, player);
            }
          }
        }
      }
    }

    drawCone(ctx) {
      if (!this.active || !ctx) return;
      ctx.save();
      // Downward ground scan ellipse
      ctx.fillStyle = this.spottedPlayer
        ? 'rgba(248, 90, 90, 0.24)'
        : 'rgba(17, 30, 51, 0.09)';
      ctx.strokeStyle = this.spottedPlayer
        ? 'rgba(248, 90, 90, 0.78)'
        : 'rgba(17, 30, 51, 0.34)';
      ctx.lineWidth = this.spottedPlayer ? 2.2 : 1.4;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.coneRadius, this.coneRadius * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      // Soft projected drop-shadow under quadcopter
      ctx.fillStyle = 'rgba(17, 30, 51, 0.16)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 4, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Faint downward beam lines from hovering drone to ground ellipse edges
      const hoverY = this.y - this.altitude;
      ctx.strokeStyle = this.spottedPlayer
        ? 'rgba(248, 90, 90, 0.32)'
        : 'rgba(17, 30, 51, 0.14)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(this.x, hoverY + 4);
      ctx.lineTo(this.x - this.coneRadius * 0.85, this.y);
      ctx.moveTo(this.x, hoverY + 4);
      ctx.lineTo(this.x + this.coneRadius * 0.85, this.y);
      ctx.stroke();
      ctx.restore();
    }

    draw(ctx, time) {
      if (!this.active || !ctx) return;
      const bob = Math.sin((time || 0) * 5.2) * 3.5;
      const dy = this.y - this.altitude + bob;

      ctx.save();
      ctx.translate(this.x, dy);

      // X-frame arms in Prussian-blue ink
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-16, -10);
      ctx.lineTo(16, 10);
      ctx.moveTo(16, -10);
      ctx.lineTo(-16, 10);
      ctx.stroke();

      // 4 spinning rotor rings
      const rotors = [[-16, -10], [16, -10], [-16, 10], [16, 10]];
      for (let i = 0; i < rotors.length; i++) {
        const rx = rotors[i][0];
        const ry = rotors[i][1];
        ctx.strokeStyle = 'rgba(17, 30, 51, 0.55)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(rx, ry, 9, 4.5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Rotor blade blur stroke
        const a = this.rotorPhase + i * 1.4;
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx - Math.cos(a) * 7, ry - Math.sin(a) * 3.2);
        ctx.lineTo(rx + Math.cos(a) * 7, ry + Math.sin(a) * 3.2);
        ctx.stroke();
      }

      // Central fuselage body
      ctx.fillStyle = '#F7F3E8';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(-8, -5, 16, 10, 3);
      ctx.fill();
      ctx.stroke();

      // Crimson optical sensor lens (only crimson accent)
      ctx.fillStyle = '#F85A5A';
      ctx.beginPath();
      ctx.arc(0, 1, this.spottedPlayer ? 3.5 : 2.3, 0, Math.PI * 2);
      ctx.fill();

      // Label tag
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.spottedPlayer ? '#F85A5A' : '#111E33';
      ctx.fillText(this.spottedPlayer ? 'UAV // TARGET' : 'PMC UAV', 0, -16);
      ctx.restore();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SurveillanceDrone;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.SurveillanceDrone = SurveillanceDrone;
})(typeof window !== 'undefined' ? window : globalThis);
