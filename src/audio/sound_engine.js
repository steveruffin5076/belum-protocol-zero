// src/audio/sound_engine.js - Zero-Asset Procedural Web Audio Synthesizer (Rain, Cicadas, Weapons, Radio, Heartbeat)
(function (global) {
  'use strict';

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.muted = false;
      this.ambientRunning = false;
      this.heartbeatTimer = 0;
      this.thunderTimer = 14;
      this.noiseBuffer = null;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return true;
      }
      const AudioCtx =
        (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
      if (!AudioCtx) return false;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.42;
        this.masterGain.connect(this.ctx.destination);
        this.noiseBuffer = this._createPinkNoiseBuffer(2.5);
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.ctx.currentTime, 0.04);
      }
      return this.muted;
    }

    _createPinkNoiseBuffer(seconds) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = this.ctx.createBuffer(1, len, rate);
      const out = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }
      return buf;
    }

    startAmbience() {
      if (!this.init() || this.ambientRunning) return;
      this.ambientRunning = true;

      // 1. Tropical Rain: Filtered pink noise with dynamic lowpass modulation
      const rainSrc = this.ctx.createBufferSource();
      rainSrc.buffer = this.noiseBuffer;
      rainSrc.loop = true;

      const rainFilter = this.ctx.createBiquadFilter();
      rainFilter.type = 'lowpass';
      rainFilter.frequency.value = 1150;

      const rainLfo = this.ctx.createOscillator();
      rainLfo.frequency.value = 0.14;
      const rainLfoGain = this.ctx.createGain();
      rainLfoGain.gain.value = 320;
      rainLfo.connect(rainLfoGain);
      rainLfoGain.connect(rainFilter.frequency);

      const rainGain = this.ctx.createGain();
      rainGain.gain.value = 0.36;

      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(this.masterGain);
      rainSrc.start();
      rainLfo.start();

      // 2. Belum Cicada Drone: 4200 Hz FM-modulated sawtooth oscillator
      const cicadaCarrier = this.ctx.createOscillator();
      cicadaCarrier.type = 'sawtooth';
      cicadaCarrier.frequency.value = 4200;

      const cicadaMod = this.ctx.createOscillator();
      cicadaMod.frequency.value = 24;
      const cicadaModGain = this.ctx.createGain();
      cicadaModGain.gain.value = 110;
      cicadaMod.connect(cicadaModGain);
      cicadaModGain.connect(cicadaCarrier.frequency);

      const cicadaBand = this.ctx.createBiquadFilter();
      cicadaBand.type = 'bandpass';
      cicadaBand.frequency.value = 4200;
      cicadaBand.Q.value = 5.5;

      const cicadaGain = this.ctx.createGain();
      cicadaGain.gain.value = 0.016;

      cicadaCarrier.connect(cicadaBand);
      cicadaBand.connect(cicadaGain);
      cicadaGain.connect(this.masterGain);
      cicadaCarrier.start();
      cicadaMod.start();
    }

    update(dt, isTense) {
      if (!this.ctx || this.muted || !this.ambientRunning) return;
      const safeDt = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0.016));

      // Occasional distant tropical thunder
      this.thunderTimer -= safeDt;
      if (this.thunderTimer <= 0) {
        this.thunderTimer = 18 + Math.random() * 22;
        this.playThunder(0.32);
      }

      // Tension Heartbeat: 55 Hz sub-bass sine wave when detected or HP < 30%
      if (isTense) {
        this.heartbeatTimer -= safeDt;
        if (this.heartbeatTimer <= 0) {
          this.heartbeatTimer = 0.78;
          this.playHeartbeat();
        }
      } else {
        this.heartbeatTimer = 0;
      }
    }

    playThunder(intensity) {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(68, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 1.8);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(intensity || 0.45, now + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.1);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 2.15);
    }

    playTeletypeClick() {
      if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1450 + Math.random() * 250, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.025);
    }

    playParangSlash() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      // Pitch-bent triangle wave
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.16);

      // Filtered white noise air whoosh
      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(1800, now);
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.35, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        src.connect(filt);
        filt.connect(ng);
        ng.connect(this.masterGain);
        src.start(now);
        src.stop(now + 0.14);
      }
    }

    playCrossbowTwang() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      // Section 9: Exponential frequency sweep 880 Hz -> 140 Hz
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.19);
    }

    playSuppressedShot() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      // Section 9: Low-passed 240 Hz thump + snappy mechanical click
      const osc = this.ctx.createOscillator();
      const filt = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.09);
      filt.type = 'lowpass';
      filt.frequency.value = 340;
      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.11);

      // Mechanical slide click
      const click = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      click.type = 'square';
      click.frequency.setValueAtTime(2100, now + 0.02);
      cg.gain.setValueAtTime(0.08, now + 0.02);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      click.connect(cg);
      cg.connect(this.masterGain);
      click.start(now + 0.02);
      click.stop(now + 0.05);
    }

    playMercRifleShot() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(1400, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.48, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        src.connect(filt);
        filt.connect(gain);
        gain.connect(this.masterGain);
        src.start(now);
        src.stop(now + 0.12);
      }
    }

    playRadioAlert() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      // Section 9: Dual square-wave chirp (1100 Hz / 1650 Hz) + white noise static burst
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.setValueAtTime(1650, now + 0.075);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.18);
    }

    playBoarRoar() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(155, now);
      osc.frequency.linearRampToValueAtTime(92, now + 0.32);
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 460;
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.36);
    }

    playDecoyClatter() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      [0, 0.06, 0.11].forEach((offset, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(760 - idx * 140, now + offset);
        gain.gain.setValueAtTime(0.18 / (idx + 1), now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.055);
      });
    }

    playAlarmKlaxon() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.linearRampToValueAtTime(640, now + 0.35);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.44);
    }

    playHeartbeat() {
      if (!this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      // Section 9: 55 Hz sub-bass sine wave double thump
      [0, 0.16].forEach((delay, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, now + delay);
        gain.gain.setValueAtTime(i === 0 ? 0.35 : 0.24, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.14);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + delay);
        osc.stop(now + delay + 0.15);
      });
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoundEngine;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.SoundEngine = SoundEngine;
})(typeof window !== 'undefined' ? window : globalThis);
