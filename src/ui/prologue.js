// src/ui/prologue.js - Classified Black-Ops Dossier Typewriter Briefing Screen
(function (global) {
  'use strict';

  const PROLOGUE_LINES = [
    '[TOP SECRET // BLACK-OP PROTOCOL // GGK COMMAND]',
    'DATE: 19 NOVEMBER 2026 // 0340 HRS',
    'LOCATION: PERAK, MALAYSIA // GRID TASIK TEMENGGOR',
    'TARGET: VANGUARD BIO-SYNTHETICS (VBS) RESEARCH ENCLAVE',
    '',
    'Five years after the BT-09 outbreak crippled the peninsula, satellite sweeps detected active power signatures inside the Belum-Temengor reserve.',
    '',
    'Ironclad Tactical Solutions (ITS) mercenaries have locked down the river corridors. Local fauna exposed to chemical runoff are exhibiting hyper-aggressive mutations.',
    '',
    'OPERATOR KANCIL: You are going in alone via Sungai Belum. Scavenge what you can. Do not engage head-on. Recover Tier-1 clearance, decrypt the field drives, and breach the Perimeter Blast Gate.',
    '',
    '[TRANSMISSION ENDS // INITIATE INSERTION]'
  ];

  class PrologueController {
    constructor(soundEngine, onBeginOperation) {
      this.sound = soundEngine || null;
      this.onBeginOperation = onBeginOperation || null;
      this.fullText = PROLOGUE_LINES.join('\n');
      this.charIndex = 0;
      this.timerId = null;
      this.finished = false;
      this._cacheDom();
      this._bindEvents();
    }

    _cacheDom() {
      if (typeof document === 'undefined') return;
      this.overlay = document.getElementById('prologue-overlay');
      this.bodyEl = document.getElementById('prologue-typewriter');
      this.btnSkip = document.getElementById('btn-prologue-skip');
      this.btnBegin = document.getElementById('btn-begin-operation');
    }

    _bindEvents() {
      if (this.btnSkip) {
        this.btnSkip.addEventListener('click', () => this.finishInstant());
      }
      if (this.btnBegin) {
        this.btnBegin.addEventListener('click', () => this.beginOperation());
      }
    }

    start() {
      if (!this.overlay || !this.bodyEl) return;
      this.overlay.classList.remove('hidden');
      this.bodyEl.textContent = '';
      this.charIndex = 0;
      this.finished = false;
      if (this.timerId) clearInterval(this.timerId);

      this.timerId = setInterval(() => {
        if (this.charIndex >= this.fullText.length) {
          this.finishInstant();
          return;
        }
        const step = 3;
        this.charIndex = Math.min(this.fullText.length, this.charIndex + step);
        this.bodyEl.textContent = this.fullText.slice(0, this.charIndex);
        if (this.sound && this.charIndex % 6 === 0) {
          this.sound.playTeletypeClick();
        }
      }, 24);
    }

    finishInstant() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      this.charIndex = this.fullText.length;
      this.finished = true;
      if (this.bodyEl) {
        this.bodyEl.textContent = this.fullText;
      }
    }

    beginOperation() {
      this.finishInstant();
      if (this.overlay) {
        this.overlay.classList.add('hidden');
      }
      if (this.sound) {
        this.sound.init();
        this.sound.startAmbience();
        this.sound.playThunder(0.55);
      }
      if (typeof this.onBeginOperation === 'function') {
        this.onBeginOperation();
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrologueController;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.PrologueController = PrologueController;
})(typeof window !== 'undefined' ? window : globalThis);
