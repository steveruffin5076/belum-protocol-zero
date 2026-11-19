// src/engine/camera.js - Smooth target-follow 2.5D camera with aim lookahead & trauma shake
(function (global) {
  'use strict';

  class Camera25D {
    constructor(viewportW, viewportH, worldW, worldH) {
      this.viewportW = viewportW || 1280;
      this.viewportH = viewportH || 720;
      this.worldW = worldW || 4200;
      this.worldH = worldH || 1500;
      this.x = 0;
      this.y = 0;
      this.shakeTime = 0;
      this.shakeMagnitude = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.followSmoothing = 7.5;
      this.lookaheadDist = 55;
    }

    resize(viewportW, viewportH) {
      this.viewportW = Math.max(320, viewportW || 1280);
      this.viewportH = Math.max(240, viewportH || 720);
    }

    setWorldBounds(worldW, worldH) {
      this.worldW = Math.max(this.viewportW, worldW || 4200);
      this.worldH = Math.max(this.viewportH, worldH || 1500);
    }

    snapTo(targetX, targetY) {
      const tx = (Number.isFinite(targetX) ? targetX : 0) - this.viewportW * 0.5;
      const ty = (Number.isFinite(targetY) ? targetY : 0) - this.viewportH * 0.5;
      this.x = this._clamp(tx, 0, Math.max(0, this.worldW - this.viewportW));
      this.y = this._clamp(ty, 0, Math.max(0, this.worldH - this.viewportH));
    }

    addShake(magnitude, duration) {
      this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude || 6);
      this.shakeTime = Math.max(this.shakeTime, duration || 0.25);
    }

    update(dt, targetX, targetY, aimVector) {
      const safeDt = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0.016));
      const ax = aimVector && Number.isFinite(aimVector.x) ? aimVector.x : 0;
      const ay = aimVector && Number.isFinite(aimVector.y) ? aimVector.y : 0;

      const desiredX = (Number.isFinite(targetX) ? targetX : 0) + ax * this.lookaheadDist - this.viewportW * 0.5;
      const desiredY = (Number.isFinite(targetY) ? targetY : 0) + ay * this.lookaheadDist - this.viewportH * 0.5;

      const lerpAlpha = 1 - Math.exp(-this.followSmoothing * safeDt);
      this.x += (desiredX - this.x) * lerpAlpha;
      this.y += (desiredY - this.y) * lerpAlpha;

      this.x = this._clamp(this.x, 0, Math.max(0, this.worldW - this.viewportW));
      this.y = this._clamp(this.y, 0, Math.max(0, this.worldH - this.viewportH));

      if (this.shakeTime > 0) {
        this.shakeTime = Math.max(0, this.shakeTime - safeDt);
        const mag = this.shakeMagnitude * (this.shakeTime > 0 ? 1 : 0);
        this.shakeOffsetX = (Math.random() * 2 - 1) * mag;
        this.shakeOffsetY = (Math.random() * 2 - 1) * mag;
        if (this.shakeTime === 0) {
          this.shakeMagnitude = 0;
          this.shakeOffsetX = 0;
          this.shakeOffsetY = 0;
        }
      } else {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    }

    screenToWorld(screenX, screenY) {
      return {
        x: (Number.isFinite(screenX) ? screenX : 0) + this.x,
        y: (Number.isFinite(screenY) ? screenY : 0) + this.y
      };
    }

    getRenderOffset() {
      return {
        x: Math.round(this.x + this.shakeOffsetX),
        y: Math.round(this.y + this.shakeOffsetY)
      };
    }

    _clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Camera25D;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.Camera25D = Camera25D;
})(typeof window !== 'undefined' ? window : globalThis);
