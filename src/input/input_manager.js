// src/input/input_manager.js - Unified Desktop + Multi-Touch Mobile Controller with Haptics & Audio Unlock
(function (global) {
  'use strict';

  function normalizeVector(x, y) {
    const sx = Number.isFinite(x) ? x : 0;
    const sy = Number.isFinite(y) ? y : 0;
    const mag = Math.hypot(sx, sy);
    if (!Number.isFinite(mag) || mag < 1e-6) {
      return { x: 0, y: 0 };
    }
    if (mag <= 1) {
      return { x: sx, y: sy };
    }
    return { x: sx / mag, y: sy / mag };
  }

  function normalizeUnit(x, y, fallbackX, fallbackY) {
    const sx = Number.isFinite(x) ? x : 0;
    const sy = Number.isFinite(y) ? y : 0;
    const mag = Math.hypot(sx, sy);
    if (!Number.isFinite(mag) || mag < 1e-6) {
      return { x: fallbackX !== undefined ? fallbackX : 1, y: fallbackY !== undefined ? fallbackY : 0 };
    }
    return { x: sx / mag, y: sy / mag };
  }

  function vibrate(pattern) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (_) {
      // Ignore on unsupported browsers
    }
  }

  class InputManager {
    constructor(canvas, callbacks) {
      this.canvas = canvas || null;
      this.cb = callbacks || {};
      this.keys = Object.create(null);

      // Output vectors (strictly finite, mag <= 1.0)
      this.moveVector = { x: 0, y: 0 };
      this.aimVector = { x: 1, y: 0 };
      this.mouseScreen = { x: 640, y: 360 };
      this.mouseActive = false;

      // Digital state flags
      this.sprintHeld = false;
      this.touchSprintToggle = false;
      this.crouchToggle = false;
      this.aimHeld = false;

      // One-frame queued triggers consumed by game loop
      this.actions = {
        attackPrimary: false,
        attackRanged: false,
        meleeSlash: false,
        interact: false,
        quickConsumable: false,
        toggleCamp: false,
        dodge: false,
        weaponSelect: null
      };

      // Virtual D-Pad multi-touch state
      this.dpadVector = { x: 0, y: 0 };
      this.dpadPointerId = null;
      this.dpadEl = null;
      this.dpadKnobEl = null;

      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        this._bindKeyboard();
        this._bindMouse();
        this._bindTouchHud();
      }
    }

    _isGameplayActive() {
      return !this.cb || typeof this.cb.isGameplayActive !== 'function' || !!this.cb.isGameplayActive();
    }

    _notifyUserGesture() {
      if (this.cb && typeof this.cb.onUserGesture === 'function') {
        this.cb.onUserGesture();
      }
    }

    _bindKeyboard() {
      window.addEventListener('keydown', (e) => {
        this._notifyUserGesture();
        const code = e.code;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
          e.preventDefault();
        }
        const alreadyDown = !!this.keys[code];
        this.keys[code] = true;

        if (!alreadyDown) {
          if (code === 'KeyM' && this.cb.onToggleMute) {
            this.cb.onToggleMute();
          } else if (code === 'KeyJ' && this.cb.onOpenDossier) {
            this.cb.onOpenDossier();
          } else if (code === 'KeyC' || code === 'ControlLeft' || code === 'ControlRight') {
            this.crouchToggle = !this.crouchToggle;
          } else if (this._isGameplayActive()) {
            if (code === 'KeyE' || code === 'KeyF') {
              this.actions.interact = true;
            } else if (code === 'KeyQ') {
              this.actions.quickConsumable = true;
            } else if (code === 'KeyB') {
              this.actions.toggleCamp = true;
            } else if (code === 'Space') {
              if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
                this.actions.dodge = true;
              } else {
                this.actions.meleeSlash = true;
              }
            } else if (code === 'Digit1') {
              this.actions.weaponSelect = 'parang';
            } else if (code === 'Digit2') {
              this.actions.weaponSelect = 'crossbow';
            } else if (code === 'Digit3') {
              this.actions.weaponSelect = 'pistol';
            } else if (code === 'Digit4') {
              this.actions.weaponSelect = 'decoy';
            }
          }
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
      });

      window.addEventListener('blur', () => {
        this.keys = Object.create(null);
        this.dpadVector = { x: 0, y: 0 };
        this.dpadPointerId = null;
        this._resetKnobVisual();
      });
    }

    _bindMouse() {
      if (!this.canvas) return;
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseScreen.x = e.clientX - rect.left;
        this.mouseScreen.y = e.clientY - rect.top;
        this.mouseActive = true;
      });

      this.canvas.addEventListener('pointerdown', (e) => {
        this._notifyUserGesture();
        // Multi-touch guard: ignore if this pointer is already driving the D-Pad
        if (this.dpadPointerId !== null && e.pointerId === this.dpadPointerId) return;
        const rect = this.canvas.getBoundingClientRect();
        this.mouseScreen.x = e.clientX - rect.left;
        this.mouseScreen.y = e.clientY - rect.top;
        this.mouseActive = e.pointerType !== 'touch';
        if (!this._isGameplayActive()) return;
        if (e.button === 0 || e.pointerType === 'touch') {
          this.actions.attackPrimary = true;
        } else if (e.button === 2) {
          this.aimHeld = true;
          this.actions.attackRanged = true;
        }
      });

      window.addEventListener('pointerup', (e) => {
        if (e.button === 2) {
          this.aimHeld = false;
        }
      });

      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _bindTouchHud() {
      this.dpadEl = document.getElementById('dpad-dial');
      this.dpadKnobEl = document.getElementById('dpad-knob');

      if (this.dpadEl) {
        const updateFromPoint = (clientX, clientY) => {
          const rect = this.dpadEl.getBoundingClientRect();
          const cx = rect.left + rect.width * 0.5;
          const cy = rect.top + rect.height * 0.5;
          const maxR = Math.max(18, rect.width * 0.38);
          const dx = clientX - cx;
          const dy = clientY - cy;
          const dist = Math.hypot(dx, dy);
          if (dist < 6) {
            this.dpadVector = { x: 0, y: 0 };
            this._setKnobVisual(0, 0);
            return;
          }
          const clamped = Math.min(dist, maxR);
          const nx = (dx / dist) * (clamped / maxR);
          const ny = (dy / dist) * (clamped / maxR);
          this.dpadVector = normalizeVector(nx, ny);
          this._setKnobVisual((dx / dist) * clamped, (dy / dist) * clamped);
          this.mouseActive = false;
          this.aimVector = normalizeUnit(nx, ny, this.aimVector.x, this.aimVector.y);
        };

        this.dpadEl.addEventListener('pointerdown', (e) => {
          this._notifyUserGesture();
          if (e.target && e.target.closest && e.target.closest('#btn-sprint-center')) {
            return;
          }
          e.preventDefault();
          this.dpadPointerId = e.pointerId;
          if (this.dpadEl.setPointerCapture) {
            try { this.dpadEl.setPointerCapture(e.pointerId); } catch (_) {}
          }
          updateFromPoint(e.clientX, e.clientY);
        });

        this.dpadEl.addEventListener('pointermove', (e) => {
          if (this.dpadPointerId !== e.pointerId) return;
          e.preventDefault();
          updateFromPoint(e.clientX, e.clientY);
        });

        const releaseDpad = (e) => {
          if (this.dpadPointerId !== e.pointerId) return;
          this.dpadPointerId = null;
          this.dpadVector = { x: 0, y: 0 };
          this._resetKnobVisual();
        };
        this.dpadEl.addEventListener('pointerup', releaseDpad);
        this.dpadEl.addEventListener('pointercancel', releaseDpad);
      }

      // Multi-touch isolated pointerdown bindings: right thumb taps never conflict with left thumb D-Pad
      const bindMultiTouchTap = (id, fn, requireGameplay) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('pointerdown', (e) => {
          if (this.dpadPointerId !== null && e.pointerId === this.dpadPointerId) return;
          e.preventDefault();
          e.stopPropagation();
          this._notifyUserGesture();
          if (requireGameplay && !this._isGameplayActive()) return;
          fn();
        });
      };

      bindMultiTouchTap('btn-sprint-center', () => {
        this.touchSprintToggle = !this.touchSprintToggle;
      }, false);
      bindMultiTouchTap('btn-action-hand', () => {
        this.actions.interact = true;
      }, true);
      bindMultiTouchTap('btn-action-crosshair', () => {
        this.actions.attackRanged = true;
      }, true);
      bindMultiTouchTap('btn-action-reticle', () => {
        this.actions.meleeSlash = true;
      }, true);
      bindMultiTouchTap('btn-action-bag', () => {
        this.actions.quickConsumable = true;
      }, true);
      bindMultiTouchTap('btn-action-crouch', () => {
        this.crouchToggle = !this.crouchToggle;
      }, false);
    }

    _setKnobVisual(ox, oy) {
      if (this.dpadKnobEl) {
        this.dpadKnobEl.style.transform = `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px)`;
      }
    }

    _resetKnobVisual() {
      this._setKnobVisual(0, 0);
    }

    update(playerWorldPos, camera) {
      let kx = 0;
      let ky = 0;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) ky -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) ky += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) kx -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) kx += 1;

      const rawX = kx !== 0 || ky !== 0 ? kx : this.dpadVector.x;
      const rawY = kx !== 0 || ky !== 0 ? ky : this.dpadVector.y;
      this.moveVector = normalizeVector(rawX, rawY);

      this.sprintHeld = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.touchSprintToggle);

      if (this.mouseActive && playerWorldPos && camera) {
        const worldMouse = camera.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);
        const dx = worldMouse.x - playerWorldPos.x;
        const dy = worldMouse.y - playerWorldPos.y;
        this.aimVector = normalizeUnit(dx, dy, this.aimVector.x, this.aimVector.y);
      } else if (Math.hypot(this.moveVector.x, this.moveVector.y) > 0.15) {
        this.aimVector = normalizeUnit(this.moveVector.x, this.moveVector.y, this.aimVector.x, this.aimVector.y);
      }

      if (!Number.isFinite(this.moveVector.x) || !Number.isFinite(this.moveVector.y)) {
        this.moveVector = { x: 0, y: 0 };
      }
      if (!Number.isFinite(this.aimVector.x) || !Number.isFinite(this.aimVector.y)) {
        this.aimVector = { x: 1, y: 0 };
      }
    }

    clearActions() {
      this.actions.attackPrimary = false;
      this.actions.attackRanged = false;
      this.actions.meleeSlash = false;
      this.actions.interact = false;
      this.actions.quickConsumable = false;
      this.actions.toggleCamp = false;
      this.actions.dodge = false;
      this.actions.weaponSelect = null;
    }

    consumeActions() {
      const snapshot = Object.assign({}, this.actions);
      this.clearActions();
      return snapshot;
    }
  }

  InputManager.normalizeVector = normalizeVector;
  InputManager.normalizeUnit = normalizeUnit;
  InputManager.vibrate = vibrate;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputManager;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.InputManager = InputManager;
})(typeof window !== 'undefined' ? window : globalThis);
