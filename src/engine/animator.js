// src/engine/animator.js - Standard 8-frame sprite grid animator with exterior parchment transparency pass
(function (global) {
  'use strict';

  /**
   * Flood-fills exterior aged cream parchment background (#F7F3E8-ish) to transparent alpha
   * while preserving the opaque interior of the character/creature ink silhouette for clean 2.5D Y-sorting.
   */
  function keyExteriorParchment(img) {
    if (typeof document === 'undefined' || !img || !img.width || !img.height) return img;
    try {
      const w = img.width;
      const h = img.height;
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const ctx = off.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Sample average corner luminance/color to detect paper tone
      const isPaperLike = (idx) => {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a < 20) return true;
        // Bright warm cream parchment pixels (high luminance, low saturation, not crimson/blue ink)
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC - minC;
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        return luma > 188 && sat < 62 && r > 175 && g > 165 && b > 135;
      };

      // Trim any thin 1-4px outer divider line artifacts near cell borders before flood-fill
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0;
      let tail = 0;

      const pushIfPaper = (x, y) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return;
        const pos = y * w + x;
        if (visited[pos]) return;
        const idx = pos * 4;
        if (isPaperLike(idx)) {
          visited[pos] = 1;
          queue[tail++] = pos;
        }
      };

      // Seed from outer border ring (including inset 3px to skip subtle grid lines)
      for (let x = 0; x < w; x++) {
        pushIfPaper(x, 0);
        pushIfPaper(x, 1);
        pushIfPaper(x, 3);
        pushIfPaper(x, h - 1);
        pushIfPaper(x, h - 2);
        pushIfPaper(x, h - 4);
      }
      for (let y = 0; y < h; y++) {
        pushIfPaper(0, y);
        pushIfPaper(1, y);
        pushIfPaper(3, y);
        pushIfPaper(w - 1, y);
        pushIfPaper(w - 2, y);
        pushIfPaper(w - 4, y);
      }

      while (head < tail) {
        const pos = queue[head++];
        const x = pos % w;
        const y = (pos - x) / w;
        data[pos * 4 + 3] = 0;
        if (x > 0) pushIfPaper(x - 1, y);
        if (x + 1 < w) pushIfPaper(x + 1, y);
        if (y > 0) pushIfPaper(x, y - 1);
        if (y + 1 < h) pushIfPaper(x, y + 1);
      }

      // Soften 1px fringe adjacent to removed background and clean faint outer divider pixels
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (x < 3 || y < 3 || x >= w - 3 || y >= h - 3) {
            data[(y * w + x) * 4 + 3] = 0;
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      return off;
    } catch (_) {
      return img;
    }
  }

  class Sprite8FrameAnimator {
    constructor(options) {
      const cfg = options || {};
      this.fps = cfg.fps || 8;
      this.frameCount = cfg.frameCount || 8;
      this.firstFrame = Number.isInteger(cfg.firstFrame) ? Math.max(0, Math.min(this.frameCount - 1, cfg.firstFrame)) : 0;
      this.lastFrame = Number.isInteger(cfg.lastFrame) ? Math.max(this.firstFrame, Math.min(this.frameCount - 1, cfg.lastFrame)) : (this.frameCount - 1);
      this.scale = Number.isFinite(cfg.scale) && cfg.scale > 0 ? cfg.scale : 1.0;
      this.loop = cfg.loop !== undefined ? cfg.loop : true;
      this.flipX = !!cfg.flipX;
      this.currentFrame = this.firstFrame;
      this.elapsed = 0;
      this.finished = false;
      this.frames = new Array(this.frameCount).fill(null);
      this.readyCount = 0;

      if (cfg.framePrefix && typeof Image !== 'undefined') {
        this.loadSlicedFrames(cfg.framePrefix, cfg.frameDir || 'assets/sprites/frames');
      }
    }

    loadSlicedFrames(prefix, dir) {
      const base = (dir || 'assets/sprites/frames').replace(/\/+$/, '');
      for (let i = 0; i < this.frameCount; i++) {
        const idx = i;
        const img = new Image();
        img.onload = () => {
          this.frames[idx] = keyExteriorParchment(img);
          this.readyCount++;
        };
        img.onerror = () => {
          this.frames[idx] = null;
        };
        img.src = `${base}/${prefix}_${idx}.png`;
      }
    }

    isReady() {
      return this.readyCount > 0 && this.frames[this.currentFrame] !== null;
    }

    reset() {
      this.currentFrame = this.firstFrame;
      this.elapsed = 0;
      this.finished = false;
    }

    update(dt, isPlaying) {
      if (isPlaying === false) return;
      const safeDt = Math.min(0.25, Math.max(0, Number.isFinite(dt) ? dt : 0));
      const frameDuration = 1 / Math.max(1, this.fps);
      this.elapsed += safeDt;

      while (this.elapsed >= frameDuration) {
        this.elapsed -= frameDuration;
        if (this.currentFrame + 1 <= this.lastFrame) {
          this.currentFrame++;
        } else if (this.loop) {
          this.currentFrame = this.firstFrame;
        } else {
          this.currentFrame = this.lastFrame;
          this.finished = true;
        }
      }
    }

    draw(ctx, x, y, drawW, drawH, flipXOverride, alpha) {
      const frame = this.frames[this.currentFrame];
      if (!ctx || !frame) return false;
      const flip = flipXOverride !== undefined ? flipXOverride : this.flipX;
      // Shared A2 & A5: Preserve true frame aspect ratio, apply scale, and pin feet at y + drawH
      const h = drawH * this.scale;
      const w = (frame.width && frame.height) ? (h * frame.width / frame.height) : (drawW * this.scale);
      const centerX = x + drawW * 0.5;
      const bottomY = y + drawH;

      ctx.save();
      if (alpha !== undefined) ctx.globalAlpha = alpha;
      ctx.translate(centerX, bottomY - h * 0.5);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(frame, -w * 0.5, -h * 0.5, w, h);
      ctx.restore();
      return true;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Sprite8FrameAnimator;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.Sprite8FrameAnimator = Sprite8FrameAnimator;
  global.BelumGame.keyExteriorParchment = keyExteriorParchment;
})(typeof window !== 'undefined' ? window : globalThis);
