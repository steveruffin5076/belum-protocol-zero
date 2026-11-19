// src/engine/renderer.js - 2.5D Oblique Dip-Pen Ink Canvas Renderer with Y-Sorting & Red Telegraphs
// Palette strictly enforces Prussian Blue Ink (#111E33) on Aged Cream Paper (#F7F3E8) + Crimson (#F85A5A)
(function (global) {
  'use strict';

  const PALETTE = {
    paperBase: '#F7F3E8',
    paperWarm: '#F4ECD8',
    paperAged: '#E8DEC5',
    inkDeep: '#111E33',
    inkMid: '#1C2844',
    inkSoft: '#2E4062',
    inkFaint: 'rgba(17, 30, 51, 0.14)',
    crimson: '#F85A5A',
    crimsonDeep: '#C9323B',
    fernTint: 'rgba(54, 102, 74, 0.22)',
    waterTint: 'rgba(28, 48, 78, 0.16)'
  };

  class Renderer25D {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.width = 1280;
      this.height = 720;
      this.dpr = 1;
      this.paperPattern = null;
      this.paperTextureImg = null;
      this.rainDrops = [];
      this.time = 0;
      this._initRain();
      this._loadPaperTexture();
    }

    _initRain() {
      this.rainDrops = [];
      for (let i = 0; i < 110; i++) {
        this.rainDrops.push({
          x: Math.random() * 1600,
          y: Math.random() * 1000,
          len: 12 + Math.random() * 14,
          speed: 420 + Math.random() * 240,
          alpha: 0.12 + Math.random() * 0.18
        });
      }
    }

    _loadPaperTexture() {
      if (typeof Image === 'undefined') return;
      const img = new Image();
      img.onload = () => {
        this.paperTextureImg = img;
        if (this.ctx) {
          try {
            this.paperPattern = this.ctx.createPattern(img, 'repeat');
          } catch (_) {
            this.paperPattern = null;
          }
        }
      };
      img.onerror = () => {
        this.paperTextureImg = null;
      };
      img.src = 'assets/environment/paper_bg.png';
    }

    resize(width, height) {
      if (!this.canvas || !this.ctx) return;
      this.dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
      this.width = Math.max(320, Math.floor(width));
      this.height = Math.max(240, Math.floor(height));
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    /**
     * Core Y-Sorting helper matching Section 7.2 specification
     */
    static sortByDepth(entitiesList) {
      return entitiesList.sort((a, b) => {
        const ay = (a.sortY !== undefined ? a.sortY : (a.y + (a.height || 0)));
        const by = (b.sortY !== undefined ? b.sortY : (b.y + (b.height || 0)));
        return ay - by;
      });
    }

    render(state, dt) {
      if (!this.ctx || !state) return;
      const ctx = this.ctx;
      const safeDt = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0.016));
      this.time += safeDt;

      const cam = state.camera ? state.camera.getRenderOffset() : { x: 0, y: 0 };

      // 1. Aged Cream Parchment Base
      ctx.save();
      ctx.fillStyle = PALETTE.paperBase;
      ctx.fillRect(0, 0, this.width, this.height);

      // Subtle paper tooth pattern
      if (this.paperPattern) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.translate(-cam.x % 256, -cam.y % 256);
        ctx.fillStyle = this.paperPattern;
        ctx.fillRect(-256, -256, this.width + 512, this.height + 512);
        ctx.restore();
      } else {
        this._drawProceduralPaperGrain(ctx, cam);
      }

      // World-space transform
      ctx.save();
      ctx.translate(-cam.x, -cam.y);

      // 2. Ground Sectors, Riverbank Water, Paths, Floorboards & Concrete
      if (state.level) {
        this._drawTerrain(ctx, state.level, cam);
      }

      // 3. Ground Layer Effects: Spores, Floodlights, Vision Cones, Telegraphs, Acoustic Rings, Laser Tripwires
      this._drawGroundZones(ctx, state);
      this._drawVisionConesAndLasers(ctx, state);
      this._drawTelegraphs(ctx, state);
      this._drawAcousticRings(ctx, state);
      this._drawPickupsAndInteractables(ctx, state);

      // 4. 2.5D Y-SORTING DEPTH PASS (Obstacles, Ferns, Logs, Player, Mercenaries, Boars, Projectiles)
      const drawables = [];
      if (state.level && Array.isArray(state.level.obstacles)) {
        for (let i = 0; i < state.level.obstacles.length; i++) {
          const obs = state.level.obstacles[i];
          if (this._isVisible(obs.x, obs.y, obs.width || 120, obs.height || 120, cam)) {
            drawables.push(obs);
          }
        }
      }
      if (state.player) {
        drawables.push(state.player);
      }
      if (Array.isArray(state.mercenaries)) {
        for (let i = 0; i < state.mercenaries.length; i++) {
          drawables.push(state.mercenaries[i]);
        }
      }
      if (Array.isArray(state.boars)) {
        for (let i = 0; i < state.boars.length; i++) {
          drawables.push(state.boars[i]);
        }
      }
      if (Array.isArray(state.projectiles)) {
        for (let i = 0; i < state.projectiles.length; i++) {
          drawables.push(state.projectiles[i]);
        }
      }

      Renderer25D.sortByDepth(drawables);
      for (let i = 0; i < drawables.length; i++) {
        const entity = drawables[i];
        if (typeof entity.draw === 'function') {
          entity.draw(ctx, this.time);
        }
      }

      // 5. Melee Slash Arcs & Floating Crimson Damage Numbers / Alert Marks
      this._drawSlashEffects(ctx, state);
      this._drawFloatingTexts(ctx, state);

      ctx.restore(); // End world-space

      // 6. Screen-space Tropical Rain & Low-Health Crimson Pulse
      this._drawRainOverlay(ctx, safeDt);
      if (state.player && state.player.hp > 0 && state.player.hp <= Math.ceil(state.player.maxHp * 0.3)) {
        const pulse = 0.08 + 0.08 * Math.sin(this.time * 7);
        const grad = ctx.createRadialGradient(
          this.width * 0.5, this.height * 0.5, this.height * 0.25,
          this.width * 0.5, this.height * 0.5, this.width * 0.65
        );
        grad.addColorStop(0, 'rgba(248, 90, 90, 0)');
        grad.addColorStop(1, `rgba(248, 90, 90, ${pulse.toFixed(3)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);
      }

      ctx.restore();
    }

    _isVisible(x, y, w, h, cam) {
      const margin = 180;
      return (
        x + w >= cam.x - margin &&
        x <= cam.x + this.width + margin &&
        y + h >= cam.y - margin &&
        y <= cam.y + this.height + margin
      );
    }

    _drawProceduralPaperGrain(ctx, cam) {
      ctx.save();
      ctx.strokeStyle = 'rgba(17, 30, 51, 0.035)';
      ctx.lineWidth = 1;
      const step = 48;
      const offsetX = -(cam.x % step);
      const offsetY = -(cam.y % step);
      for (let x = offsetX; x < this.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 12, this.height);
        ctx.stroke();
      }
      for (let y = offsetY; y < this.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawTerrain(ctx, level, cam) {
      // Sector bands & ink-hatched environmental flooring
      const sectors = level.sectors || [];
      for (let i = 0; i < sectors.length; i++) {
        const s = sectors[i];
        if (!this._isVisible(s.x, s.y, s.width, s.height, cam)) continue;

        ctx.save();
        ctx.fillStyle = s.groundTint || PALETTE.paperWarm;
        ctx.fillRect(s.x, s.y, s.width, s.height);

        // Sector ink divider etching
        ctx.strokeStyle = 'rgba(17, 30, 51, 0.18)';
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(s.x, s.y, s.width, s.height);
        ctx.setLineDash([]);

        // Engraved map watermark
        ctx.fillStyle = 'rgba(17, 30, 51, 0.14)';
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.fillText(s.label || '', s.x + 24, s.y + 34);
        ctx.restore();
      }

      // Riverbank water current on left edge (Sungai Belum)
      if (level.riverZone) {
        const rz = level.riverZone;
        if (this._isVisible(rz.x, rz.y, rz.width, rz.height, cam)) {
          ctx.save();
          ctx.fillStyle = PALETTE.waterTint;
          ctx.fillRect(rz.x, rz.y, rz.width, rz.height);
          ctx.strokeStyle = 'rgba(17, 30, 51, 0.34)';
          ctx.lineWidth = 1.4;
          for (let y = rz.y + 20; y < rz.y + rz.height; y += 34) {
            const wave = Math.sin(this.time * 2.2 + y * 0.04) * 9;
            ctx.beginPath();
            ctx.moveTo(rz.x + 14, y);
            ctx.quadraticCurveTo(rz.x + rz.width * 0.5 + wave, y + 8, rz.x + rz.width - 12, y - 3);
            ctx.stroke();
          }
          // Muddy shoreline hatch
          ctx.strokeStyle = PALETTE.inkMid;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(rz.x + rz.width, rz.y);
          ctx.lineTo(rz.x + rz.width, rz.y + rz.height);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Dirt trail & Sector pathways
      if (Array.isArray(level.paths)) {
        ctx.save();
        for (let i = 0; i < level.paths.length; i++) {
          const p = level.paths[i];
          ctx.fillStyle = p.fill || 'rgba(205, 190, 158, 0.42)';
          ctx.fillRect(p.x, p.y, p.width, p.height);
          ctx.strokeStyle = 'rgba(17, 30, 51, 0.22)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([6, 8]);
          ctx.strokeRect(p.x, p.y, p.width, p.height);
        }
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Culvert flooded drainage channel (Sector 4 Stealth Option A)
      if (level.culvertZone) {
        const cz = level.culvertZone;
        ctx.save();
        ctx.fillStyle = 'rgba(28, 48, 78, 0.24)';
        ctx.fillRect(cz.x, cz.y, cz.width, cz.height);
        ctx.strokeStyle = PALETTE.inkMid;
        ctx.lineWidth = 2;
        ctx.strokeRect(cz.x, cz.y, cz.width, cz.height);
        ctx.fillStyle = PALETTE.inkMid;
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.fillText('FLOODED DRAINAGE CULVERT [STEALTH BYPASS]', cz.x + 12, cz.y + 18);
        ctx.restore();
      }

      // Extraction threshold zone beyond Blast Gate
      if (level.extractionZone) {
        const ez = level.extractionZone;
        ctx.save();
        ctx.fillStyle = level.blastGateOpen ? 'rgba(62, 124, 89, 0.25)' : 'rgba(17, 30, 51, 0.08)';
        ctx.fillRect(ez.x, ez.y, ez.width, ez.height);
        ctx.strokeStyle = level.blastGateOpen ? '#2E6F4E' : PALETTE.inkMid;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(ez.x, ez.y, ez.width, ez.height);
        ctx.setLineDash([]);
        ctx.fillStyle = PALETTE.inkDeep;
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.fillText(
          level.blastGateOpen ? '>> EXTRACT: FACILITY SUB-ZERO <<' : 'BLAST GATE SEALED',
          ez.x + 12,
          ez.y + ez.height * 0.5
        );
        ctx.restore();
      }
    }

    _drawGroundZones(ctx, state) {
      if (!state.level) return;

      // Toxic Rafflesia Spore Zones (Soft radial crimson haze)
      const spores = state.level.sporeZones || [];
      for (let i = 0; i < spores.length; i++) {
        const sp = spores[i];
        const pulse = 1 + 0.06 * Math.sin(this.time * 3 + i);
        const r = sp.radius * pulse;
        ctx.save();
        const grad = ctx.createRadialGradient(sp.x, sp.y, r * 0.1, sp.x, sp.y, r);
        grad.addColorStop(0, 'rgba(248, 90, 90, 0.48)');
        grad.addColorStop(0.65, 'rgba(248, 90, 90, 0.22)');
        grad.addColorStop(1, 'rgba(248, 90, 90, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Ink Rafflesia flower petals in center
        ctx.strokeStyle = PALETTE.inkDeep;
        ctx.fillStyle = 'rgba(248, 90, 90, 0.65)';
        ctx.lineWidth = 1.6;
        for (let p = 0; p < 5; p++) {
          const ang = (p * Math.PI * 2) / 5 + 0.3;
          ctx.beginPath();
          ctx.ellipse(sp.x + Math.cos(ang) * 14, sp.y + Math.sin(ang) * 11, 10, 7, ang, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = PALETTE.inkMid;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Floodlights (Sector 2 & 4 - disabled if generator sabotaged)
      const lights = state.level.floodlights || [];
      for (let i = 0; i < lights.length; i++) {
        const fl = lights[i];
        if (!fl.active) continue;
        const sweepAngle = fl.baseAngle + Math.sin(this.time * (fl.sweepSpeed || 0.7) + i) * (fl.sweepArc || 0.35);
        ctx.save();
        ctx.translate(fl.x, fl.y);
        const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, fl.range);
        grad.addColorStop(0, 'rgba(255, 248, 220, 0.55)');
        grad.addColorStop(1, 'rgba(255, 248, 220, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, fl.range, sweepAngle - 0.32, sweepAngle + 0.32);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(17, 30, 51, 0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // Red Laser Tripwires (Sector 4)
      const lasers = state.level.tripwires || [];
      for (let i = 0; i < lasers.length; i++) {
        const lw = lasers[i];
        if (!lw.active) continue;
        ctx.save();
        ctx.strokeStyle = PALETTE.crimson;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = PALETTE.crimson;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(lw.x1, lw.y1);
        ctx.lineTo(lw.x2, lw.y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = PALETTE.inkDeep;
        ctx.fillRect(lw.x1 - 4, lw.y1 - 4, 8, 8);
        ctx.fillRect(lw.x2 - 4, lw.y2 - 4, 8, 8);
        ctx.restore();
      }
    }

    _drawVisionConesAndLasers(ctx, state) {
      const mercs = state.mercenaries || [];
      for (let i = 0; i < mercs.length; i++) {
        const m = mercs[i];
        if (m.dead) continue;
        const cx = m.x + m.width * 0.5;
        const cy = m.y + m.height * 0.65;
        const halfFov = ((m.fovDeg || 65) * Math.PI / 180) * 0.5;
        const range = m.visionRange || 260;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, range, m.facingAngle - halfFov, m.facingAngle + halfFov);
        ctx.closePath();

        if (m.state === 'ALERT') {
          ctx.fillStyle = 'rgba(248, 90, 90, 0.18)';
          ctx.strokeStyle = 'rgba(248, 90, 90, 0.45)';
        } else if (m.state === 'SUSPICIOUS') {
          ctx.fillStyle = 'rgba(248, 150, 90, 0.16)';
          ctx.strokeStyle = 'rgba(201, 50, 59, 0.38)';
        } else {
          ctx.fillStyle = 'rgba(17, 30, 51, 0.08)';
          ctx.strokeStyle = 'rgba(17, 30, 51, 0.22)';
        }
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Thin crimson rifle laser sight
        const laserLen = m.state === 'ALERT' ? range * 1.15 : range * 0.72;
        ctx.strokeStyle = m.state === 'ALERT' ? 'rgba(255, 32, 48, 0.85)' : 'rgba(248, 90, 90, 0.55)';
        ctx.lineWidth = m.state === 'ALERT' ? 1.8 : 1.1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 8);
        ctx.lineTo(cx + Math.cos(m.facingAngle) * laserLen, cy - 8 + Math.sin(m.facingAngle) * laserLen);
        ctx.stroke();
        ctx.restore();
      }
    }

    /**
     * Soft radial crimson telegraph matching Section 2.1 & 7.4 (feathered edge #F85A5A)
     */
    _drawTelegraphs(ctx, state) {
      const boars = state.boars || [];
      for (let i = 0; i < boars.length; i++) {
        const b = boars[i];
        if (b.dead) continue;
        if (b.state === 'TELEGRAPH' || b.state === 'CHARGE') {
          const cx = b.x + b.width * 0.5;
          const cy = b.y + b.height * 0.75;
          const progress = b.state === 'TELEGRAPH' ? Math.min(1, b.telegraphTimer / b.telegraphDuration) : 1;
          const maxRadius = b.telegraphRadius || 92;
          const radius = 26 + (maxRadius - 26) * progress;

          ctx.save();
          // Feathered radial crimson aura
          const grad = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius);
          grad.addColorStop(0, 'rgba(248, 90, 90, 0.52)');
          grad.addColorStop(0.6, 'rgba(248, 90, 90, 0.30)');
          grad.addColorStop(1, 'rgba(248, 90, 90, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(cx, cy, radius, radius * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();

          // Expanding outer crimson warning ring
          ctx.strokeStyle = 'rgba(248, 90, 90, 0.82)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, radius * 0.92, radius * 0.66, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Charge lane preview vector during telegraph
          if (b.state === 'TELEGRAPH') {
            ctx.strokeStyle = 'rgba(248, 90, 90, 0.55)';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 6]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + b.chargeDirX * 220, cy + b.chargeDirY * 220);
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.restore();
        }
      }
    }

    _drawAcousticRings(ctx, state) {
      const rings = state.acousticRings || [];
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        const alpha = Math.max(0, 1 - ring.age / ring.duration);
        const r = ring.maxRadius * (ring.age / ring.duration);
        ctx.save();
        ctx.strokeStyle = ring.color || `rgba(17, 30, 51, ${(alpha * 0.55).toFixed(3)})`;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.ellipse(ring.x, ring.y, r, r * 0.75, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    _drawPickupsAndInteractables(ctx, state) {
      if (!state.level) return;
      const items = state.level.interactables || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.collected) continue;
        const bob = Math.sin(this.time * 3.5 + i) * 3;
        ctx.save();
        ctx.translate(it.x, it.y + bob);

        // Ink shadow
        ctx.fillStyle = 'rgba(17, 30, 51, 0.16)';
        ctx.beginPath();
        ctx.ellipse(0, 12 - bob, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hand-drawn parchment tag / crate icon
        ctx.fillStyle = it.highlight ? '#FFE3E3' : PALETTE.paperWarm;
        ctx.strokeStyle = it.highlight ? PALETTE.crimsonDeep : PALETTE.inkDeep;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-14, -14, 28, 24, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = it.highlight ? PALETTE.crimsonDeep : PALETTE.inkDeep;
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(it.badge || 'ITEM', 0, 2);

        // Label below
        ctx.fillStyle = PALETTE.inkMid;
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.fillText(it.label || '', 0, -20);
        ctx.restore();
      }
    }

    _drawSlashEffects(ctx, state) {
      const slashes = state.slashEffects || [];
      for (let i = 0; i < slashes.length; i++) {
        const sl = slashes[i];
        const alpha = Math.max(0, 1 - sl.age / sl.duration);
        ctx.save();
        ctx.translate(sl.x, sl.y);
        ctx.rotate(sl.angle);
        ctx.strokeStyle = sl.isStealth
          ? `rgba(248, 90, 90, ${alpha.toFixed(3)})`
          : `rgba(17, 30, 51, ${alpha.toFixed(3)})`;
        ctx.lineWidth = sl.isStealth ? 7 : 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, sl.radius || 64, -0.95, 0.95);
        ctx.stroke();

        ctx.strokeStyle = `rgba(28, 40, 68, ${(alpha * 0.6).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, (sl.radius || 64) - 10, -0.75, 0.75);
        ctx.stroke();
        ctx.restore();
      }
    }

    _drawFloatingTexts(ctx, state) {
      const floats = state.floatingTexts || [];
      for (let i = 0; i < floats.length; i++) {
        const ft = floats[i];
        const alpha = Math.max(0, 1 - ft.age / ft.duration);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = ft.bold ? '900 22px "Georgia", serif' : 'bold 14px "Courier New", monospace';
        ctx.textAlign = 'center';
        // Parchment halo outline so numbers pop cleanly
        ctx.lineWidth = 4;
        ctx.strokeStyle = PALETTE.paperBase;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color || PALETTE.crimson;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }

    _drawRainOverlay(ctx, dt) {
      ctx.save();
      ctx.strokeStyle = 'rgba(28, 40, 68, 0.22)';
      ctx.lineWidth = 1.1;
      for (let i = 0; i < this.rainDrops.length; i++) {
        const d = this.rainDrops[i];
        d.x -= d.speed * 0.22 * dt;
        d.y += d.speed * dt;
        if (d.y > this.height + 20) {
          d.y = -20;
          d.x = Math.random() * (this.width + 200);
        }
        if (d.x < -20) {
          d.x = this.width + 20;
        }
        ctx.globalAlpha = d.alpha;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * 0.22, d.y + d.len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Renderer25D;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.Renderer25D = Renderer25D;
  global.BelumGame.PALETTE = PALETTE;
})(typeof window !== 'undefined' ? window : globalThis);
