// src/audio/sound_engine.js - Triple-A Procedural Web Audio Foley Synthesizer
// Zero external audio files: Surface-Aware Footsteps, 3-Layer Weapon Foley, Tension Ducking, Boar Wall Crash Tinnitus & Blast Hydraulics
(function (global) {
  'use strict';

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.ambientGain = null;
      this.lowpassDucking = null;
      this.ambientDuckFilter = null;
      this.initialized = false;
      this.muted = false;
      this.ambientRunning = false;
      this.tensionActive = false;
      this.heartbeatTimer = 0;
      this.thunderTimer = 14;
      this.noiseBuffer = null;
      this.lastRustleTime = 0;
      this.lastFootstepTime = 0;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        this.initialized = true;
        return true;
      }
      const AudioCtx =
        (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
      if (!AudioCtx) return false;
      try {
        this.ctx = new AudioCtx();
        const now = this.ctx.currentTime;

        // Master bus
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.62, now);
        this.masterGain.connect(this.ctx.destination);

        // Dynamic tension low-pass filter for ambient rain & cicadas (20kHz -> 450Hz during ALERT/low HP)
        this.lowpassDucking = this.ctx.createBiquadFilter();
        this.lowpassDucking.type = 'lowpass';
        this.lowpassDucking.frequency.setValueAtTime(20000, now);
        this.lowpassDucking.connect(this.masterGain);
        this.ambientDuckFilter = this.lowpassDucking;

        // Sub-busses: SFX stays punchy on masterGain, ambient ducks through lowpassDucking
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.85, now);
        this.sfxGain.connect(this.masterGain);

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.setValueAtTime(0.45, now);
        this.ambientGain.connect(this.lowpassDucking);

        this.noiseBuffer = this._createPinkNoiseBuffer(2.5);
        this.initialized = true;

        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    unlock() {
      const ok = this.init();
      if (ok && this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (ok && !this.ambientRunning) {
        this.startAmbience();
      }
      return ok;
    }

    isActive() {
      return !!(this.ctx && this.ctx.state === 'running' && !this.muted);
    }

    getStatusLabel() {
      return this.isActive() ? '[AUDIO: ACTIVE]' : '[TAP TO UNMUTE]';
    }

    toggleMute() {
      this.unlock();
      this.muted = !this.muted;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.62, this.ctx.currentTime, 0.04);
      }
      return this.muted;
    }

    // Section 5: Tension Ducking — muffles ambient rain/cicadas when alerted or in mortal danger
    setCombatTension(isAlerted) {
      this.tensionActive = !!isAlerted;
      if (!this.ctx || !this.lowpassDucking || !this.ambientGain) return;
      const now = this.ctx.currentTime;
      if (isAlerted) {
        this.lowpassDucking.frequency.setTargetAtTime(450, now, 0.14);
        this.ambientGain.gain.setTargetAtTime(0.18, now, 0.14);
      } else {
        this.lowpassDucking.frequency.setTargetAtTime(20000, now, 0.3);
        this.ambientGain.gain.setTargetAtTime(0.45, now, 0.3);
      }
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

    startRainAndCicadas() {
      this.startAmbience();
    }

    startAmbience() {
      if (!this.init() || this.ambientRunning) return;
      this.ambientRunning = true;
      const dest = this.ambientGain || this.lowpassDucking || this.masterGain;

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
      rainGain.gain.value = 0.72;

      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(dest);
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
      cicadaGain.gain.value = 0.032;

      cicadaCarrier.connect(cicadaBand);
      cicadaBand.connect(cicadaGain);
      cicadaGain.connect(dest);
      cicadaCarrier.start();
      cicadaMod.start();
    }

    update(dt, isTense, nearestThreatDist) {
      if (!this.ctx || this.muted || !this.ambientRunning) return;
      const safeDt = Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0.016));

      // Apply dynamic combat tension low-pass ducking
      if (!!isTense !== this.tensionActive) {
        this.setCombatTension(!!isTense);
      }

      // Occasional distant tropical thunder
      this.thunderTimer -= safeDt;
      if (this.thunderTimer <= 0) {
        this.thunderTimer = 18 + Math.random() * 22;
        this.playThunder(0.32);
      }

      // Accelerating 55 Hz Tension Heartbeat as guards close in
      if (isTense) {
        const dist = Number.isFinite(nearestThreatDist) ? nearestThreatDist : 400;
        const urgency = Math.max(0, Math.min(1, 1 - dist / 480));
        const interval = 0.82 - urgency * 0.38;
        this.heartbeatTimer -= safeDt;
        if (this.heartbeatTimer <= 0) {
          this.heartbeatTimer = interval;
          this.playHeartbeat(0.28 + urgency * 0.16);
        }
      } else {
        this.heartbeatTimer = 0;
      }
    }

    // Section 4.1 & 5: Surface-Aware Footstep Synthesizer ('mud' | 'ferns' | 'wood')
    playFootstep(surface) {
      if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
      const now = this.ctx.currentTime;
      if (now - this.lastFootstepTime < 0.14) return;
      this.lastFootstepTime = now;

      const surf = surface || 'mud';
      const out = this.sfxGain || this.masterGain;

      if (surf === 'ferns') {
        // High-frequency bandpass noise (2400 Hz) simulating brushing banana & fern fronds
        if (!this.noiseBuffer) return;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(2400 + Math.random() * 350, now);
        filt.Q.value = 1.9;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        src.connect(filt);
        filt.connect(gain);
        gain.connect(out);
        src.start(now);
        src.stop(now + 0.13);
        return;
      }

      if (surf === 'wood') {
        // Resonant square thump (110 -> 40 Hz) through hollow wooden plank body filter (Q = 4.2)
        const osc = this.ctx.createOscillator();
        const filt = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(110 + (Math.random() - 0.5) * 14, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.06);
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(210, now);
        filt.Q.value = 4.2;
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
        osc.connect(filt);
        filt.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + 0.08);
        return;
      }

      // Default: 'mud' — low-pass filtered burst (320 Hz) + wet pitch drop (160 -> 50 Hz) squelch
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160 + (Math.random() - 0.5) * 20, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.1);

      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(320, now);
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.16, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
        src.connect(filt);
        filt.connect(ng);
        ng.connect(out);
        src.start(now);
        src.stop(now + 0.09);
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
      gain.connect(this.ambientGain || this.masterGain);
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
      gain.connect(this.sfxGain || this.masterGain);
      osc.start(now);
      osc.stop(now + 0.025);
    }

    playLeafRustle() {
      if (!this.ctx || this.ctx.state !== 'running' || this.muted || !this.noiseBuffer) return;
      const now = this.ctx.currentTime;
      if (now - this.lastRustleTime < 0.24) return;
      this.lastRustleTime = now;

      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(2400 + Math.random() * 500, now);
      filt.Q.value = 1.6;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      src.connect(filt);
      filt.connect(gain);
      gain.connect(this.sfxGain || this.masterGain);
      src.start(now);
      src.stop(now + 0.2);
    }

    // Section 4.2 & 5: 3-Layer Visceral Parang Strike (Blade Whoosh + Cartilage Slice + Ink Spatter Micro-Clicks)
    playParangSlash(withHit) {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;

      // Layer 1: High-velocity blade whoosh (650 -> 180 Hz in 95ms)
      const whoosh = this.ctx.createOscillator();
      const whooshGain = this.ctx.createGain();
      whoosh.type = 'triangle';
      whoosh.frequency.setValueAtTime(650, now);
      whoosh.frequency.exponentialRampToValueAtTime(160, now + 0.11);
      whooshGain.gain.setValueAtTime(0.34, now);
      whooshGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      whoosh.connect(whooshGain);
      whooshGain.connect(out);
      whoosh.start(now);
      whoosh.stop(now + 0.13);

      // Layer 2: Meaty cartilage slice (exponential noise burst through 1350 Hz bandpass)
      const bufSize = Math.floor(this.ctx.sampleRate * 0.1);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1350, now);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(withHit ? 0.45 : 0.28, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(out);
      noise.start(now);

      // Layer 3: Blood-ink spatter micro-clicks at 0ms, 40ms, 80ms on impact
      if (withHit) {
        [0, 0.04, 0.08].forEach((offset, idx) => {
          const clk = this.ctx.createOscillator();
          const cg = this.ctx.createGain();
          clk.type = 'sine';
          clk.frequency.setValueAtTime(920 - idx * 180, now + offset);
          cg.gain.setValueAtTime(0.11 / (idx + 1), now + offset);
          cg.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.025);
          clk.connect(cg);
          cg.connect(out);
          clk.start(now + offset);
          clk.stop(now + offset + 0.03);
        });
      }
    }

    // Section 4.2: Crossbow Bolt Release (880 -> 110 Hz + subtle string buzz)
    playCrossbowTwang() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.065);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.15);

      const buzz = this.ctx.createOscillator();
      const bg = this.ctx.createGain();
      buzz.type = 'sawtooth';
      buzz.frequency.setValueAtTime(210, now);
      bg.gain.setValueAtTime(0.06, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      buzz.connect(bg);
      bg.connect(out);
      buzz.start(now);
      buzz.stop(now + 0.17);
    }

    // Section 4.2: Crossbow Bolt Wooden Impact Thud + Vibration Twang
    playBoltThud() {
      if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;
      const thud = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(95, now);
      thud.frequency.exponentialRampToValueAtTime(42, now + 0.09);
      tg.gain.setValueAtTime(0.32, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      thud.connect(tg);
      tg.connect(out);
      thud.start(now);
      thud.stop(now + 0.11);

      const twang = this.ctx.createOscillator();
      const twg = this.ctx.createGain();
      twang.type = 'sine';
      twang.frequency.setValueAtTime(340, now + 0.01);
      twang.frequency.exponentialRampToValueAtTime(240, now + 0.16);
      twg.gain.setValueAtTime(0.07, now + 0.01);
      twg.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      twang.connect(twg);
      twg.connect(out);
      twang.start(now + 0.01);
      twang.stop(now + 0.18);
    }

    // Section 4.2: 3-Layer Suppressed 9mm Shot (Pneumatic Pop + Mechanical Bolt Cycle + Delayed Brass Casing Clinks)
    playSuppressedShot() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;

      // Layer 1: Subsonic pneumatic gas release (220 Hz low-pass pop, 45ms decay)
      const pop = this.ctx.createOscillator();
      const filt = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      pop.type = 'sine';
      pop.frequency.setValueAtTime(220, now);
      pop.frequency.exponentialRampToValueAtTime(62, now + 0.055);
      filt.type = 'lowpass';
      filt.frequency.value = 320;
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      pop.connect(filt);
      filt.connect(gain);
      gain.connect(out);
      pop.start(now);
      pop.stop(now + 0.07);

      // Layer 2: Mechanical bolt cycle (1400 Hz click + slide reset at +40ms)
      [0.012, 0.052].forEach((offset, idx) => {
        const bolt = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        bolt.type = 'sawtooth';
        bolt.frequency.setValueAtTime(idx === 0 ? 1400 : 1680, now + offset);
        bg.gain.setValueAtTime(0.09, now + offset);
        bg.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.025);
        bolt.connect(bg);
        bg.connect(out);
        bolt.start(now + offset);
        bolt.stop(now + offset + 0.03);
      });

      // Layer 3: Delayed brass shell casing clink on ground (+0.35s & +0.44s at 2800 Hz / 2400 Hz)
      [
        { delay: 0.35, freq: 2800, vol: 0.055 },
        { delay: 0.44, freq: 2400, vol: 0.038 }
      ].forEach((ping) => {
        const casing = this.ctx.createOscillator();
        const cg = this.ctx.createGain();
        casing.type = 'sine';
        casing.frequency.setValueAtTime(ping.freq, now + ping.delay);
        cg.gain.setValueAtTime(ping.vol, now + ping.delay);
        cg.gain.exponentialRampToValueAtTime(0.001, now + ping.delay + 0.09);
        casing.connect(cg);
        cg.connect(out);
        casing.start(now + ping.delay);
        casing.stop(now + ping.delay + 0.1);
      });
    }

    playMercRifleShot() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;
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
        gain.connect(out);
        src.start(now);
        src.stop(now + 0.12);
      }
    }

    // Section 4.3: Ironclad Radio Alert Chirp (1200 Hz + 1650 Hz dual-tone + 80ms bandpassed static)
    playRadioAlert() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(1650, now + 0.07);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.17);

      if (this.noiseBuffer) {
        const staticSrc = this.ctx.createBufferSource();
        staticSrc.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2100, now + 0.11);
        bp.Q.value = 2.2;
        const sg = this.ctx.createGain();
        sg.gain.setValueAtTime(0.22, now + 0.11);
        sg.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        staticSrc.connect(bp);
        bp.connect(sg);
        sg.connect(out);
        staticSrc.start(now + 0.11);
        staticSrc.stop(now + 0.2);
      }
    }

    // Section 4.3: Mutated Boar Roar (85 -> 55 Hz sawtooth with 14 Hz vibrato LFO + rumbling pink noise)
    playBoarRoar() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;

      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const filt = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.linearRampToValueAtTime(55, now + 0.36);
      lfo.frequency.value = 14;
      lfoGain.gain.value = 18;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      filt.type = 'lowpass';
      filt.frequency.value = 460;
      gain.gain.setValueAtTime(0.36, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(filt);
      filt.connect(gain);
      gain.connect(out);
      osc.start(now);
      lfo.start(now);
      osc.stop(now + 0.4);
      lfo.stop(now + 0.4);

      if (this.noiseBuffer) {
        const rumble = this.ctx.createBufferSource();
        rumble.buffer = this.noiseBuffer;
        const rFilt = this.ctx.createBiquadFilter();
        rFilt.type = 'lowpass';
        rFilt.frequency.value = 260;
        const rg = this.ctx.createGain();
        rg.gain.setValueAtTime(0.28, now);
        rg.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        rumble.connect(rFilt);
        rFilt.connect(rg);
        rg.connect(out);
        rumble.start(now);
        rumble.stop(now + 0.36);
      }
    }

    // Section 4.3 & 5: Boar Concrete Wall Crash (Matador Concussion — Sub-Bass + Concrete Crack + 3200Hz Tinnitus Ring)
    playBoarWallCrash() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;

      // Sub-bass impact punch (75 -> 25 Hz at 0.9 gain)
      const punch = this.ctx.createOscillator();
      const punchGain = this.ctx.createGain();
      punch.type = 'triangle';
      punch.frequency.setValueAtTime(75, now);
      punch.frequency.exponentialRampToValueAtTime(25, now + 0.35);
      punchGain.gain.setValueAtTime(0.9, now);
      punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      punch.connect(punchGain);
      punchGain.connect(out);
      punch.start(now);
      punch.stop(now + 0.42);

      // Cracking concrete debris burst
      if (this.noiseBuffer) {
        const crack = this.ctx.createBufferSource();
        crack.buffer = this.noiseBuffer;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(820, now);
        const cg = this.ctx.createGain();
        cg.gain.setValueAtTime(0.55, now);
        cg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        crack.connect(filt);
        filt.connect(cg);
        cg.connect(out);
        crack.start(now);
        crack.stop(now + 0.26);
      }

      // Ear-ringing concussion tinnitus (3200 Hz fading over 1.8s)
      const ring = this.ctx.createOscillator();
      const ringGain = this.ctx.createGain();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(3200, now);
      ringGain.gain.setValueAtTime(0.11, now);
      ringGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      ring.connect(ringGain);
      ringGain.connect(out);
      ring.start(now);
      ring.stop(now + 1.85);
    }

    // Backward-compatible alias for boar wall stun & impacts
    playBoarImpact() {
      this.playBoarWallCrash();
    }

    // Section 4.3: Perimeter Blast Door Opening (Hydraulic Pneumatic Hiss + 38Hz Gear Grinding + Two-Tone Klaxon)
    playBlastGateOpen() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;

      // Layer 1: High-pressure pneumatic hydraulic hiss fading over 1.8s
      if (this.noiseBuffer) {
        const hiss = this.ctx.createBufferSource();
        hiss.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(1800, now);
        const hg = this.ctx.createGain();
        hg.gain.setValueAtTime(0.42, now);
        hg.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
        hiss.connect(hp);
        hp.connect(hg);
        hg.connect(out);
        hiss.start(now);
        hiss.stop(now + 1.85);
      }

      // Layer 2: Deep iron gear grinding (38 Hz sawtooth through resonant lowpass)
      const gear = this.ctx.createOscillator();
      const gf = this.ctx.createBiquadFilter();
      const gg = this.ctx.createGain();
      gear.type = 'sawtooth';
      gear.frequency.setValueAtTime(38, now);
      gear.frequency.linearRampToValueAtTime(44, now + 1.5);
      gf.type = 'lowpass';
      gf.frequency.value = 180;
      gf.Q.value = 3.5;
      gg.gain.setValueAtTime(0.32, now);
      gg.gain.exponentialRampToValueAtTime(0.001, now + 1.75);
      gear.connect(gf);
      gf.connect(gg);
      gg.connect(out);
      gear.start(now);
      gear.stop(now + 1.8);

      // Layer 3: Emergency warning two-tone klaxon (580 Hz / 440 Hz)
      this.playAlarmKlaxon();
    }

    playDecoyClatter() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;
      [0, 0.06, 0.11].forEach((offset, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(760 - idx * 140, now + offset);
        gain.gain.setValueAtTime(0.18 / (idx + 1), now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now + offset);
        osc.stop(now + offset + 0.055);
      });
    }

    playAlarmKlaxon() {
      if (!this.init() || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.setValueAtTime(440, now + 0.22);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.5);
    }

    playHeartbeat(vol) {
      if (!this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      const out = this.sfxGain || this.masterGain;
      const baseVol = vol || 0.35;
      [0, 0.15].forEach((delay, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, now + delay);
        gain.gain.setValueAtTime(i === 0 ? baseVol : baseVol * 0.68, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.14);
        osc.connect(gain);
        gain.connect(out);
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
  global.BelumGame.BelumTripleAAudioEngine = SoundEngine;
})(typeof window !== 'undefined' ? window : globalThis);
