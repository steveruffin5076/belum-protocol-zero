// src/engine/camera.js - AAA Spring Camera with Dynamic Zoom, 75px Aim Lookahead & Directional Trauma Shake
(function (global) {
  'use strict';

  class Camera25D {
    constructor(viewportW, viewportH, worldW, worldH) {
      this.viewportW = viewportW || 1280;
      this.viewportH = viewportH || 720;
      this.worldW = worldW || 4200;
      this.worldH = worldH || 1320;
      this.x = 0;
      this.y = 0;

      // Dynamic Zoom Framing: +8% in ferns (1.08), -6% sprinting (0.94), 1.0 default
      this.zoom = 1.0;
      this.targetZoom = 1.0;
      this.zoomSmoothing = 4.2;

      // Smooth spring follow & 75px aim lookahead
      this.followSmoothing = 7.2;
      this.lookaheadDist = 75;

      // Directional quadratic trauma screenshake:
      // offset = recoilDir * trauma^2 * sin(time * frequency)
      this.trauma = 0;
      this.traumaDecay = 2.1;
      this.shakeTime = 0;
      this.shakeFreq = 56;
      this.recoilDirX = 1;
      this.recoilDirY = 0.35;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeStrength = 1.0; // 0..1 accessibility multiplier (Fix 6)
    }

    setShakeStrength(strength) {
      const s = Number.isFinite(strength) ? strength : 1.0;
      this.shakeStrength = Math.max(0, Math.min(1, s));
      if (this.shakeStrength === 0) {
        this.trauma = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    }

    resize(viewportW, viewportH) {
      this.viewportW = Math.max(320, viewportW || 1280);
      this.viewportH = Math.max(240, viewportH || 720);
    }

    setWorldBounds(worldW, worldH) {
      this.worldW = Math.max(this.viewportW, worldW || 4200);
      this.worldH = Math.max(this.viewportH, worldH || 1320);
    }

    snapTo(targetX, targetY) {
      const tx = (Number.isFinite(targetX) ? targetX : 0) - this.viewportW * 0.5;
      const ty = (Number.isFinite(targetY) ? targetY : 0) - this.viewportH * 0.5;
      this.x = this._clamp(tx, 0, Math.max(0, this.worldW - this.viewportW));
      this.y = this._clamp(ty, 0, Math.max(0, this.worldH - this.viewportH));
    }

    /**
     * Directional trauma impulse pushing camera away from impact origin with quadratic decay
     */
    addTrauma(amount, dirX, dirY) {
      if (this.shakeStrength <= 0) return;
      const a = (Number.isFinite(amount) ? amount : 0.4) * this.shakeStrength;
      this.trauma = Math.min(1.0, Math.max(this.trauma, this.trauma + a));
      if (Number.isFinite(dirX) && Number.isFinite(dirY)) {
        const mag = Math.hypot(dirX, dirY);
        if (mag > 0.01) {
          this.recoilDirX = dirX / mag;
          this.recoilDirY = dirY / mag;
        }
      } else {
        const ang = Math.random() * Math.PI * 2;
        this.recoilDirX = Math.cos(ang);
        this.recoilDirY = Math.sin(ang);
      }
    }

    /**
     * Backward-compatible shake helper mapped into directional trauma physics
     */
    addShake(magnitude, duration, dirX, dirY) {
      const t = Math.min(1.0, Math.max(0.18, (magnitude || 6) / 11));
      this.addTrauma(t, dirX, dirY);
    }

    updateShakeOnly(dt) {
      const safeDt = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0.016));
      this.shakeTime += safeDt;
      if (this.trauma > 0) {
        const sq = this.trauma * this.trauma;
        const wave = Math.sin(this.shakeTime * this.shakeFreq);
        const cross = Math.cos(this.shakeTime * (this.shakeFreq * 0.73)) * 0.35;
        const amp = 26;
        this.shakeOffsetX = (this.recoilDirX * wave - this.recoilDirY * cross) * sq * amp;
        this.shakeOffsetY = (this.recoilDirY * wave + this.recoilDirX * cross) * sq * amp;
        this.trauma = Math.max(0, this.trauma - this.traumaDecay * safeDt);
      } else {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    }

    update(dt, targetX, targetY, aimVector, playerState) {
      const safeDt = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0.016));
      const ax = aimVector && Number.isFinite(aimVector.x) ? aimVector.x : 0;
      const ay = aimVector && Number.isFinite(aimVector.y) ? aimVector.y : 0;

      // Dynamic zoom target: +8% zoom-in when concealed in ferns, -6% zoom-out when sprinting
      if (playerState && playerState.isConcealed) {
        this.targetZoom = 1.08;
      } else if (playerState && playerState.sprinting) {
        this.targetZoom = 0.94;
      } else {
        this.targetZoom = 1.0;
      }
      const zoomAlpha = 1 - Math.exp(-this.zoomSmoothing * safeDt);
      this.zoom += (this.targetZoom - this.zoom) * zoomAlpha;

      const desiredX = (Number.isFinite(targetX) ? targetX : 0) + ax * this.lookaheadDist - this.viewportW * 0.5;
      const desiredY = (Number.isFinite(targetY) ? targetY : 0) + ay * this.lookaheadDist - this.viewportH * 0.5;

      const lerpAlpha = 1 - Math.exp(-this.followSmoothing * safeDt);
      this.x += (desiredX - this.x) * lerpAlpha;
      this.y += (desiredY - this.y) * lerpAlpha;

      this.x = this._clamp(this.x, 0, Math.max(0, this.worldW - this.viewportW));
      this.y = this._clamp(this.y, 0, Math.max(0, this.worldH - this.viewportH));

      this.updateShakeOnly(safeDt);
    }

    screenToWorld(screenX, screenY) {
      const sx = Number.isFinite(screenX) ? screenX : 0;
      const sy = Number.isFinite(screenY) ? screenY : 0;
      const z = this.zoom || 1.0;
      const halfW = this.viewportW * 0.5;
      const halfH = this.viewportH * 0.5;
      return {
        x: (sx - halfW) / z + halfW + this.x,
        y: (sy - halfH) / z + halfH + this.y
      };
    }

    getRenderOffset() {
      return {
        x: Math.round(this.x + this.shakeOffsetX),
        y: Math.round(this.y + this.shakeOffsetY),
        zoom: this.zoom
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
