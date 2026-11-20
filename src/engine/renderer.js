// src/engine/renderer.js - AAA 2.5D Oblique Dip-Pen Ink Canvas Renderer
// Features: Y-Sorting, Ink-Bleed Death Puddles, Mud Footprints, Dynamic Zoom, Blueprint Fog-of-War, Leaf Specks & Diegetic Calligraphy Badges
// Strictly Prussian Blue Ink (#111E33) on Aged Cream Paper (#F7F3E8) + Crimson (#F85A5A). ZERO pure RGB black.
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
      this.sprites = Object.create(null);
      this._initRain();
      this._loadPaperTexture();
      this._preloadWorldAndItemSprites();
    }

    _loadSprite(key, src) {
      if (typeof Image === 'undefined') return;
      const entry = { img: null, ready: false };
      this.sprites[key] = entry;
      const img = new Image();
      img.onload = () => {
        entry.img = img;
        entry.ready = true;
      };
      img.src = src;
    }

    _preloadWorldAndItemSprites() {
      this._loadSprite('rafflesia', 'assets/environment/mutated_rafflesia.png');
      this._loadSprite('keycard_pedestal', 'assets/buildings/keycard_pedestal.png');
      this._loadSprite('weapon_parang', 'assets/ui/items/parang.png');
      this._loadSprite('weapon_crossbow', 'assets/ui/items/crossbow.png');
      this._loadSprite('weapon_pistol', 'assets/ui/items/pistol_9mm.png');
      this._loadSprite('decoy_rocks', 'assets/ui/items/decoy_rocks.png');
      this._loadSprite('dirty_water', 'assets/ui/items/canteen.png');
      this._loadSprite('bamboo_shoots', 'assets/ui/items/bamboo_shoots.png');
      this._loadSprite('keycard', 'assets/ui/items/keycard.png');
      this._loadSprite('encrypted_drive', 'assets/ui/items/usb_drive.png');
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

      const cam = state.camera ? state.camera.getRenderOffset() : { x: 0, y: 0, zoom: 1 };
      const zoom = Number.isFinite(cam.zoom) ? cam.zoom : 1;

      // 1. Aged Cream Parchment Base
      ctx.save();
      ctx.fillStyle = PALETTE.paperBase;
      ctx.fillRect(0, 0, this.width, this.height);

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

      // World-space transform with AAA Spring Camera Dynamic Zoom
      ctx.save();
      ctx.translate(this.width * 0.5, this.height * 0.5);
      ctx.scale(zoom, zoom);
      ctx.translate(-this.width * 0.5 - cam.x, -this.height * 0.5 - cam.y);

      // 2. Ground Sectors, Riverbank Water, Paths, Floorboards & Concrete
      if (state.level) {
        this._drawTerrain(ctx, state.level, cam);
      }

      // 3. Persistent Ground Stains & Environmental Traces:
      //    Wet Mud Footprints -> Blood Drips -> Organic Fountain-Pen Ink-Bleed Death Puddles
      this._drawFootprints(ctx, state);
      this._drawBloodDrips(ctx, state);
      this._drawInkPuddles(ctx, state);

      // 4. Ground Layer Effects: Spores, Floodlights, Vision Cones, Drone Cones, Telegraphs, Acoustic Rings, Tripwires
      this._drawGroundZones(ctx, state);
      this._drawVisionConesAndLasers(ctx, state);
      if (Array.isArray(state.drones)) {
        for (let i = 0; i < state.drones.length; i++) {
          if (typeof state.drones[i].drawCone === 'function') state.drones[i].drawCone(ctx);
        }
      }
      this._drawTelegraphs(ctx, state);
      this._drawAcousticRings(ctx, state);
      this._drawImprovisedGear(ctx, state);
      this._drawPickupsAndInteractables(ctx, state);

      // 5. 2.5D Y-SORTING DEPTH PASS
      const drawables = [];
      if (state.level && Array.isArray(state.level.obstacles)) {
        for (let i = 0; i < state.level.obstacles.length; i++) {
          const obs = state.level.obstacles[i];
          if (this._isVisible(obs.x, obs.y, obs.width || 120, obs.height || 120, cam)) {
            drawables.push(obs);
          }
        }
      }
      if (state.player) drawables.push(state.player);
      if (Array.isArray(state.mercenaries)) {
        for (let i = 0; i < state.mercenaries.length; i++) drawables.push(state.mercenaries[i]);
      }
      if (Array.isArray(state.boars)) {
        for (let i = 0; i < state.boars.length; i++) drawables.push(state.boars[i]);
      }
      if (Array.isArray(state.drones)) {
        for (let i = 0; i < state.drones.length; i++) drawables.push(state.drones[i]);
      }
      if (Array.isArray(state.projectiles)) {
        for (let i = 0; i < state.projectiles.length; i++) drawables.push(state.projectiles[i]);
      }

      Renderer25D.sortByDepth(drawables);
      for (let i = 0; i < drawables.length; i++) {
        const entity = drawables[i];
        if (typeof entity.draw === 'function') {
          entity.draw(ctx, this.time);
        }
      }

      // 6. Dynamic Blueprint Fog-of-War Hatching behind concrete bunker walls
      this._drawBlueprintFogOfWar(ctx, state);

      // 7. Fluttering Ink Leaf Specks, Slash Arcs, Hold-E Progress Ring, Diegetic Badges & Floating Damage Numbers
      this._drawLeafParticles(ctx, state);
      this._drawSlashEffects(ctx, state);
      this._drawHoldActionRing(ctx, state);
      this._drawDiegeticBadge(ctx, state);
      this._drawFloatingTexts(ctx, state);

      ctx.restore(); // End world-space

      // 8. Screen-space Tropical Rain & Low-Health Crimson Pulse
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
      const margin = 240;
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

    /**
     * AAA Organic "Fountain Pen Ink-Bleed" Death Puddles (#111E33)
     * 3 overlapping feathered organic ellipses expanding smoothly into parchment grain over 2.4 seconds
     */
    _drawInkPuddles(ctx, state) {
      const puddles = state.inkPuddles || [];
      for (let i = 0; i < puddles.length; i++) {
        const p = puddles[i];
        const t = Math.min(1, p.age / (p.growDuration || 2.4));
        // Smooth ease-out bleed curve
        const ease = 1 - Math.pow(1 - t, 3);
        const lobes = p.lobes || [];

        ctx.save();
        ctx.translate(p.x, p.y);

        // Soft outer paper-seepage halo
        const haloR = (p.baseRadius || 32) * (0.45 + 0.72 * ease);
        const grad = ctx.createRadialGradient(0, 0, haloR * 0.2, 0, 0, haloR * 1.25);
        grad.addColorStop(0, 'rgba(17, 30, 51, 0.42)');
        grad.addColorStop(0.68, 'rgba(28, 40, 68, 0.24)');
        grad.addColorStop(1, 'rgba(17, 30, 51, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, haloR * 1.25, haloR * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3 overlapping organic Prussian Blue ink ellipses
        for (let l = 0; l < lobes.length; l++) {
          const lobe = lobes[l];
          const rx = lobe.rx * (0.25 + 0.75 * ease);
          const ry = lobe.ry * (0.25 + 0.75 * ease);
          const ox = lobe.ox * ease;
          const oy = lobe.oy * ease;
          ctx.fillStyle = l === 0 ? 'rgba(17, 30, 51, 0.62)' : 'rgba(28, 40, 68, 0.45)';
          ctx.beginPath();
          ctx.ellipse(ox, oy, rx, ry, lobe.rot, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    /**
     * AAA Wet Mud Footprints (persist 4.5s along Sungai Belum Riverbank & Infected Ravine)
     */
    _drawFootprints(ctx, state) {
      const prints = state.footprints || [];
      for (let i = 0; i < prints.length; i++) {
        const fp = prints[i];
        const alpha = Math.max(0, 1 - fp.age / fp.duration) * 0.42;
        ctx.save();
        ctx.translate(fp.x, fp.y);
        ctx.rotate(fp.angle || 0);
        ctx.fillStyle = `rgba(17, 30, 51, ${alpha.toFixed(3)})`;
        // Sole + heel boot print
        ctx.beginPath();
        ctx.ellipse(3, 0, 5.2, 2.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-4, 0, 2.6, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    /**
     * AAA Fluttering Ink Leaf Specks spawned when brushing through ferns & bamboo
     */
    _drawLeafParticles(ctx, state) {
      const leaves = state.leafParticles || [];
      for (let i = 0; i < leaves.length; i++) {
        const lf = leaves[i];
        const alpha = Math.max(0, 1 - lf.age / lf.duration);
        ctx.save();
        ctx.translate(lf.x, lf.y);
        ctx.rotate(lf.rot);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#2E4062';
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    /**
     * AAA Dynamic Fog-of-War Blueprint Hatching
     * Diagonal Prussian blue blueprint hatching over occluded bunker interior / unseen extraction bay
     */
    _drawBlueprintFogOfWar(ctx, state) {
      if (!state.level || !state.player) return;
      const p = state.player;
      const zones = [
        // Sector 4 interior behind Blast Gate (reveals as gate opens or player enters culvert/gate)
        {
          x: 3915,
          y: 265,
          w: 270,
          h: 820,
          revealed: state.level.blastGateOpen || p.centerX > 3820
        },
        // Sector 2 Barracks interior shadow hatch until player approaches closely
        {
          x: 1140,
          y: 210,
          w: 280,
          h: 150,
          revealed: Math.hypot(p.centerX - 1280, p.centerY - 360) < 190
        },
        // Sector 2 Field Lab shadow hatch until player approaches
        {
          x: 1580,
          y: 195,
          w: 250,
          h: 150,
          revealed: Math.hypot(p.centerX - 1705, p.centerY - 350) < 190
        }
      ];

      for (let z = 0; z < zones.length; z++) {
        const fz = zones[z];
        if (fz.revealed) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(fz.x, fz.y, fz.w, fz.h);
        ctx.clip();
        ctx.fillStyle = 'rgba(28, 40, 68, 0.14)';
        ctx.fillRect(fz.x, fz.y, fz.w, fz.h);
        ctx.strokeStyle = 'rgba(17, 30, 51, 0.28)';
        ctx.lineWidth = 1.2;
        const step = 14;
        for (let d = -fz.h; d < fz.w + fz.h; d += step) {
          ctx.beginPath();
          ctx.moveTo(fz.x + d, fz.y);
          ctx.lineTo(fz.x + d - fz.h, fz.y + fz.h);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    _drawBloodDrips(ctx, state) {
      const drips = state.bloodDrips || [];
      if (drips.length === 0) return;
      ctx.save();
      for (let i = 0; i < drips.length; i++) {
        const d = drips[i];
        const alpha = Math.max(0.12, 1 - d.age / (d.duration || 14));
        ctx.fillStyle = `rgba(248, 90, 90, ${(alpha * 0.85).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, 4.2, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(17, 30, 51, ${(alpha * 0.45).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(d.x + 2, d.y + 1, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    _drawImprovisedGear(ctx, state) {
      // Placed Tripwire Flares (Task 6d)
      const flares = state.placedTripwireFlares || [];
      if (flares.length > 0) {
        ctx.save();
        for (let i = 0; i < flares.length; i++) {
          const fl = flares[i];
          if (!fl.active) continue;
          ctx.strokeStyle = 'rgba(248, 90, 90, 0.72)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(fl.x - 28, fl.y);
          ctx.lineTo(fl.x + 28, fl.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#F85A5A';
          ctx.strokeStyle = '#111E33';
          ctx.lineWidth = 1.4;
          ctx.fillRect(fl.x - 5, fl.y - 3, 10, 6);
          ctx.strokeRect(fl.x - 5, fl.y - 3, 10, 6);
        }
        ctx.restore();
      }

      // Placed Radio Jammers (Task 6d)
      const jammers = state.placedJammers || [];
      if (jammers.length > 0) {
        ctx.save();
        for (let i = 0; i < jammers.length; i++) {
          const jm = jammers[i];
          const pulse = (this.time * 1.4 + i) % 1;
          ctx.strokeStyle = `rgba(17, 30, 51, ${((1 - pulse) * 0.45).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(jm.x, jm.y, 20 + pulse * (jm.radius || 320) * 0.35, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#1C2844';
          ctx.fillRect(jm.x - 7, jm.y - 5, 14, 10);
          ctx.fillStyle = '#F85A5A';
          ctx.beginPath();
          ctx.arc(jm.x, jm.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Diesel Smoke Rag Clouds (Task 6d: 6s vision-blocking ink haze)
      const clouds = state.smokeClouds || [];
      if (clouds.length > 0) {
        ctx.save();
        for (let i = 0; i < clouds.length; i++) {
          const sc = clouds[i];
          const fade = Math.min(1, sc.ttl / 1.2);
          ctx.fillStyle = `rgba(28, 40, 68, ${(0.34 * fade).toFixed(3)})`;
          ctx.strokeStyle = `rgba(17, 30, 51, ${(0.55 * fade).toFixed(3)})`;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(sc.x, sc.y, sc.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Swirling inner ink puffs
          for (let k = 0; k < 4; k++) {
            const a = this.time * 0.9 + k * 1.57;
            ctx.beginPath();
            ctx.arc(sc.x + Math.cos(a) * sc.radius * 0.35, sc.y + Math.sin(a) * sc.radius * 0.28, sc.radius * 0.42, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    /**
     * AAA Diegetic Calligraphy Action Badge floating directly above nearby interactable / takedown target (75px)
     */
    _drawDiegeticBadge(ctx, state) {
      const badge = state.diegeticBadge;
      if (!badge || !badge.text) return;

      const bob = Math.sin(this.time * 5.2) * 3;
      const bx = badge.x;
      const by = badge.y - (badge.urgent ? 64 : 44) + bob;

      ctx.save();
      ctx.font = 'bold 11px "Courier New", monospace';
      const tw = ctx.measureText(badge.text).width;
      const padX = 10;
      const w = tw + padX * 2;
      const h = 24;

      // Calligraphic parchment ribbon
      ctx.fillStyle = badge.urgent ? '#111E33' : '#F7F3E8';
      ctx.strokeStyle = badge.urgent ? '#F85A5A' : '#111E33';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx - w * 0.5, by - h * 0.5, w, h, 4);
      ctx.fill();
      ctx.stroke();

      // Pointer nib beneath badge
      ctx.beginPath();
      ctx.moveTo(bx - 5, by + h * 0.5);
      ctx.lineTo(bx, by + h * 0.5 + 6);
      ctx.lineTo(bx + 5, by + h * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = badge.urgent ? '#F7F3E8' : '#111E33';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badge.text, bx, by + 0.5);
      ctx.restore();
    }

    _seededWave(v, seed) {
      return (
        Math.sin(v * 0.0072 + seed * 1.7) * 15 +
        Math.sin(v * 0.0195 + seed * 3.1) * 7.5 +
        Math.cos(v * 0.041 + seed * 0.9) * 3.2
      );
    }

    _ensureTerrainGeometry(level) {
      if (this._terrainCache && this._terrainCache.levelRef === level) {
        return this._terrainCache;
      }
      const cache = { levelRef: level, riverBank: [], trailTop: [], trailBot: [], trailHatches: [] };

      // 1. Irregular hand-inked Sungai Belum riverbank (fixed seed, zero shimmer)
      if (level.riverZone) {
        const rz = level.riverZone;
        const step = 28;
        for (let y = rz.y; y <= rz.y + rz.height; y += step) {
          const offset =
            Math.sin(y * 0.0085 + 0.7) * 15 +
            Math.sin(y * 0.024 + 2.1) * 7 +
            Math.cos(y * 0.052 + 0.4) * 2.5;
          cache.riverBank.push({ x: rz.x + rz.width + offset, y });
        }
        if (cache.riverBank[cache.riverBank.length - 1].y < rz.y + rz.height) {
          cache.riverBank.push({ x: rz.x + rz.width + 4, y: rz.y + rz.height });
        }
      }

      // 2. Connected winding diagonal trail spanning all path bands smoothly
      if (Array.isArray(level.paths) && level.paths.length > 0) {
        const paths = level.paths;
        const minX = paths[0].x;
        const lastP = paths[paths.length - 1];
        const maxX = lastP.x + lastP.width;
        const step = 36;

        // Smoothly interpolate top & bottom Y across sector path bands with diagonal transitions
        const sampleBand = (x) => {
          let idx = 0;
          for (let i = 0; i < paths.length; i++) {
            if (x >= paths[i].x) idx = i;
          }
          const cur = paths[idx];
          const next = paths[Math.min(paths.length - 1, idx + 1)];
          const blendZone = 240;
          let t = 0;
          const distToEnd = (cur.x + cur.width) - x;
          if (idx < paths.length - 1 && distToEnd < blendZone) {
            const u = Math.max(0, Math.min(1, 1 - distToEnd / blendZone));
            t = u * u * (3 - 2 * u); // smoothstep diagonal join
          }
          const baseTop = cur.y * (1 - t) + next.y * t;
          const baseBot = (cur.y + cur.height) * (1 - t) + (next.y + next.height) * t;
          // Gentle diagonal macro-meander across the rainforest
          const slant = Math.sin(x * 0.0024 + 0.45) * 28;
          return {
            top: baseTop + slant + this._seededWave(x, 1.3),
            bot: baseBot + slant + this._seededWave(x, 4.7)
          };
        };

        for (let x = minX; x <= maxX; x += step) {
          const b = sampleBand(x);
          cache.trailTop.push({ x, y: b.top });
          cache.trailBot.push({ x, y: b.bot });
        }
        if (cache.trailTop[cache.trailTop.length - 1].x < maxX) {
          const b = sampleBand(maxX);
          cache.trailTop.push({ x: maxX, y: b.top });
          cache.trailBot.push({ x: maxX, y: b.bot });
        }

        // Precompute subtle dip-pen hatching ticks along top & bottom trail edges
        for (let i = 0; i < cache.trailTop.length; i++) {
          const pt = cache.trailTop[i];
          const pb = cache.trailBot[i];
          const lenT = 6 + ((i * 7) % 6);
          const lenB = 6 + ((i * 11) % 6);
          cache.trailHatches.push({ x1: pt.x, y1: pt.y, x2: pt.x - 5, y2: pt.y - lenT });
          cache.trailHatches.push({ x1: pb.x, y1: pb.y, x2: pb.x + 5, y2: pb.y + lenB });
        }
      }

      this._terrainCache = cache;
      return cache;
    }

    _drawTerrain(ctx, level, cam) {
      const geom = this._ensureTerrainGeometry(level);
      const sectors = level.sectors || [];
      for (let i = 0; i < sectors.length; i++) {
        const s = sectors[i];
        if (!this._isVisible(s.x, s.y, s.width, s.height, cam)) continue;

        ctx.save();
        ctx.fillStyle = s.groundTint || PALETTE.paperWarm;
        ctx.fillRect(s.x, s.y, s.width, s.height);

        ctx.strokeStyle = 'rgba(17, 30, 51, 0.14)';
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 1.4;
        ctx.strokeRect(s.x, s.y, s.width, s.height);
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(17, 30, 51, 0.14)';
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.fillText(s.label || '', s.x + 24, s.y + 34);
        ctx.restore();
      }

      // Phase C: Winding diagonal jungle trail polygon with 1.8px dip-pen ink banks & light hatching
      if (geom.trailTop.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(geom.trailTop[0].x, geom.trailTop[0].y);
        for (let i = 1; i < geom.trailTop.length; i++) {
          ctx.lineTo(geom.trailTop[i].x, geom.trailTop[i].y);
        }
        for (let i = geom.trailBot.length - 1; i >= 0; i--) {
          ctx.lineTo(geom.trailBot[i].x, geom.trailBot[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(208, 192, 160, 0.42)';
        ctx.fill();

        // Subtle inner wagon-rut / foot-track contour lines
        ctx.strokeStyle = 'rgba(17, 30, 51, 0.12)';
        ctx.lineWidth = 1.1;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        for (let i = 0; i < geom.trailTop.length; i++) {
          const midY = geom.trailTop[i].y * 0.62 + geom.trailBot[i].y * 0.38;
          if (i === 0) ctx.moveTo(geom.trailTop[i].x, midY);
          else ctx.lineTo(geom.trailTop[i].x, midY);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Hand-inked top and bottom trail borders (1.8px Prussian Blue)
        ctx.strokeStyle = 'rgba(17, 30, 51, 0.56)';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(geom.trailTop[0].x, geom.trailTop[0].y);
        for (let i = 1; i < geom.trailTop.length; i++) {
          ctx.lineTo(geom.trailTop[i].x, geom.trailTop[i].y);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(geom.trailBot[0].x, geom.trailBot[0].y);
        for (let i = 1; i < geom.trailBot.length; i++) {
          ctx.lineTo(geom.trailBot[i].x, geom.trailBot[i].y);
        }
        ctx.stroke();

        // Light diagonal edge hatching along trail banks
        ctx.strokeStyle = 'rgba(17, 30, 51, 0.28)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let i = 0; i < geom.trailHatches.length; i++) {
          const h = geom.trailHatches[i];
          ctx.moveTo(h.x1, h.y1);
          ctx.lineTo(h.x2, h.y2);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Phase C: Organic hand-inked Sungai Belum riverbank with irregular edge & bank hatching
      if (level.riverZone && geom.riverBank.length > 1) {
        const rz = level.riverZone;
        if (this._isVisible(rz.x, rz.y, rz.width + 40, rz.height, cam)) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(rz.x, rz.y);
          for (let i = 0; i < geom.riverBank.length; i++) {
            ctx.lineTo(geom.riverBank[i].x, geom.riverBank[i].y);
          }
          ctx.lineTo(rz.x, rz.y + rz.height);
          ctx.closePath();
          ctx.fillStyle = PALETTE.waterTint;
          ctx.fill();

          // Clip animated water ripples cleanly inside organic bank silhouette
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = 'rgba(17, 30, 51, 0.34)';
          ctx.lineWidth = 1.4;
          for (let y = rz.y + 20; y < rz.y + rz.height; y += 34) {
            const wave = Math.sin(this.time * 2.2 + y * 0.04) * 9;
            ctx.beginPath();
            ctx.moveTo(rz.x + 12, y);
            ctx.quadraticCurveTo(rz.x + rz.width * 0.5 + wave, y + 8, rz.x + rz.width + 6, y - 3);
            ctx.stroke();
          }
          ctx.restore();

          // Crisp 2.2px irregular hand-inked bank line
          ctx.strokeStyle = PALETTE.inkDeep;
          ctx.lineWidth = 2.2;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(geom.riverBank[0].x, geom.riverBank[0].y);
          for (let i = 1; i < geom.riverBank.length; i++) {
            ctx.lineTo(geom.riverBank[i].x, geom.riverBank[i].y);
          }
          ctx.stroke();

          // Bank-side dip-pen mud hatching along dry edge
          ctx.strokeStyle = 'rgba(17, 30, 51, 0.34)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let i = 0; i < geom.riverBank.length; i++) {
            const pt = geom.riverBank[i];
            const len = 8 + ((i * 5) % 6);
            ctx.moveTo(pt.x, pt.y);
            ctx.lineTo(pt.x + len, pt.y + 5);
          }
          ctx.stroke();
          ctx.restore();
        }
      }

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

        const raf = this.sprites && this.sprites.rafflesia;
        if (raf && raf.ready && raf.img) {
          ctx.drawImage(raf.img, sp.x - 42, sp.y - 38, 84, 75);
        } else {
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
        }
        ctx.restore();
      }

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
          const grad = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius);
          grad.addColorStop(0, 'rgba(248, 90, 90, 0.52)');
          grad.addColorStop(0.6, 'rgba(248, 90, 90, 0.30)');
          grad.addColorStop(1, 'rgba(248, 90, 90, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(cx, cy, radius, radius * 0.72, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(248, 90, 90, 0.82)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, radius * 0.92, radius * 0.66, 0, 0, Math.PI * 2);
          ctx.stroke();

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
        const dist = state.player
          ? Math.hypot(it.x - state.player.centerX, it.y - state.player.centerY)
          : Infinity;

        // Bespoke 2.5D Biometric Keycard Terminal Pedestal (world prop visible, label <= 120 px only)
        if (it.type === 'blast_terminal') {
          const ped = this.sprites && this.sprites.keycard_pedestal;
          ctx.save();
          if (ped && ped.ready && ped.img) {
            ctx.drawImage(ped.img, it.x - 26, it.y - 52, 52, 76);
            // Pulsing crimson biometric scanner line
            const pulse = 0.55 + 0.45 * Math.sin(this.time * 5);
            ctx.fillStyle = `rgba(248, 90, 90, ${pulse.toFixed(3)})`;
            ctx.fillRect(it.x - 9, it.y - 22, 18, 3);
            if (dist <= 120) {
              ctx.fillStyle = PALETTE.inkMid;
              ctx.font = 'bold 10px "Courier New", monospace';
              ctx.textAlign = 'center';
              ctx.fillText(it.label || '', it.x, it.y - 58);
            }
            ctx.restore();
            continue;
          }
          ctx.restore();
        }

        // Fix 4: Beyond 220 px draw nothing; 120..220 px draw only a small ink sparkle; <= 120 px draw badge & label
        if (dist > 220) continue;

        if (dist > 120) {
          const glint = 0.45 + 0.55 * Math.abs(Math.sin(this.time * 3.2 + i * 1.7));
          const r = 4.5 + glint * 2.5;
          ctx.save();
          ctx.translate(it.x, it.y - 4);
          ctx.strokeStyle = `rgba(17, 30, 51, ${(0.35 + glint * 0.45).toFixed(3)})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
          ctx.moveTo(0, -r); ctx.lineTo(0, r);
          ctx.stroke();
          ctx.fillStyle = it.highlight ? `rgba(248, 90, 90, ${(0.45 + glint * 0.4).toFixed(3)})` : `rgba(17, 30, 51, ${(0.45 + glint * 0.4).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        const bob = Math.sin(this.time * 3.5 + i) * 3;
        const iconEntry = this.sprites && this.sprites[it.type];

        ctx.save();
        ctx.translate(it.x, it.y + bob);

        ctx.fillStyle = 'rgba(17, 30, 51, 0.16)';
        ctx.beginPath();
        ctx.ellipse(0, 14 - bob, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        if (iconEntry && iconEntry.ready && iconEntry.img) {
          // Crisp hand-drawn circular parchment medallion with 64x64 transparent ink item icon
          ctx.fillStyle = it.highlight ? '#FFF0EE' : PALETTE.paperWarm;
          ctx.strokeStyle = it.highlight ? PALETTE.crimsonDeep : PALETTE.inkDeep;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, -2, 19, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.drawImage(iconEntry.img, -16, -18, 32, 32);

          ctx.fillStyle = PALETTE.inkMid;
          ctx.font = 'bold 10px "Courier New", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(it.label || '', 0, -26);
        } else {
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

          ctx.fillStyle = PALETTE.inkMid;
          ctx.font = 'bold 10px "Courier New", monospace';
          ctx.fillText(it.label || '', 0, -20);
        }
        ctx.restore();
      }

      // Fix 4: Hidden Basha Sites show NO label and NO marker until discovered (within 150 px).
      // After discovery, show a small tarp-shelter icon with NO text from any distance.
      // TODO: replace icon with assets/ui/status_icons_sheet.png icon 8 (tarp shelter)
      const bashaSites = (state.level && state.level.bashaSites) || [];
      for (let i = 0; i < bashaSites.length; i++) {
        const site = bashaSites[i];
        if (!site.discovered) continue;
        ctx.save();
        ctx.translate(site.x, site.y - 44);
        ctx.fillStyle = PALETTE.paperBase;
        ctx.strokeStyle = PALETTE.inkDeep;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Sloped tarp-shelter silhouette (no text)
        ctx.fillStyle = '#E6DAC0';
        ctx.beginPath();
        ctx.moveTo(-9, 5);
        ctx.lineTo(-1, -6);
        ctx.lineTo(9, -2);
        ctx.lineTo(7, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-1, -6);
        ctx.lineTo(0, 6);
        ctx.stroke();
        ctx.fillStyle = PALETTE.crimson;
        ctx.beginPath();
        ctx.arc(4, 3, 1.6, 0, Math.PI * 2);
        ctx.fill();
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

    _drawHoldActionRing(ctx, state) {
      const ha = state.holdAction;
      if (!ha || !Number.isFinite(ha.x) || !Number.isFinite(ha.y)) return;
      const pct = Math.max(0, Math.min(1, ha.duration > 0 ? ha.elapsed / ha.duration : 0));
      ctx.save();
      ctx.translate(ha.x, ha.y - 44);
      ctx.fillStyle = 'rgba(247, 243, 232, 0.92)';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(17, 30, 51, 0.28)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = ha.type === 'takedown' ? PALETTE.crimson : PALETTE.inkDeep;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 15, -Math.PI * 0.5, -Math.PI * 0.5 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.inkDeep;
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('E', 0, 4);
      if (ha.label) {
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.lineWidth = 3;
        ctx.strokeStyle = PALETTE.paperBase;
        ctx.strokeText(ha.label, 0, -24);
        ctx.fillStyle = PALETTE.inkDeep;
        ctx.fillText(ha.label, 0, -24);
      }
      ctx.restore();
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
