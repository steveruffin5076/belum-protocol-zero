// src/world/obstacles.js - 2.5D Oblique Obstacles, Cover Props (Hollow Logs, Ferns, Bamboo, Blast Gate)
(function (global) {
  'use strict';

  const propImageCache = Object.create(null);

  function loadPropSprite(src) {
    if (typeof Image === 'undefined') return null;
    if (propImageCache[src]) return propImageCache[src];
    const entry = { img: null, ready: false };
    propImageCache[src] = entry;
    const img = new Image();
    img.onload = () => {
      const keyFn = global.BelumGame && global.BelumGame.keyExteriorParchment;
      entry.img = keyFn ? keyFn(img) : img;
      entry.ready = true;
    };
    img.src = src;
    return entry;
  }

  class Obstacle25D {
    constructor(opts) {
      const cfg = opts || {};
      this.id = cfg.id || `obs_${Math.random().toString(36).slice(2, 7)}`;
      this.type = cfg.type || 'tree';
      // Types: 'hollow_log' | 'fern' | 'bamboo' | 'tree' | 'barracks' | 'fence' | 'bunker_wall' | 'culvert_grate' | 'blast_gate'
      this.x = Number.isFinite(cfg.x) ? cfg.x : 0;
      this.y = Number.isFinite(cfg.y) ? cfg.y : 0;
      this.width = Number.isFinite(cfg.width) ? cfg.width : 100;
      this.height = Number.isFinite(cfg.height) ? cfg.height : 80;

      // Footprint collision box (lower portion of 2.5D prop for realistic oblique overlap)
      this.solid = cfg.solid !== undefined ? cfg.solid : this.type !== 'fern';
      this.blocksVision = cfg.blocksVision !== undefined
        ? cfg.blocksVision
        : !['fern', 'fence', 'culvert_grate'].includes(this.type);
      this.blocksProjectiles = cfg.blocksProjectiles !== undefined
        ? cfg.blocksProjectiles
        : !['fern', 'fence'].includes(this.type);

      this.colX = cfg.colX !== undefined ? cfg.colX : this.x + 8;
      this.colY = cfg.colY !== undefined ? cfg.colY : this.y + this.height * 0.48;
      this.colW = cfg.colW !== undefined ? cfg.colW : Math.max(16, this.width - 16);
      this.colH = cfg.colH !== undefined ? cfg.colH : Math.max(16, this.height * 0.48);

      this.label = cfg.label || '';
      this.unlocked = false;
      this.openProgress = 0; // For blast_gate sliding open (0..1)

      // Foliage Rustle & Plant Physics (±6px shear at 8Hz damped over 0.4s)
      this.rustleTimer = 0;
      this.rustleDuration = 0.4;
      this.rustleDir = 1;

      // Link isolated hand-inked PNG sprites (Task A Environment & Architecture Pack)
      if (this.type === 'hollow_log') this.spriteEntry = loadPropSprite('assets/environment/hollow_log.png');
      else if (this.type === 'fern') this.spriteEntry = loadPropSprite('assets/environment/fern_clump.png');
      else if (this.type === 'bamboo') this.spriteEntry = loadPropSprite('assets/environment/bamboo_cluster.png');
      else if (this.type === 'canopy_tree') this.spriteEntry = loadPropSprite('assets/environment/ancient_canopy_tree.png');
      else if (this.type === 'mud_rocks') this.spriteEntry = loadPropSprite('assets/environment/riverbank_mud_rocks.png');
      else if (this.type === 'barracks') this.spriteEntry = loadPropSprite('assets/buildings/logging_barracks.png');
      else if (this.type === 'generator_shed') this.spriteEntry = loadPropSprite('assets/buildings/generator_shed.png');
      else if (this.type === 'culvert_grate') this.spriteEntry = loadPropSprite('assets/buildings/culvert_grate.png');
      else if (this.type === 'blast_gate') this.spriteEntry = loadPropSprite('assets/buildings/blast_bunker_door.png');
      else this.spriteEntry = null;
    }

    triggerRustle(dir) {
      if (this.type !== 'fern' && this.type !== 'bamboo') return false;
      if (this.rustleTimer > 0.24) return false;
      this.rustleTimer = this.rustleDuration;
      this.rustleDir = dir ? Math.sign(dir) : 1;
      return true;
    }

    update(dt) {
      if (this.rustleTimer > 0) {
        this.rustleTimer = Math.max(0, this.rustleTimer - (dt || 0.016));
      }
    }

    get sortY() {
      if (this.type === 'fern') {
        return this.y + this.height * 0.85;
      }
      return this.y + this.height;
    }

    draw(ctx, time) {
      if (!ctx) return;
      ctx.save();

      if (this.type === 'blast_gate') {
        this._drawBlastGate(ctx, time);
        ctx.restore();
        return;
      }

      if (this.type === 'culvert_grate') {
        this._drawCulvertGrate(ctx);
        ctx.restore();
        return;
      }

      // Apply AAA Foliage Rustle shear (±6px oscillation at 8Hz damped over 0.4s)
      if (this.rustleTimer > 0 && (this.type === 'fern' || this.type === 'bamboo')) {
        const elapsed = this.rustleDuration - this.rustleTimer;
        const damping = this.rustleTimer / this.rustleDuration;
        const swayPx = Math.sin(elapsed * Math.PI * 2 * 8) * 6 * damping * this.rustleDir;
        const pivotX = this.x + this.width * 0.5;
        const pivotY = this.y + this.height;
        ctx.translate(pivotX, pivotY);
        ctx.transform(1, 0, swayPx / Math.max(40, this.height), 1, 0, 0);
        ctx.translate(-pivotX, -pivotY);
      }

      // Draw generated hand-inked PNG prop or building if ready
      if (this.spriteEntry && this.spriteEntry.ready && this.spriteEntry.img) {
        if (this.type === 'fern') {
          ctx.globalAlpha = 0.92;
        }
        const padX = (this.type === 'barracks' || this.type === 'generator_shed') ? 16 : 10;
        const padTop = this.type === 'canopy_tree' ? 28 : (this.type === 'barracks' || this.type === 'generator_shed' ? 24 : 10);
        const padBot = 10;
        ctx.drawImage(
          this.spriteEntry.img,
          this.x - padX,
          this.y - padTop,
          this.width + padX * 2,
          this.height + padTop + padBot
        );

        if (this.type === 'fern') {
          // Subtle dashed stealth hint outline on forest floor
          ctx.strokeStyle = 'rgba(62, 124, 89, 0.34)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.ellipse(this.x + this.width * 0.5, this.y + this.height * 0.72, this.width * 0.44, this.height * 0.28, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (this.type === 'generator_shed') {
          // Faint rising ink exhaust smoke puffs from diesel pipe
          const t = time || 0;
          for (let s = 0; s < 3; s++) {
            const phase = (t * 0.85 + s * 0.33) % 1;
            const sx = this.x + this.width * 0.22 + Math.sin(t * 2 + s) * 6;
            const sy = this.y - 16 - phase * 34;
            const r = 5 + phase * 9;
            ctx.strokeStyle = `rgba(28, 40, 68, ${((1 - phase) * 0.36).toFixed(3)})`;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        if (this.label) {
          this._drawStructureStamp(ctx, this.x + this.width * 0.5, this.y + this.height + 10, this.label);
        }
        ctx.restore();
        return;
      }

      // Crisp Prussian Blue dip-pen etched procedural structures & fallbacks
      if (this.type === 'sector_gate') {
        this._drawSectorGate(ctx);
      } else if (this.type === 'fishing_hut') {
        this._drawFishingHut(ctx);
      } else if (this.type === 'radio_truck') {
        this._drawRadioTruck(ctx);
      } else if (this.type === 'guard_tower') {
        this._drawGuardTower(ctx);
      } else if (this.type === 'basha_site') {
        this._drawBashaSite(ctx, time);
      } else if (this.type === 'barracks' || this.type === 'generator_shed') {
        this._drawBarracks(ctx);
      } else if (this.type === 'bunker_wall') {
        this._drawBunkerWall(ctx);
      } else if (this.type === 'fence') {
        this._drawFence(ctx);
      } else if (this.type === 'hollow_log') {
        this._drawFallbackLog(ctx);
      } else if (this.type === 'fern') {
        this._drawFallbackFern(ctx);
      } else {
        this._drawInkTree(ctx);
      }

      if (this.label && ['sector_gate', 'fishing_hut', 'radio_truck', 'guard_tower', 'basha_site'].includes(this.type)) {
        this._drawStructureStamp(ctx, this.x + this.width * 0.5, this.y + this.height + 10, this.label);
      }

      ctx.restore();
    }

    _drawSectorGate(ctx) {
      if (this.unlocked) {
        ctx.strokeStyle = 'rgba(17, 30, 51, 0.35)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.setLineDash([]);
        return;
      }
      ctx.fillStyle = 'rgba(214, 198, 166, 0.72)';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.4;
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.strokeRect(this.x, this.y, this.width, this.height);
      // Chain-link cross-hatching
      ctx.strokeStyle = 'rgba(17, 30, 51, 0.55)';
      ctx.lineWidth = 1.2;
      for (let y = this.y + 12; y < this.y + this.height; y += 16) {
        ctx.beginPath();
        ctx.moveTo(this.x + 2, y);
        ctx.lineTo(this.x + this.width - 2, y - 10);
        ctx.moveTo(this.x + 2, y - 10);
        ctx.lineTo(this.x + this.width - 2, y);
        ctx.stroke();
      }
      // Padlock crimson dot
      ctx.fillStyle = '#F85A5A';
      ctx.beginPath();
      ctx.arc(this.x + this.width * 0.5, this.y + this.height * 0.5, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // TODO: replace with assets/environment/fishing_boat_locker.png (Task 5)
    _drawFishingHut(ctx) {
      ctx.fillStyle = '#E6DAC0';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.2;
      ctx.fillRect(this.x, this.y + 18, this.width, this.height - 18);
      ctx.strokeRect(this.x, this.y + 18, this.width, this.height - 18);
      // Corrugated tin lean-to roof
      ctx.fillStyle = '#D5C5A3';
      ctx.beginPath();
      ctx.moveTo(this.x - 8, this.y + 22);
      ctx.lineTo(this.x + this.width * 0.5, this.y);
      ctx.lineTo(this.x + this.width + 8, this.y + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let x = this.x + 14; x < this.x + this.width; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, this.y + 22);
        ctx.lineTo(x, this.y + this.height);
        ctx.stroke();
      }
    }

    // TODO: replace with modern military radio truck ink prop when art pass expands
    _drawRadioTruck(ctx) {
      ctx.fillStyle = '#E6DAC0';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(this.x, this.y + 10, this.width * 0.72, this.height - 16, 4);
      ctx.fill();
      ctx.stroke();
      // Cab
      ctx.fillStyle = '#D5C5A3';
      ctx.beginPath();
      ctx.roundRect(this.x + this.width * 0.7, this.y + 18, this.width * 0.28, this.height - 24, 4);
      ctx.fill();
      ctx.stroke();
      // Whip antenna + dish
      ctx.beginPath();
      ctx.moveTo(this.x + 24, this.y + 10);
      ctx.lineTo(this.x + 18, this.y - 26);
      ctx.stroke();
      ctx.fillStyle = '#F85A5A';
      ctx.beginPath();
      ctx.arc(this.x + 18, this.y - 26, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // TODO: replace with modern steel perimeter watchtower ink prop
    _drawGuardTower(ctx) {
      ctx.fillStyle = '#E6DAC0';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.2;
      ctx.strokeRect(this.x + 8, this.y + 24, this.width - 16, this.height - 24);
      // Cross braces
      ctx.beginPath();
      ctx.moveTo(this.x + 8, this.y + 24);
      ctx.lineTo(this.x + this.width - 8, this.y + this.height);
      ctx.moveTo(this.x + this.width - 8, this.y + 24);
      ctx.lineTo(this.x + 8, this.y + this.height);
      ctx.stroke();
      // Sandbagged top deck
      ctx.fillRect(this.x, this.y, this.width, 28);
      ctx.strokeRect(this.x, this.y, this.width, 28);
    }

    // TODO: replace with assets/environment/basha_site.png
    _drawBashaSite(ctx, time) {
      const x = this.x;
      const y = this.y;
      const w = this.width;
      const h = this.height;
      // Ground shadow under tarp
      ctx.fillStyle = 'rgba(17, 30, 51, 0.16)';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.5, y + h * 0.84, w * 0.48, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Guy-lines & wooden pegs
      ctx.strokeStyle = '#1C2844';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x + 14, y + h * 0.56);
      ctx.lineTo(x + 2, y + h * 0.86);
      ctx.moveTo(x + w - 14, y + h * 0.56);
      ctx.lineTo(x + w - 2, y + h * 0.86);
      ctx.stroke();
      ctx.setLineDash([]);

      // Hammock slung underneath tarp
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x + 18, y + h * 0.55);
      ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.78, x + w - 18, y + h * 0.55);
      ctx.stroke();

      // Sloped modern jungle basha tarp roof
      ctx.fillStyle = '#E6DAC0';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + h * 0.54);
      ctx.lineTo(x + w * 0.44, y + 10);
      ctx.lineTo(x + w - 8, y + 22);
      ctx.lineTo(x + w - 14, y + h * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cross-hatching along tarp ridge
      ctx.strokeStyle = 'rgba(17, 30, 51, 0.35)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        const px = x + 16 + (w - 36) * (i / 6);
        ctx.beginPath();
        ctx.moveTo(px, y + 22);
        ctx.lineTo(px - 6, y + h * 0.54);
        ctx.stroke();
      }

      // Tactical radio on log with crimson power LED
      ctx.fillStyle = '#1C2844';
      ctx.fillRect(x + w * 0.66, y + h * 0.68, 18, 12);
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.66 + 14, y + h * 0.68);
      ctx.lineTo(x + w * 0.66 + 17, y + h * 0.44);
      ctx.stroke();
      const blink = Math.sin((time || 0) * 4) > -0.2;
      ctx.fillStyle = blink ? '#F85A5A' : 'rgba(248, 90, 90, 0.35)';
      ctx.beginPath();
      ctx.arc(x + w * 0.66 + 5, y + h * 0.68 + 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    _drawStructureStamp(ctx, cx, cy, text) {
      ctx.save();
      ctx.font = 'bold 10px "Courier New", monospace';
      const tw = ctx.measureText(text).width;
      const bw = tw + 14;
      const bh = 18;
      ctx.fillStyle = 'rgba(247, 243, 232, 0.92)';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cx - bw * 0.5, cy - bh * 0.5, bw, bh, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#111E33';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, cy + 0.5);
      ctx.restore();
    }

    _drawBlastGate(ctx, time) {
      const slide = this.openProgress * (this.height * 0.85);
      // Brutalist reinforced concrete gantry frame
      ctx.fillStyle = '#E6DAC0';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.6;
      ctx.fillRect(this.x, this.y - 16, this.width, 18);
      ctx.strokeRect(this.x, this.y - 16, this.width, 18);

      // Sliding hydraulic blast bunker door
      const leafH = Math.max(8, this.height - slide);
      if (this.spriteEntry && this.spriteEntry.ready && this.spriteEntry.img && this.openProgress < 0.95) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x - 42, this.y - 24, this.width + 84, leafH + 34);
        ctx.clip();
        ctx.drawImage(this.spriteEntry.img, this.x - 42, this.y - 24 - slide, this.width + 84, this.height + 44);
        ctx.restore();
      } else if (this.openProgress < 0.95) {
        ctx.fillStyle = '#D5C5A3';
        ctx.fillRect(this.x + 4, this.y, this.width - 8, leafH);
        ctx.strokeRect(this.x + 4, this.y, this.width - 8, leafH);
        for (let y = this.y + 10; y < this.y + leafH; y += 12) {
          ctx.beginPath();
          ctx.moveTo(this.x + 6, y);
          ctx.lineTo(this.x + this.width - 6, y);
          ctx.stroke();
        }
      }

      // Crimson / Green status beacon light
      const blink = Math.sin((time || 0) * 6) > 0;
      ctx.fillStyle = this.openProgress >= 0.95 ? '#3E7C59' : (blink ? '#F85A5A' : '#9E2A33');
      ctx.beginPath();
      ctx.arc(this.x + this.width * 0.5, this.y - 7, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    _drawCulvertGrate(ctx) {
      if (this.unlocked) {
        if (this.spriteEntry && this.spriteEntry.ready && this.spriteEntry.img) {
          ctx.save();
          ctx.globalAlpha = 0.42;
          ctx.drawImage(this.spriteEntry.img, this.x - 36, this.y - 8, 108, this.height + 16);
          ctx.restore();
        }
        ctx.strokeStyle = '#3E7C59';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.setLineDash([]);
        this._drawStructureStamp(ctx, this.x + this.width * 0.5, this.y - 10, 'CULVERT OPEN');
        return;
      }
      if (this.spriteEntry && this.spriteEntry.ready && this.spriteEntry.img) {
        ctx.drawImage(this.spriteEntry.img, this.x - 36, this.y - 8, 108, this.height + 16);
      } else {
        ctx.fillStyle = 'rgba(28, 40, 68, 0.2)';
        ctx.strokeStyle = '#111E33';
        ctx.lineWidth = 2.4;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        for (let y = this.y + 10; y < this.y + this.height; y += 10) {
          ctx.beginPath();
          ctx.moveTo(this.x, y);
          ctx.lineTo(this.x + this.width, y);
          ctx.stroke();
        }
      }
      this._drawStructureStamp(ctx, this.x + this.width * 0.5, this.y - 10, 'LOCKED GRATE');
    }

    _drawBarracks(ctx) {
      // 2.5D Oblique wooden logging shack fallback
      ctx.fillStyle = 'rgba(17, 30, 51, 0.16)';
      ctx.fillRect(this.x + 8, this.y + 12, this.width, this.height);

      ctx.fillStyle = '#EFE7D3';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.2;
      ctx.fillRect(this.x, this.y + 24, this.width, this.height - 24);
      ctx.strokeRect(this.x, this.y + 24, this.width, this.height - 24);

      ctx.fillStyle = '#E4D7BC';
      ctx.beginPath();
      ctx.moveTo(this.x - 8, this.y + 28);
      ctx.lineTo(this.x + 12, this.y);
      ctx.lineTo(this.x + this.width - 12, this.y);
      ctx.lineTo(this.x + this.width + 8, this.y + 28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(17, 30, 51, 0.35)';
      ctx.lineWidth = 1.1;
      for (let x = this.x + 16; x < this.x + this.width - 8; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, this.y + 4);
        ctx.lineTo(x, this.y + this.height - 2);
        ctx.stroke();
      }

      if (this.label) {
        ctx.fillStyle = '#111E33';
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.fillText(this.label, this.x + 12, this.y + this.height - 10);
      }
    }

    _drawBunkerWall(ctx) {
      ctx.fillStyle = '#E3D9C3';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.4;
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.strokeRect(this.x, this.y, this.width, this.height);
      // Top bevel
      ctx.fillStyle = '#F4ECD8';
      ctx.fillRect(this.x + 2, this.y + 2, this.width - 4, Math.min(18, this.height * 0.25));
      ctx.strokeStyle = 'rgba(17, 30, 51, 0.3)';
      ctx.lineWidth = 1;
      for (let x = this.x + 12; x < this.x + this.width; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, this.y + 18);
        ctx.lineTo(x - 6, this.y + this.height);
        ctx.stroke();
      }
    }

    _drawFence(ctx) {
      ctx.strokeStyle = '#1C2844';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y + this.height * 0.4, this.width, this.height * 0.55);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(17, 30, 51, 0.45)';
      for (let x = this.x; x < this.x + this.width; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, this.y + this.height * 0.4);
        ctx.lineTo(x + 10, this.y + this.height * 0.95);
        ctx.stroke();
      }
    }

    _drawFallbackLog(ctx) {
      ctx.fillStyle = '#E6DAC0';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(this.x, this.y + 14, this.width, this.height - 18, 14);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(this.x + this.width - 10, this.y + this.height * 0.56, 11, (this.height - 20) * 0.46, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1C2844';
      ctx.fill();
      ctx.stroke();
    }

    _drawFallbackFern(ctx) {
      const cx = this.x + this.width * 0.5;
      const cy = this.y + this.height * 0.65;
      ctx.strokeStyle = '#111E33';
      ctx.fillStyle = 'rgba(62, 124, 89, 0.25)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(ang) * 18, cy + Math.sin(ang) * 10, 22, 7, ang, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    _drawInkTree(ctx) {
      const cx = this.x + this.width * 0.5;
      ctx.fillStyle = '#E6DAC0';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2;
      ctx.fillRect(cx - 10, this.y + 32, 20, this.height - 32);
      ctx.strokeRect(cx - 10, this.y + 32, 20, this.height - 32);
      ctx.fillStyle = '#F4ECD8';
      ctx.beginPath();
      ctx.arc(cx, this.y + 28, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Obstacle25D;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.Obstacle25D = Obstacle25D;
})(typeof window !== 'undefined' ? window : globalThis);
