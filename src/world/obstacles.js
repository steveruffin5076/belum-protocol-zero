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

      // Link isolated sliced environment PNGs
      if (this.type === 'hollow_log') this.spriteEntry = loadPropSprite('assets/environment/hollow_log.png');
      else if (this.type === 'fern') this.spriteEntry = loadPropSprite('assets/environment/fern_clump.png');
      else if (this.type === 'bamboo') this.spriteEntry = loadPropSprite('assets/environment/bamboo_cluster.png');
      else if (this.type === 'blast_gate') this.spriteEntry = loadPropSprite('assets/environment/gate_blast_door.png');
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

      // Draw generated hand-inked PNG prop if ready
      if (this.spriteEntry && this.spriteEntry.ready && this.spriteEntry.img) {
        if (this.type === 'fern') {
          ctx.globalAlpha = 0.92;
        }
        ctx.drawImage(this.spriteEntry.img, this.x - 10, this.y - 10, this.width + 20, this.height + 20);
        if (this.type === 'fern') {
          // Subtle dashed stealth hint outline on forest floor
          ctx.strokeStyle = 'rgba(62, 124, 89, 0.34)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.ellipse(this.x + this.width * 0.5, this.y + this.height * 0.72, this.width * 0.44, this.height * 0.28, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
        return;
      }

      // Crisp Prussian Blue dip-pen etched procedural structures & fallbacks
      if (this.type === 'barracks') {
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

      ctx.restore();
    }

    _drawBlastGate(ctx, time) {
      const slide = this.openProgress * (this.height * 0.85);
      // Bunker frame
      ctx.fillStyle = '#E6DAC0';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.6;
      ctx.fillRect(this.x, this.y - 16, this.width, 18);
      ctx.strokeRect(this.x, this.y - 16, this.width, 18);

      // Sliding steel corrugated gate leaf
      const leafH = Math.max(8, this.height - slide);
      if (this.spriteEntry && this.spriteEntry.ready && this.spriteEntry.img && this.openProgress < 0.95) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x - 14, this.y - 10, this.width + 28, leafH + 14);
        ctx.clip();
        ctx.drawImage(this.spriteEntry.img, this.x - 14, this.y - 10 - slide, this.width + 28, this.height + 24);
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
        ctx.strokeStyle = '#3E7C59';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.setLineDash([]);
        ctx.fillStyle = '#2E6F4E';
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.fillText('CULVERT OPEN', this.x - 12, this.y - 6);
        return;
      }
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
      ctx.fillStyle = '#C9323B';
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.fillText('LOCKED GRATE', this.x - 18, this.y - 6);
    }

    _drawBarracks(ctx) {
      // 2.5D Oblique wooden logging shack with pitched cross-hatched roof
      ctx.fillStyle = 'rgba(17, 30, 51, 0.16)';
      ctx.fillRect(this.x + 8, this.y + 12, this.width, this.height);

      ctx.fillStyle = '#EFE7D3';
      ctx.strokeStyle = '#111E33';
      ctx.lineWidth = 2.2;
      ctx.fillRect(this.x, this.y + 24, this.width, this.height - 24);
      ctx.strokeRect(this.x, this.y + 24, this.width, this.height - 24);

      // Sloped corrugated roof
      ctx.fillStyle = '#E4D7BC';
      ctx.beginPath();
      ctx.moveTo(this.x - 8, this.y + 28);
      ctx.lineTo(this.x + 12, this.y);
      ctx.lineTo(this.x + this.width - 12, this.y);
      ctx.lineTo(this.x + this.width + 8, this.y + 28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wood plank cross-hatching
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
