// src/main.js - Belum: Protocol Zero (Act 1) AAA Polish Master Game Loop & State Coordinator
// Includes: 45ms Combat Hit-Stop, Ink-Bleed Puddles, Directional Trauma, Haptics, Foliage Rustle,
// Wet Mud Footprints, Boar Matador Wall-Stun, Diegetic Calligraphy Badges & Sector Checkpoint Auto-Save.
(function (global) {
  'use strict';

  const CHECKPOINT_KEY = 'belum_checkpoint';
  const CHECKPOINT_VERSION = 1;
  const SETTINGS_KEY = 'belum_settings';
  const SECTOR_SPAWNS = {
    1: { x: 185, y: 645 },
    2: { x: 1110, y: 640 },
    3: { x: 2205, y: 650 },
    4: { x: 3255, y: 640 }
  };

  function isStringArray(arr) {
    return Array.isArray(arr) && arr.every((v) => typeof v === 'string');
  }

  function validateCheckpoint(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, reason: 'damaged', data: null };
    }
    const migrated = Object.assign({}, data);
    if (migrated.version === undefined) {
      // Migrate legacy unversioned checkpoint to version 1
      migrated.version = CHECKPOINT_VERSION;
      migrated.collectedPickups = [];
      migrated.deadMercs = [];
      migrated.deadBoars = [];
      migrated.flags = {};
    } else {
      if (!Number.isInteger(migrated.version)) {
        return { ok: false, reason: 'damaged', data: null };
      }
      if (migrated.version > CHECKPOINT_VERSION) {
        return { ok: false, reason: 'newer', data: null };
      }
      if (migrated.version < 1) {
        return { ok: false, reason: 'damaged', data: null };
      }
    }

    if (!Number.isInteger(migrated.sector) || migrated.sector < 1 || migrated.sector > 4) {
      return { ok: false, reason: 'damaged', data: null };
    }

    if (migrated.ammo !== undefined) {
      if (!migrated.ammo || typeof migrated.ammo !== 'object' || Array.isArray(migrated.ammo)) {
        return { ok: false, reason: 'damaged', data: null };
      }
      const keys = Object.keys(migrated.ammo);
      for (let i = 0; i < keys.length; i++) {
        const v = migrated.ammo[keys[i]];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
          return { ok: false, reason: 'damaged', data: null };
        }
      }
    }

    if (!isStringArray(migrated.collectedPickups)) {
      return { ok: false, reason: 'damaged', data: null };
    }
    if (!isStringArray(migrated.deadMercs)) {
      return { ok: false, reason: 'damaged', data: null };
    }
    if (!isStringArray(migrated.deadBoars)) {
      return { ok: false, reason: 'damaged', data: null };
    }
    if (migrated.flags !== undefined && (!migrated.flags || typeof migrated.flags !== 'object' || Array.isArray(migrated.flags))) {
      return { ok: false, reason: 'damaged', data: null };
    }
    migrated.flags = migrated.flags || {};

    return { ok: true, reason: null, data: migrated };
  }

  class BelumProtocolZeroGame {
    constructor() {
      this.ns = global.BelumGame || {};
      this.canvas = typeof document !== 'undefined' ? document.getElementById('game-canvas') : null;
      this.mode = 'PROLOGUE'; // 'PROLOGUE' | 'PLAYING' | 'CAMP' | 'VICTORY' | 'GAME_OVER'
      this.lastTs = 0;
      this.rafId = null;
      this.hitStopTimer = 0;

      // Core subsystems
      this.sound = this.ns.SoundEngine ? new this.ns.SoundEngine() : null;
      this.renderer = this.ns.Renderer25D && this.canvas ? new this.ns.Renderer25D(this.canvas) : null;
      this.camera = this.ns.Camera25D ? new this.ns.Camera25D(1280, 720, 4200, 1320) : null;
      this.input = this.ns.InputManager
        ? new this.ns.InputManager(this.canvas, {
            isGameplayActive: () => this.mode === 'PLAYING',
            onToggleMute: () => this._toggleMute(),
            onOpenDossier: () => this.hud && this.hud.openUtility('dossier'),
            onUserGesture: () => {
              if (this.sound) this.sound.unlock();
            }
          })
        : null;

      this.camp = this.ns.BivouacCamp
        ? new this.ns.BivouacCamp({
            onClose: () => {
              if (this.mode === 'CAMP') {
                this.mode = 'PLAYING';
                if (this.input) this.input.clearActions();
              }
            },
            onCraftSuccess: () => {
              if (this.sound) this.sound.playDecoyClatter();
              this._saveSectorCheckpoint(this.currentSectorId, true);
            },
            onDriveDecrypted: (entry) => {
              this.stats.drivesDecrypted++;
              if (this.sound) this.sound.playRadioAlert();
              if (this.hud) this.hud.showToast(`DECRYPTED: ${entry.title}`, 3.5);
              this._saveSectorCheckpoint(this.currentSectorId, true);
            }
          })
        : null;

      this.settings = this._loadSettings();
      this._applySettings();

      this.hud = this.ns.HUDController
        ? new this.ns.HUDController({
            onOpenCamp: () => this.tryOpenCamp(),
            onSelectWeapon: (wid) => this._selectWeapon(wid),
            onToggleMute: () => this._toggleMute(),
            onAudioBadgeClick: () => this._handleAudioBadgeClick(),
            onUpdateSettings: (patch) => this._updateSettings(patch),
            getSnapshot: () => ({
              player: this.player,
              audioMuted: this.sound ? this.sound.muted : false,
              settings: Object.assign({}, this.settings)
            })
          })
        : null;

      this.prologue = this.ns.PrologueController
        ? new this.ns.PrologueController(this.sound, () => this.startGameplay())
        : null;

      this._bindEndgameAndResize();
      this.resetAct1();
      if (this.prologue) {
        this.prologue.start();
      } else {
        this.startGameplay();
      }
      this._startLoop();
    }

    _loadSettings() {
      const defaults = { version: 1, shake: 100, reduceFlash: false };
      if (typeof localStorage === 'undefined') return defaults;
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaults;
        const shake = Number.isFinite(parsed.shake) ? Math.max(0, Math.min(100, Math.round(parsed.shake))) : 100;
        const reduceFlash = typeof parsed.reduceFlash === 'boolean' ? parsed.reduceFlash : false;
        return { version: 1, shake, reduceFlash };
      } catch (_) {
        return defaults;
      }
    }

    _saveSettings() {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
          version: 1,
          shake: this.settings.shake,
          reduceFlash: !!this.settings.reduceFlash
        }));
      } catch (_) {
        // Ignore storage errors and keep in-memory settings
      }
    }

    _applySettings() {
      if (this.camera && typeof this.camera.setShakeStrength === 'function') {
        this.camera.setShakeStrength((this.settings.shake || 0) / 100);
      }
      global.BelumGame = global.BelumGame || {};
      global.BelumGame.reduceFlash = !!this.settings.reduceFlash;
    }

    _updateSettings(patch) {
      if (!patch || typeof patch !== 'object') return;
      if (Number.isFinite(patch.shake)) {
        this.settings.shake = Math.max(0, Math.min(100, Math.round(patch.shake)));
      }
      if (typeof patch.reduceFlash === 'boolean') {
        this.settings.reduceFlash = patch.reduceFlash;
      }
      this._applySettings();
      this._saveSettings();
    }

    _vibrate(pattern) {
      if (this.ns.InputManager && typeof this.ns.InputManager.vibrate === 'function') {
        this.ns.InputManager.vibrate(pattern);
      }
    }

    triggerHitStop(durationMs) {
      const ms = Number.isFinite(durationMs) ? durationMs : 45;
      this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000.0);
    }

    _spawnInkPuddle(x, y, baseRadius) {
      const r = baseRadius || 30;
      this.inkPuddles.push({
        x,
        y,
        baseRadius: r,
        age: 0,
        growDuration: 2.4,
        lobes: [
          { rx: r, ry: r * 0.62, ox: 0, oy: 0, rot: (Math.random() - 0.5) * 0.5 },
          { rx: r * 0.72, ry: r * 0.48, ox: (Math.random() - 0.5) * r * 0.9, oy: (Math.random() - 0.5) * r * 0.45, rot: Math.random() * Math.PI },
          { rx: r * 0.58, ry: r * 0.38, ox: (Math.random() - 0.5) * r * 1.1, oy: (Math.random() - 0.5) * r * 0.55, rot: Math.random() * Math.PI }
        ]
      });
    }

    _spawnLeafSpecks(x, y, count) {
      const n = count || 3;
      for (let i = 0; i < n; i++) {
        this.leafParticles.push({
          x: x + (Math.random() - 0.5) * 28,
          y: y + (Math.random() - 0.5) * 18,
          vx: (Math.random() - 0.5) * 44,
          vy: -28 - Math.random() * 28,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 8,
          age: 0,
          duration: 0.75 + Math.random() * 0.35
        });
      }
    }

    _bindEndgameAndResize() {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      const onResize = () => {
        const w = window.innerWidth || 1280;
        const h = window.innerHeight || 720;
        if (this.renderer) this.renderer.resize(w, h);
        if (this.camera) this.camera.resize(w, h);
      };
      window.addEventListener('resize', onResize);
      onResize();

      const btnRetrySector = document.getElementById('btn-retry-sector');
      if (btnRetrySector) {
        btnRetrySector.addEventListener('click', () => {
          const modal = document.getElementById('endgame-modal');
          if (modal) modal.classList.add('hidden');
          this.retryFromCheckpoint();
        });
      }

      const btnRestart = document.getElementById('btn-restart-game');
      if (btnRestart) {
        btnRestart.addEventListener('click', () => {
          const modal = document.getElementById('endgame-modal');
          if (modal) modal.classList.add('hidden');
          this._clearCheckpoint();
          this.resetAct1();
          this.startGameplay();
        });
      }
    }

    _saveSectorCheckpoint(sectorId, silent) {
      if (!this.player || typeof localStorage === 'undefined') return;
      try {
        const items = (this.level && this.level.interactables) || [];
        const collectedPickups = items.filter((it) => it && it.collected && it.id).map((it) => String(it.id));
        const deadMercs = (this.mercenaries || []).filter((m) => m && m.dead && m.id).map((m) => String(m.id));
        const deadBoars = (this.boars || []).filter((b) => b && b.dead && b.id).map((b) => String(b.id));
        const data = {
          version: CHECKPOINT_VERSION,
          sector: sectorId || 1,
          spawn: SECTOR_SPAWNS[sectorId] || SECTOR_SPAWNS[1],
          activeWeapon: this.player.activeWeapon,
          unlockedWeapons: Object.assign({}, this.player.unlockedWeapons),
          ammo: Object.assign({}, this.player.ammo),
          inventory: JSON.parse(JSON.stringify(this.player.inventory)),
          collectedPickups,
          deadMercs,
          deadBoars,
          flags: {
            generatorSabotaged: !!(this.level && this.level.generatorSabotaged),
            culvertUnlocked: !!(this.level && this.level.culvertUnlocked),
            blastGateOpen: !!(this.level && this.level.blastGateOpen),
            drivesDecrypted: this.stats ? this.stats.drivesDecrypted : 0
          }
        };
        localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(data));
        if (!silent && this.hud) {
          this.hud.showToast(`CHECKPOINT SAVED // SECTOR ${sectorId}`, 2.4);
        }
      } catch (_) {
        if (this.hud) {
          this.hud.showToast('CHECKPOINT NOT SAVED (storage blocked)', 3.0);
        }
      }
    }

    _hasSavedCheckpointKey() {
      if (typeof localStorage === 'undefined') return false;
      try {
        return localStorage.getItem(CHECKPOINT_KEY) !== null;
      } catch (_) {
        return false;
      }
    }

    _loadCheckpoint(notifyOnError) {
      if (typeof localStorage === 'undefined') return null;
      let raw = null;
      try {
        raw = localStorage.getItem(CHECKPOINT_KEY);
      } catch (_) {
        return null;
      }
      if (!raw) return null;

      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        this._clearCheckpoint();
        if (notifyOnError && this.hud) {
          this.hud.showToast('Checkpoint was damaged and has been reset.', 3.4);
        }
        return null;
      }

      const result = validateCheckpoint(parsed);
      if (!result.ok) {
        if (result.reason === 'newer') {
          if (notifyOnError && this.hud) {
            this.hud.showToast('Checkpoint is from a newer version and was not loaded.', 3.4);
          }
          return null;
        }
        this._clearCheckpoint();
        if (notifyOnError && this.hud) {
          this.hud.showToast('Checkpoint was damaged and has been reset.', 3.4);
        }
        return null;
      }
      return result.data;
    }

    _clearCheckpoint() {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.removeItem(CHECKPOINT_KEY);
      } catch (_) {}
    }

    retryFromCheckpoint() {
      const cp = this._loadCheckpoint(true);
      this.resetAct1();
      let restored = false;
      if (cp && this.player) {
        restored = true;
        const sp = cp.spawn || SECTOR_SPAWNS[cp.sector] || SECTOR_SPAWNS[1];
        this.player.x = sp.x;
        this.player.y = sp.y;
        this.player.hp = this.player.maxHp;
        this.player.stamina = this.player.maxStamina;
        if (cp.unlockedWeapons) this.player.unlockedWeapons = Object.assign({}, this.player.unlockedWeapons, cp.unlockedWeapons);
        if (cp.ammo) this.player.ammo = Object.assign({}, this.player.ammo, cp.ammo);
        if (cp.inventory) this.player.inventory = Object.assign({}, this.player.inventory, cp.inventory);
        if (cp.activeWeapon && this.player.unlockedWeapons[cp.activeWeapon]) {
          this.player.activeWeapon = cp.activeWeapon;
        }

        // Fix 4: Restore saved world state without spawning ink puddles or toasts
        if (this.level && Array.isArray(cp.collectedPickups)) {
          const collectedSet = new Set(cp.collectedPickups);
          const items = this.level.interactables || [];
          for (let i = 0; i < items.length; i++) {
            if (collectedSet.has(String(items[i].id))) {
              items[i].collected = true;
            }
          }
        }
        if (Array.isArray(cp.deadMercs)) {
          const deadMercSet = new Set(cp.deadMercs);
          for (let i = 0; i < this.mercenaries.length; i++) {
            const m = this.mercenaries[i];
            if (deadMercSet.has(String(m.id))) {
              m.hp = 0;
              m.dead = true;
              m.state = 'DEAD';
              m.suspicionMeter = 0;
            }
          }
        }
        if (Array.isArray(cp.deadBoars)) {
          const deadBoarSet = new Set(cp.deadBoars);
          for (let i = 0; i < this.boars.length; i++) {
            const b = this.boars[i];
            if (deadBoarSet.has(String(b.id))) {
              b.hp = 0;
              b.dead = true;
              b.state = 'DEAD';
            }
          }
        }
        if (cp.flags && this.level) {
          if (cp.flags.generatorSabotaged) {
            this.level.generatorSabotaged = true;
            for (let f = 0; f < this.level.floodlights.length; f++) {
              if (this.level.floodlights[f].sector === 2) this.level.floodlights[f].active = false;
            }
          }
          if (cp.flags.culvertUnlocked) {
            this.level.culvertUnlocked = true;
            const grate = this.level.obstacles.find((o) => o.id === 'culvert_grate');
            if (grate) grate.unlocked = true;
          }
          if (cp.flags.blastGateOpen) {
            this.level.blastGateOpen = true;
            const gateObs = this.level.obstacles.find((o) => o.id === 'blast_gate');
            if (gateObs) gateObs.openProgress = 1;
          }
          if (Number.isFinite(cp.flags.drivesDecrypted) && this.stats) {
            this.stats.drivesDecrypted = cp.flags.drivesDecrypted;
          }
        }

        this.currentSectorId = cp.sector || 1;
        this.highestSavedSector = this.currentSectorId;
        if (this.camera) this.camera.snapTo(this.player.centerX, this.player.centerY);
      }
      this.mode = 'PLAYING';
      if (this.input) this.input.clearActions();
      if (this.hud) {
        this.hud.show();
        if (restored) {
          this.hud.showToast(`RESPAWNED AT SECTOR ${this.currentSectorId} CHECKPOINT`, 2.8);
        }
      }
    }

    resetAct1() {
      this.level = this.ns.createAct1Level ? this.ns.createAct1Level() : null;
      const sx = this.level ? this.level.spawn.x : 185;
      const sy = this.level ? this.level.spawn.y : 645;
      this.player = this.ns.Player ? new this.ns.Player(sx, sy) : null;

      this.mercenaries = this.level ? this.level.mercenaries : [];
      this.boars = this.level ? this.level.boars : [];
      this.projectiles = [];
      this.acousticRings = [];
      this.floatingTexts = [];
      this.slashEffects = [];
      this.inkPuddles = [];
      this.footprints = [];
      this.leafParticles = [];
      this.diegeticBadge = null;

      this.elapsedSec = 0;
      this.hitStopTimer = 0;
      this.inCombat = false;
      this.currentSectorId = 1;
      this.highestSavedSector = 1;
      this.currentSectorLabel = 'SECTOR 1 // SUNGAI BELUM RIVERBANK';
      this.interactHint = '';
      this.klaxonTimer = 0;
      this.footprintDistAccum = 0;
      this.footprintStepSide = 1;
      this.lastPlayerPos = { x: sx, y: sy };

      this.stats = {
        stealthTakedowns: 0,
        enemiesNeutralized: 0,
        alertsTriggered: 0,
        drivesDecrypted: 0,
        factionInfightingHits: 0
      };

      if (this.camera && this.level && this.player) {
        this.camera.setWorldBounds(this.level.worldW, this.level.worldH);
        this.camera.snapTo(this.player.centerX, this.player.centerY);
      }
    }

    startGameplay() {
      this.mode = 'PLAYING';
      if (this.input) this.input.clearActions();
      if (this.sound) this.sound.unlock();
      if (!this._hasSavedCheckpointKey()) {
        this._saveSectorCheckpoint(1, true);
      }
      if (this.hud) {
        this.hud.show();
        this.hud.showToast('INSERTION COMPLETE — STAY LOW IN FERNS & BEHIND LOGS', 3.5);
      }
    }

    _handleAudioBadgeClick() {
      if (!this.sound) return;
      if (!this.sound.ctx || this.sound.ctx.state !== 'running') {
        this.sound.muted = false;
        this.sound.unlock();
        if (this.hud) this.hud.showToast('AUDIO ACTIVE — RAIN & CICADAS ONLINE', 1.8);
      } else {
        this._toggleMute();
      }
    }

    _toggleMute() {
      if (!this.sound) return;
      const muted = this.sound.toggleMute();
      if (this.hud) this.hud.showToast(muted ? 'AUDIO MUTED' : 'AUDIO UNMUTED', 1.6);
    }

    _selectWeapon(weaponId) {
      if (!this.player) return;
      if (this.player.selectWeapon(weaponId)) {
        if (this.hud) this.hud.showToast(`EQUIPPED: ${weaponId.toUpperCase()}`, 1.4);
      } else if (this.hud) {
        this.hud.showToast(`${weaponId.toUpperCase()} NOT YET ACQUIRED`, 1.8);
      }
    }

    tryOpenCamp() {
      if (this.mode === 'CAMP' && this.camp) {
        this.camp.close();
        return;
      }
      if (this.mode !== 'PLAYING') return;
      if (this.inCombat) {
        if (this.hud) this.hud.showToast('CANNOT RETREAT TO BIVOUAC WHILE IN COMBAT!', 2.4);
        return;
      }
      if (this.camp && this.player) {
        this.mode = 'CAMP';
        this.camp.open(this.player);
      }
    }

    _startLoop() {
      if (typeof requestAnimationFrame === 'undefined') return;
      const tick = (ts) => {
        if (!this.lastTs) this.lastTs = ts;
        const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
        this.lastTs = ts;

        if (this.mode === 'PLAYING') {
          if (this.hitStopTimer > 0) {
            // AAA 45ms Combat Hit-Stop: freeze entity logic while maintaining camera shake & particle rendering
            this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
            if (this.camera) this.camera.updateShakeOnly(dt);
          } else {
            this.update(dt);
          }
        }

        if (this.renderer) {
          this.renderer.render(this._getRenderState(), dt);
        }
        if (this.hud && this.mode === 'PLAYING') {
          this.hud.update(this._getHudState(), dt);
        }

        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }

    _getRenderState() {
      return {
        level: this.level,
        player: this.player,
        mercenaries: this.mercenaries,
        boars: this.boars,
        projectiles: this.projectiles,
        acousticRings: this.acousticRings,
        floatingTexts: this.floatingTexts,
        slashEffects: this.slashEffects,
        inkPuddles: this.inkPuddles,
        footprints: this.footprints,
        leafParticles: this.leafParticles,
        diegeticBadge: this.diegeticBadge,
        camera: this.camera
      };
    }

    _getObjectives() {
      const p = this.player;
      const l = this.level;
      if (!p || !l) return [];
      const s1GuardDead = this.mercenaries.some((m) => m.id === 'merc_s1_1' && m.dead);
      return [
        { id: 'arm', text: 'Equip Parang & Crossbow at Riverbank', done: p.unlockedWeapons.crossbow },
        { id: 's1', text: 'Stealth-neutralize Riverbank patrol guard', done: s1GuardDead },
        { id: 'drive', text: 'Recover Encrypted Drive 01 in Outpost', done: p.inventory.encryptedDrives > 0 || p.inventory.decryptedLore.length > 0 },
        { id: 'keycard', text: 'Acquire Tier-1 Security Keycard', done: p.inventory.hasKeycard },
        { id: 'ravine', text: 'Cross Infected Ravine (lure Boars w/ Rock)', done: p.x > 3140 },
        { id: 'gate', text: 'Swipe Keycard & survive 15s Blast Gate hold', done: l.blastGateOpen },
        { id: 'extract', text: 'Enter Facility Sub-Zero Extraction Zone', done: this.mode === 'VICTORY' }
      ];
    }

    _getHudState() {
      return {
        player: this.player,
        level: this.level,
        elapsedSec: this.elapsedSec,
        inCombat: this.inCombat,
        currentSectorLabel: this.currentSectorLabel,
        interactHint: this.interactHint,
        audioActive: this.sound ? this.sound.isActive() : false,
        audioStatusLabel: this.sound ? this.sound.getStatusLabel() : '[TAP TO UNMUTE]',
        objectives: this._getObjectives()
      };
    }

    update(dt) {
      if (!this.player || !this.level) return;
      this.elapsedSec += dt;

      // 1. Update Input & Consume Discrete Actions
      if (this.input) {
        this.input.update({ x: this.player.centerX, y: this.player.centerY }, this.camera);
        const actions = this.input.consumeActions();
        if (actions.toggleCamp) {
          this.tryOpenCamp();
          return;
        }
        if (actions.weaponSelect) this._selectWeapon(actions.weaponSelect);
        if (actions.dodge) this.player.triggerDodge(this.input.moveVector);
        if (actions.quickConsumable) {
          const res = this.player.useQuickConsumable();
          if (this.hud) this.hud.showToast(res.message, 2.2);
          if (res.used && this.sound) this.sound.playDecoyClatter();
        }
        if (actions.interact) this._handleInteractOrTakedown();
        if (actions.meleeSlash) this._performParangSlash();
        if (actions.attackRanged) this._performRangedOrDecoy();
        if (actions.attackPrimary) {
          if (this.player.activeWeapon === 'parang') this._performParangSlash();
          else this._performRangedOrDecoy();
        }
      }

      // 2. Update Player & AAA Spring Camera (with stealth/sprint zoom)
      const prevX = this.player.centerX;
      const prevY = this.player.centerY;
      this.player.update(dt, this.input, this.level);
      if (this.camera) {
        this.camera.update(
          dt,
          this.player.centerX,
          this.player.centerY,
          this.input ? this.input.aimVector : null,
          this.player
        );
      }

      // 3. Living Environmental Reactivity: Foliage Rustle & Wet Mud Footprints
      this._updateEnvironmentReactivity(dt, prevX, prevY);

      // 4. Sector Detection, Auto-Checkpoint & Hazards
      this._updateSectorAndHazards(dt);

      // 5. AI Updates (Mercenaries + Mutated Boars + Faction Infighting + Wall-Stun)
      const aiEvents = {
        onRadioAlert: (merc, faction) => {
          const alertFaction = faction || 'PLAYER';
          if (alertFaction === 'PLAYER') {
            this.stats.alertsTriggered++;
          }
          this._vibrate([30, 50]);
          if (this.sound) this.sound.playRadioAlert();
          this._spawnFloat(merc.centerX, merc.y - 24, alertFaction === 'FAUNA' ? 'BOAR!' : 'CONTACT!', '#F85A5A', false);
          for (let j = 0; j < this.mercenaries.length; j++) {
            const ally = this.mercenaries[j];
            if (!ally.dead && ally !== merc && Math.hypot(ally.centerX - merc.centerX, ally.centerY - merc.centerY) < 360) {
              ally.hearSound(merc.suspicionTarget ? merc.suspicionTarget.x : merc.centerX, merc.suspicionTarget ? merc.suspicionTarget.y : merc.centerY, false);
            }
          }
        },
        onMercFire: (merc, angle, damage) => {
          if (this.sound) {
            if (merc.role === 'commander') this.sound.playSuppressedShot();
            else this.sound.playMercRifleShot();
          }
          const Proj = this.ns.Projectile;
          if (Proj) {
            this.projectiles.push(
              new Proj({
                type: 'merc_bullet',
                faction: 'MERC',
                x: merc.centerX + Math.cos(angle) * 20,
                y: merc.centerY - 8 + Math.sin(angle) * 20,
                vx: Math.cos(angle) * 640,
                vy: Math.sin(angle) * 640,
                damage,
                maxRange: 540
              })
            );
          }
        },
        onMercKilled: (merc) => {
          this.stats.enemiesNeutralized++;
          this._spawnInkPuddle(merc.centerX, merc.y + merc.height - 6, merc.role === 'commander' ? 40 : 30);
          if (merc.role === 'commander') {
            this.player.inventory.hasKeycard = true;
            if (this.hud) this.hud.showToast('COMMANDER WARD ELIMINATED — TIER-1 CLEARANCE SECURED!', 3.2);
          }
        },
        onBoarTelegraph: (boar) => {
          if (this.sound) this.sound.playBoarRoar();
          this._spawnFloat(boar.centerX, boar.y - 16, '!!', '#F85A5A', true);
        },
        onBoarCharge: (boar) => {
          if (this.camera) this.camera.addTrauma(0.32, boar.chargeDirX, boar.chargeDirY);
        },
        onBoarImpact: (victim, dmg, label, boar) => {
          this.triggerHitStop(45);
          this._vibrate([40, 60, 80]);
          const dx = boar ? victim.centerX - boar.centerX : 1;
          const dy = boar ? victim.centerY - boar.centerY : 0;
          if (this.camera) this.camera.addTrauma(0.75, dx, dy);
          if (this.sound) this.sound.playBoarImpact();
          this._spawnFloat(victim.centerX, victim.y - 12, label || String(dmg), '#F85A5A', true);
          if (victim.faction === 'MERC') {
            this.stats.factionInfightingHits++;
            if (this.hud) this.hud.showToast('FACTION INFIGHTING: MUTATED BOAR GORED IRONCLAD PMC!', 2.6);
          }
        },
        onBoarWallStun: (boar) => {
          // AAA Matador Wall-Crash Concussion!
          this.triggerHitStop(45);
          this._vibrate([40, 60, 80]);
          if (this.camera) this.camera.addTrauma(0.8, -boar.chargeDirX, -boar.chargeDirY);
          if (this.sound) this.sound.playBoarWallCrash();
          this._spawnFloat(boar.centerX, boar.y - 18, 'CONCUSSED! (2.6s)', '#F85A5A', true);
          if (this.hud) this.hud.showToast('MATADOR STUN: BOAR SLAMMED INTO WALL!', 2.4);
        },
        onBoarKilled: (boar) => {
          this._spawnInkPuddle(boar.centerX, boar.y + boar.height - 6, 38);
          this._spawnFloat(boar.centerX, boar.y - 14, 'BOAR SLAIN', '#111E33', false);
        }
      };

      let anyAlert = false;
      let nearestAlertDist = Infinity;
      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        m.update(dt, this.player, this.boars, this.level, aiEvents);
        if (!m.dead) {
          const distToPlayer = Math.hypot(m.centerX - this.player.centerX, m.centerY - this.player.centerY);
          if (m.state === 'ALERT' && distToPlayer < 750) {
            anyAlert = true;
            if (distToPlayer < nearestAlertDist) nearestAlertDist = distToPlayer;
          }
          // AAA Stealth Detail: Mercenaries crossing fresh mud footprints get +20% suspicion & turn to inspect
          if (m.state === 'PATROL' && this.footprints.length > 0) {
            for (let f = this.footprints.length - 1; f >= 0; f--) {
              const fp = this.footprints[f];
              if (!fp.inspected && Math.hypot(m.centerX - fp.x, m.centerY - fp.y) < 46) {
                fp.inspected = true;
                m.inspectFootprint(fp.x, fp.y, fp.angle);
                this._spawnFloat(m.centerX, m.y - 18, 'TRACKS?', '#111E33', false);
                break;
              }
            }
          }
        }
      }
      for (let i = 0; i < this.boars.length; i++) {
        this.boars[i].update(dt, this.player, this.mercenaries, this.level, aiEvents);
      }
      this.inCombat = anyAlert || this.level.blastGateOpening;

      // 6. Update Projectiles & Collisions
      this._updateProjectiles(dt, aiEvents);

      // 7. Update Blast Gate 15-Second Opening Sequence & Victory Check
      this._updateBlastGateAndExtraction(dt, aiEvents);

      // 8. Update Visual FX (Ink Puddles, Footprints, Leaf Specks, Acoustic Rings, Slashes, Floats)
      this._updateVisualFx(dt);

      // 9. Compute Diegetic Calligraphic Action Badge & HUD Prompt
      this._computeInteractAndDiegeticBadge();

      // 10. Dynamic Tension Audio Ducking (450Hz lowpass) & Accelerating Heartbeat
      const isTense = this.inCombat || this.player.hp <= 3;
      if (this.sound) this.sound.update(dt, isTense, nearestAlertDist);

      // 11. Game Over Check
      if (this.player.dead) {
        this._triggerEndgame(false);
      }
    }

    _updateEnvironmentReactivity(dt, prevX, prevY) {
      const p = this.player;
      const obstacles = this.level.obstacles || [];

      // Update obstacle rustle timers & check entity overlap with ferns/bamboo
      for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (typeof obs.update === 'function') obs.update(dt);
        if (obs.type !== 'fern' && obs.type !== 'bamboo') continue;

        const pad = obs.type === 'bamboo' ? 14 : 6;
        // Player brushing foliage
        if (
          p.moving &&
          p.centerX >= obs.x - pad &&
          p.centerX <= obs.x + obs.width + pad &&
          p.centerY >= obs.y &&
          p.centerY <= obs.y + obs.height + pad
        ) {
          if (obs.triggerRustle(p.centerX - prevX || 1)) {
            this._spawnLeafSpecks(p.centerX, p.centerY - 14, 3);
            if (this.sound) this.sound.playLeafRustle();
          }
        }
      }

      // Surface-Aware Footstep Foley ('ferns' | 'wood' | 'mud') + Wet Mud Footprints (Sector 1 & 3)
      const moved = Math.hypot(p.centerX - prevX, p.centerY - prevY);
      const inMudZone = this.currentSectorId === 1 || this.currentSectorId === 3;
      if (moved > 0.2) {
        this.footprintDistAccum += moved;
        const stride = p.sprinting ? 38 : 32;
        if (this.footprintDistAccum >= stride) {
          this.footprintDistAccum = 0;
          this.footprintStepSide *= -1;
          if (this.sound) {
            const surface = p.isConcealed
              ? 'ferns'
              : (this.currentSectorId === 2 ? 'wood' : 'mud');
            this.sound.playFootstep(surface);
          }
          if (inMudZone) {
            const moveAng = Math.atan2(p.centerY - prevY, p.centerX - prevX);
            const perpX = -Math.sin(moveAng) * 5 * this.footprintStepSide;
            const perpY = Math.cos(moveAng) * 5 * this.footprintStepSide;
            this.footprints.push({
              x: p.centerX + perpX,
              y: p.y + p.height - 4 + perpY,
              angle: moveAng,
              age: 0,
              duration: 4.5,
              inspected: false
            });
          }
        }
      }
    }

    _performParangSlash() {
      const p = this.player;
      if (!p || p.attackCooldown > 0) return;
      p.attackCooldown = 0.42;
      p.parangAnimTimer = 0.5;
      if (p.animParang) p.animParang.reset();
      if (this.sound) this.sound.playParangSlash();
      this._vibrate(15);

      this.slashEffects.push({
        x: p.centerX,
        y: p.centerY - 8,
        angle: p.aimAngle,
        radius: 66,
        isStealth: false,
        age: 0,
        duration: 0.22
      });

      const reach = 78;
      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        if (m.dead) continue;
        const dx = m.centerX - p.centerX;
        const dy = m.centerY - p.centerY;
        const dist = Math.hypot(dx, dy);
        if (dist <= reach) {
          const isStealthTakedown = m.state !== 'ALERT' && m.isBehindMe(p.centerX, p.centerY);
          const dmg = isStealthTakedown ? 999 : 45;
          m.takeDamage(dmg, { x: p.centerX, y: p.centerY }, {
            onMercKilled: (killed) => {
              this.stats.enemiesNeutralized++;
              this._spawnInkPuddle(killed.centerX, killed.y + killed.height - 6, killed.role === 'commander' ? 40 : 30);
              if (isStealthTakedown) this.stats.stealthTakedowns++;
              if (killed.role === 'commander') {
                p.inventory.hasKeycard = true;
              }
            }
          });

          // Fix 6.5: Silent stealth takedowns feel quiet (0.2 trauma, no hit-stop); open melee keeps 45ms hit-stop
          if (!isStealthTakedown) {
            this.triggerHitStop(45);
          }
          if (this.camera) this.camera.addTrauma(isStealthTakedown ? 0.2 : 0.34, dx, dy);
          if (isStealthTakedown) {
            this._vibrate([25, 40, 25]);
            this.slashEffects[this.slashEffects.length - 1].isStealth = true;
            this._spawnFloat(m.centerX, m.y - 16, 'SILENT TAKEDOWN', '#F85A5A', true);
          } else {
            this._spawnFloat(m.centerX, m.y - 14, String(dmg), '#F85A5A', true);
          }
        }
      }

      for (let i = 0; i < this.boars.length; i++) {
        const b = this.boars[i];
        if (b.dead) continue;
        const dx = b.centerX - p.centerX;
        const dy = b.centerY - p.centerY;
        if (Math.hypot(dx, dy) <= reach + 10) {
          const dmg = b.takeDamage(45, { x: p.centerX, y: p.centerY }, {
            onBoarKilled: (killed) => {
              this._spawnInkPuddle(killed.centerX, killed.y + killed.height - 6, 38);
            }
          });
          this.triggerHitStop(45);
          if (this.camera) this.camera.addTrauma(0.4, dx, dy);
          this._spawnFloat(b.centerX, b.y - 14, String(dmg), '#F85A5A', true);
        }
      }
    }

    _performRangedOrDecoy() {
      const p = this.player;
      const Proj = this.ns.Projectile;
      if (!p || !Proj || p.attackCooldown > 0) return;

      let weapon = p.activeWeapon;
      if (weapon === 'parang') {
        if (p.unlockedWeapons.crossbow && p.ammo.crossbow > 0) weapon = 'crossbow';
        else if (p.unlockedWeapons.pistol && p.ammo.pistol > 0) weapon = 'pistol';
        else if (p.ammo.decoy > 0) weapon = 'decoy';
        else {
          if (this.hud) this.hud.showToast('NO RANGED AMMO — USE PARANG OR CRAFT AT CAMP [B]', 2.0);
          return;
        }
      }

      const ang = p.aimAngle;
      if (weapon === 'crossbow') {
        if (p.ammo.crossbow <= 0) {
          if (this.hud) this.hud.showToast('OUT OF BOLTS — RETRIEVE OR FLETCH AT CAMP [B]', 2.0);
          return;
        }
        p.ammo.crossbow--;
        p.attackCooldown = 0.55;
        this._vibrate(15);
        if (this.sound) this.sound.playCrossbowTwang();
        this.projectiles.push(
          new Proj({
            type: 'bolt',
            faction: 'PLAYER',
            x: p.centerX + Math.cos(ang) * 20,
            y: p.centerY - 8 + Math.sin(ang) * 20,
            vx: Math.cos(ang) * 680,
            vy: Math.sin(ang) * 680,
            damage: 55,
            maxRange: 450
          })
        );
      } else if (weapon === 'pistol') {
        if (p.ammo.pistol <= 0) {
          if (this.hud) this.hud.showToast('OUT OF 9MM ROUNDS — PRESS AT WORKBENCH [B]', 2.0);
          return;
        }
        p.ammo.pistol--;
        p.attackCooldown = 0.34;
        this._vibrate(20);
        if (this.sound) this.sound.playSuppressedShot();
        if (this.camera) this.camera.addTrauma(0.24, -Math.cos(ang), -Math.sin(ang));
        this.projectiles.push(
          new Proj({
            type: 'pistol9mm',
            faction: 'PLAYER',
            x: p.centerX + Math.cos(ang) * 20,
            y: p.centerY - 8 + Math.sin(ang) * 20,
            vx: Math.cos(ang) * 900,
            vy: Math.sin(ang) * 900,
            damage: 70,
            maxRange: 550
          })
        );
        this._emitAcousticRing(p.centerX, p.centerY, 120, false);
      } else if (weapon === 'decoy') {
        if (p.ammo.decoy <= 0) {
          if (this.hud) this.hud.showToast('OUT OF DECOY ROCKS', 1.6);
          return;
        }
        p.ammo.decoy--;
        p.attackCooldown = 0.5;
        this.projectiles.push(
          new Proj({
            type: 'decoy_rock',
            faction: 'PLAYER',
            x: p.centerX,
            y: p.centerY - 12,
            vx: Math.cos(ang) * 340,
            vy: Math.sin(ang) * 340,
            targetDist: 280,
            maxRange: 300
          })
        );
      }
    }

    _emitAcousticRing(x, y, radius, provokesBoars) {
      this.acousticRings.push({
        x,
        y,
        maxRadius: radius,
        age: 0,
        duration: 0.75,
        color: provokesBoars ? 'rgba(248, 90, 90, 0.65)' : 'rgba(17, 30, 51, 0.45)'
      });

      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        if (!m.dead && Math.hypot(m.centerX - x, m.centerY - y) <= radius) {
          m.hearSound(x, y, false);
        }
      }

      if (provokesBoars) {
        for (let i = 0; i < this.boars.length; i++) {
          const b = this.boars[i];
          if (b.dead) continue;
          if (Math.hypot(b.centerX - x, b.centerY - y) <= radius + 140) {
            let targetX = x;
            let targetY = y;
            let bestDist = 520;
            for (let j = 0; j < this.mercenaries.length; j++) {
              const m = this.mercenaries[j];
              if (m.dead) continue;
              const dm = Math.hypot(m.centerX - x, m.centerY - y);
              if (dm < bestDist) {
                bestDist = dm;
                targetX = m.centerX;
                targetY = m.centerY;
              }
            }
            b.provokeToward(targetX, targetY, {
              onBoarTelegraph: () => {
                if (this.sound) this.sound.playBoarRoar();
                this._spawnFloat(b.centerX, b.y - 16, 'PROVOKED!', '#F85A5A', true);
              }
            });
          }
        }
      }
    }

    _handleInteractOrTakedown() {
      const p = this.player;
      if (!p || !this.level) return;

      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        if (m.dead || m.state === 'ALERT') continue;
        const dist = Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY);
        if (dist <= 78 && m.isBehindMe(p.centerX, p.centerY)) {
          this._performParangSlash();
          return;
        }
      }

      for (let i = 0; i < this.boars.length; i++) {
        const b = this.boars[i];
        if (b.dead && !b.meatHarvested && Math.hypot(b.centerX - p.centerX, b.centerY - p.centerY) <= 85) {
          b.meatHarvested = true;
          p.inventory.boarMeat++;
          if (this.sound) this.sound.playParangSlash();
          if (this.hud) this.hud.showToast('HARVESTED BOAR MEAT — COOK JUNGLE STEW AT CAMP [B]', 2.6);
          return;
        }
      }

      const items = this.level.interactables || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.collected) continue;
        if (Math.hypot(it.x - p.centerX, it.y - p.centerY) > 75) continue;

        if (it.type === 'weapon_parang') {
          it.collected = true;
          p.unlockedWeapons.parang = true;
          p.inventory.hasParangPickup = true;
          if (this.hud) this.hud.showToast('ACQUIRED STEEL PARANG — APPROACH GUARDS FROM BEHIND', 2.8);
        } else if (it.type === 'weapon_crossbow') {
          it.collected = true;
          p.unlockedWeapons.crossbow = true;
          p.ammo.crossbow += 5;
          if (this.hud) this.hud.showToast('ACQUIRED SILENT CROSSBOW (+5 RETRIEVABLE BOLTS)', 2.8);
        } else if (it.type === 'weapon_pistol') {
          it.collected = true;
          p.unlockedWeapons.pistol = true;
          p.ammo.pistol += 8;
          if (this.hud) this.hud.showToast('ACQUIRED SUPPRESSED 9MM PISTOL (+8 ROUNDS)', 2.8);
        } else if (it.type === 'encrypted_drive') {
          it.collected = true;
          p.inventory.encryptedDrives++;
          if (this.hud) this.hud.showToast('RECOVERED VBS ENCRYPTED DRIVE — DECRYPT AT BIVOUAC [B]', 3.0);
        } else if (it.type === 'keycard') {
          it.collected = true;
          p.inventory.hasKeycard = true;
          if (this.hud) this.hud.showToast('ACQUIRED TIER-1 SECURITY KEYCARD', 3.0);
        } else if (it.type === 'dirty_water') {
          it.collected = true;
          p.inventory.dirtyWater++;
          if (this.hud) this.hud.showToast('COLLECTED DIRTY RAINWATER (+1)', 2.0);
        } else if (it.type === 'bamboo_shoots') {
          it.collected = true;
          p.inventory.bambooShoots += 2;
          if (this.hud) this.hud.showToast('FORAGED WILD BAMBOO SHOOTS (+2)', 2.0);
        } else if (it.type === 'scrap_wire') {
          it.collected = true;
          p.inventory.scrapWire += 2;
          if (this.hud) this.hud.showToast('SCAVENGED SCRAP WIRE (+2)', 2.0);
        } else if (it.type === 'decoy_rocks') {
          it.collected = true;
          p.ammo.decoy += 5;
          if (this.hud) this.hud.showToast('COLLECTED DECOY ROCKS (+5) — PRESS [4] TO LURE BOARS', 2.8);
        } else if (it.type === 'bolt_pickup') {
          it.collected = true;
          p.ammo.crossbow += 1;
          if (this.hud) this.hud.showToast('RETRIEVED CROSSBOW BOLT (+1)', 1.5);
        } else if (it.type === 'generator') {
          it.collected = true;
          this.level.generatorSabotaged = true;
          for (let f = 0; f < this.level.floodlights.length; f++) {
            if (this.level.floodlights[f].sector === 2) this.level.floodlights[f].active = false;
          }
          this._emitAcousticRing(it.x, it.y, 290, false);
          if (this.hud) this.hud.showToast('GENERATOR SABOTAGED — OUTPOST FLOODLIGHTS DARK!', 3.2);
        } else if (it.type === 'culvert_unlock') {
          if (!p.inventory.hasKeycard) {
            if (this.hud) this.hud.showToast('REQUIRES TIER-1 SECURITY KEYCARD FROM SECTOR 2', 2.5);
            return;
          }
          it.collected = true;
          this.level.culvertUnlocked = true;
          const grate = this.level.obstacles.find((o) => o.id === 'culvert_grate');
          if (grate) grate.unlocked = true;
          if (this.hud) this.hud.showToast('DRAINAGE CULVERT UNLOCKED — STEALTH BYPASS OPEN!', 3.0);
        } else if (it.type === 'blast_terminal') {
          if (!p.inventory.hasKeycard) {
            if (this.hud) this.hud.showToast('ACCESS DENIED — ACQUIRE TIER-1 KEYCARD FIRST!', 2.6);
            return;
          }
          it.collected = true;
          this.level.blastGateOpening = true;
          this.level.blastGateTimer = 15.0;
          if (this.sound) this.sound.playBlastGateOpen();
          if (this.camera) this.camera.addTrauma(0.55, -1, 0);
          if (this.hud) this.hud.showToast('BLAST GATE OVERRIDE INITIATED — SURVIVE 15 SECONDS!', 4.0);
          for (let mIdx = 0; mIdx < this.mercenaries.length; mIdx++) {
            const m = this.mercenaries[mIdx];
            if (!m.dead && m.sector === 4) {
              m.triggerAlert(p.centerX, p.centerY);
            }
          }
        }
        if (this.sound) this.sound.playDecoyClatter();
        return;
      }
    }

    _computeInteractAndDiegeticBadge() {
      const p = this.player;
      this.interactHint = '';
      this.diegeticBadge = null;
      if (!p || !this.level) return;

      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        if (!m.dead && m.state !== 'ALERT' && Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY) <= 78 && m.isBehindMe(p.centerX, p.centerY)) {
          this.interactHint = '[E / TAP] SILENT TAKEDOWN';
          this.diegeticBadge = { x: m.centerX, y: m.y, text: '[E / TAP] SILENT TAKEDOWN', urgent: true };
          return;
        }
      }
      for (let i = 0; i < this.boars.length; i++) {
        const b = this.boars[i];
        if (b.dead && !b.meatHarvested && Math.hypot(b.centerX - p.centerX, b.centerY - p.centerY) <= 85) {
          this.interactHint = '[E / TAP] HARVEST BOAR MEAT';
          this.diegeticBadge = { x: b.centerX, y: b.y, text: '[E / TAP] HARVEST BOAR MEAT', urgent: false };
          return;
        }
      }
      const items = this.level.interactables || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.collected && Math.hypot(it.x - p.centerX, it.y - p.centerY) <= 75) {
          let label = `[E / TAP] ${it.label.toUpperCase()}`;
          if (it.type === 'generator') label = '[E / TAP] SABOTAGE GENERATOR';
          else if (it.type === 'blast_terminal') label = '[E / TAP] SWIPE TIER-1 KEYCARD';
          else if (it.type === 'culvert_unlock') label = '[E / TAP] UNLOCK CULVERT HATCH';
          this.interactHint = label;
          this.diegeticBadge = { x: it.x, y: it.y, text: label, urgent: !!it.highlight };
          return;
        }
      }
    }

    _updateProjectiles(dt, aiEvents) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        const ev = pr.update(dt, this.level.obstacles);
        if (ev) {
          if (ev.event === 'DECOY_LANDED') {
            if (this.sound) this.sound.playDecoyClatter();
            this._emitAcousticRing(ev.x, ev.y, ev.radius, true);
            this._spawnFloat(ev.x, ev.y - 10, '*CLATTER*', '#111E33', false);
          } else if (ev.dropBolt) {
            if (this.sound) this.sound.playBoltThud();
            this.level.interactables.push({
              id: `bolt_${Date.now()}_${i}`,
              type: 'bolt_pickup',
              x: ev.x,
              y: ev.y,
              badge: 'BLT',
              label: 'Crossbow Bolt',
              collected: false
            });
          }
        }
        if (pr.dead) {
          this.projectiles.splice(i, 1);
          continue;
        }
        if (pr.type === 'decoy_rock') continue;

        if (pr.faction === 'PLAYER') {
          let hit = false;
          for (let j = 0; j < this.mercenaries.length; j++) {
            const m = this.mercenaries[j];
            if (m.dead) continue;
            if (Math.hypot(pr.x - m.centerX, pr.y - (m.y + m.height * 0.5)) < 26) {
              const dealt = m.takeDamage(pr.damage, { x: this.player.centerX, y: this.player.centerY }, aiEvents);
              this._spawnFloat(m.centerX, m.y - 14, String(dealt), '#F85A5A', true);
              if (pr.retrievable && this.sound) this.sound.playBoltThud();
              if (m.dead) this.triggerHitStop(35);
              if (pr.retrievable) {
                this.level.interactables.push({
                  id: `bolt_hit_${Date.now()}_${j}`,
                  type: 'bolt_pickup',
                  x: m.centerX,
                  y: m.centerY,
                  badge: 'BLT',
                  label: 'Crossbow Bolt',
                  collected: false
                });
              }
              pr.dead = true;
              hit = true;
              break;
            }
          }
          if (!hit) {
            for (let j = 0; j < this.boars.length; j++) {
              const b = this.boars[j];
              if (b.dead) continue;
              if (Math.hypot(pr.x - b.centerX, pr.y - b.centerY) < 32) {
                const dealt = b.takeDamage(pr.damage, { x: this.player.centerX, y: this.player.centerY }, aiEvents);
                this._spawnFloat(b.centerX, b.y - 14, String(dealt), '#F85A5A', true);
                pr.dead = true;
                break;
              }
            }
          }
        } else if (pr.faction === 'MERC') {
          if (!this.player.dead && Math.hypot(pr.x - this.player.centerX, pr.y - (this.player.y + this.player.height * 0.5)) < 22) {
            const dealt = this.player.takeDamage(pr.damage);
            if (dealt > 0) {
              this._vibrate([40, 60]);
              if (this.camera) this.camera.addTrauma(0.55, pr.vx, pr.vy);
              this._spawnFloat(this.player.centerX, this.player.y - 12, `-${dealt} HP`, '#F85A5A', true);
            }
            pr.dead = true;
          } else {
            for (let j = 0; j < this.boars.length; j++) {
              const b = this.boars[j];
              if (b.dead) continue;
              if (Math.hypot(pr.x - b.centerX, pr.y - b.centerY) < 32) {
                const dealt = b.takeDamage(18, { x: pr.startX, y: pr.startY }, aiEvents);
                this._spawnFloat(b.centerX, b.y - 14, String(dealt), '#F85A5A', false);
                pr.dead = true;
                break;
              }
            }
          }
        }

        if (pr.dead) this.projectiles.splice(i, 1);
      }
    }

    _updateSectorAndHazards(dt) {
      const p = this.player;
      const l = this.level;
      for (let i = 0; i < l.sectors.length; i++) {
        const s = l.sectors[i];
        if (p.centerX >= s.x && p.centerX < s.x + s.width) {
          this.currentSectorLabel = s.label;
          if (s.id !== this.currentSectorId) {
            this.currentSectorId = s.id;
            if (s.id > this.highestSavedSector) {
              this.highestSavedSector = s.id;
              this._saveSectorCheckpoint(s.id, false);
            }
          }
          break;
        }
      }

      let inSpore = false;
      for (let i = 0; i < l.sporeZones.length; i++) {
        const sp = l.sporeZones[i];
        if (Math.hypot(p.centerX - sp.x, p.centerY - sp.y) < sp.radius) {
          inSpore = true;
          break;
        }
      }
      if (inSpore) {
        p.sporeTickTimer += dt;
        if (p.sporeTickTimer >= 1.25) {
          p.sporeTickTimer = 0;
          const dealt = p.takeDamage(1);
          if (dealt > 0) {
            this._vibrate([40, 60]);
            this._spawnFloat(p.centerX, p.y - 12, 'BT-09 SPORE -1', '#F85A5A', false);
          }
        }
      } else {
        p.sporeTickTimer = 0;
      }

      for (let i = 0; i < l.tripwires.length; i++) {
        const lw = l.tripwires[i];
        if (!lw.active) continue;
        if (
          Math.abs(p.centerX - lw.x1) < 12 &&
          p.centerY >= Math.min(lw.y1, lw.y2) &&
          p.centerY <= Math.max(lw.y1, lw.y2)
        ) {
          lw.active = false;
          this._vibrate([30, 50]);
          if (this.sound) this.sound.playAlarmKlaxon();
          if (this.hud) this.hud.showToast('LASER TRIPWIRE TRIGGERED — SECTOR 4 ON ALERT!', 2.8);
          for (let mIdx = 0; mIdx < this.mercenaries.length; mIdx++) {
            const m = this.mercenaries[mIdx];
            if (!m.dead && m.sector === 4) m.triggerAlert(p.centerX, p.centerY);
          }
        }
      }
    }

    _updateBlastGateAndExtraction(dt, aiEvents) {
      const l = this.level;
      const p = this.player;
      const gateObs = l.obstacles.find((o) => o.id === 'blast_gate');

      if (l.blastGateOpening && !l.blastGateOpen) {
        l.blastGateTimer = Math.max(0, l.blastGateTimer - dt);
        this.klaxonTimer -= dt;
        if (this.klaxonTimer <= 0) {
          this.klaxonTimer = 2.8;
          if (this.sound) this.sound.playAlarmKlaxon();
        }
        if (gateObs) {
          gateObs.openProgress = Math.min(1, 1 - l.blastGateTimer / 15.0);
        }
        if (!l.reinforcementSpawned && l.blastGateTimer <= 9.0 && this.ns.Mercenary) {
          l.reinforcementSpawned = true;
          const resp = new this.ns.Mercenary({
            id: 'merc_s4_reinforce',
            sector: 4,
            x: 3260,
            y: 620,
            facingAngle: 0,
            waypoints: [{ x: 3680, y: 620 }]
          });
          resp.triggerAlert(p.centerX, p.centerY, aiEvents);
          this.mercenaries.push(resp);
          if (this.hud) this.hud.showToast('IRONCLAD RESPONDER APPROACHING FROM RAVINE!', 2.6);
        }

        if (l.blastGateTimer <= 0) {
          l.blastGateOpen = true;
          l.blastGateOpening = false;
          if (gateObs) gateObs.openProgress = 1;
          if (this.sound) this.sound.playThunder(0.5);
          if (this.hud) this.hud.showToast('BLAST GATE OPEN — CROSS THRESHOLD TO EXTRACT!', 4.0);
        }
      }

      if (l.blastGateOpen && l.extractionZone) {
        const ez = l.extractionZone;
        if (p.centerX >= ez.x && p.centerX <= ez.x + ez.width && p.centerY >= ez.y && p.centerY <= ez.y + ez.height) {
          this._triggerEndgame(true);
        }
      }
    }

    _updateVisualFx(dt) {
      // Expanding permanent fountain-pen ink puddles (grow over 2.4s)
      for (let i = 0; i < this.inkPuddles.length; i++) {
        if (this.inkPuddles[i].age < this.inkPuddles[i].growDuration) {
          this.inkPuddles[i].age += dt;
        }
      }
      // Wet mud footprints (dissolve after 4.5s)
      for (let i = this.footprints.length - 1; i >= 0; i--) {
        this.footprints[i].age += dt;
        if (this.footprints[i].age >= this.footprints[i].duration) {
          this.footprints.splice(i, 1);
        }
      }
      // Fluttering ink leaf specks
      for (let i = this.leafParticles.length - 1; i >= 0; i--) {
        const lf = this.leafParticles[i];
        lf.age += dt;
        lf.x += lf.vx * dt;
        lf.y += lf.vy * dt;
        lf.vy += 42 * dt; // gentle flutter gravity
        lf.rot += lf.vrot * dt;
        if (lf.age >= lf.duration) {
          this.leafParticles.splice(i, 1);
        }
      }
      for (let i = this.acousticRings.length - 1; i >= 0; i--) {
        this.acousticRings[i].age += dt;
        if (this.acousticRings[i].age >= this.acousticRings[i].duration) {
          this.acousticRings.splice(i, 1);
        }
      }
      for (let i = this.slashEffects.length - 1; i >= 0; i--) {
        this.slashEffects[i].age += dt;
        if (this.slashEffects[i].age >= this.slashEffects[i].duration) {
          this.slashEffects.splice(i, 1);
        }
      }
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.age += dt;
        ft.y -= 34 * dt;
        if (ft.age >= ft.duration) {
          this.floatingTexts.splice(i, 1);
        }
      }
    }

    _spawnFloat(x, y, text, color, bold) {
      this.floatingTexts.push({
        x,
        y,
        text,
        color: color || '#F85A5A',
        bold: !!bold,
        age: 0,
        duration: 1.05
      });
    }

    _triggerEndgame(victory) {
      this.mode = victory ? 'VICTORY' : 'GAME_OVER';
      if (typeof document === 'undefined') return;
      const modal = document.getElementById('endgame-modal');
      const stamp = document.getElementById('endgame-stamp');
      const title = document.getElementById('endgame-title');
      const desc = document.getElementById('endgame-desc');
      const statsEl = document.getElementById('endgame-stats');
      const btnRetry = document.getElementById('btn-retry-sector');

      if (stamp) stamp.textContent = victory ? 'OPERATION COMPLETE // ACT 1' : 'MIA // SIGNAL LOST';
      if (title) title.textContent = victory ? 'PERIMETER BLAST GATE BREACHED' : 'OPERATOR KANCIL DOWN';
      if (desc) {
        desc.textContent = victory
          ? 'Operator Kancil crossed the Temenggor Perimeter threshold into the surface warehouse complex above Facility Sub-Zero. Telemetry secured for Act 2.'
          : 'Ironclad forces or BT-09 mutated fauna overwhelmed your position. Stay low in dense ferns, bait boars into walls for a Matador stun, or retry from your last sector checkpoint.';
      }
      if (btnRetry) {
        const hasCp = !victory && this._hasSavedCheckpointKey();
        btnRetry.classList.toggle('hidden', !hasCp);
        if (hasCp) btnRetry.textContent = `RETRY CURRENT SECTOR (SECTOR ${this.currentSectorId})`;
      }
      if (statsEl) {
        const mins = Math.floor(this.elapsedSec / 60);
        const secs = Math.floor(this.elapsedSec % 60);
        statsEl.innerHTML = `
          <div class="stat-card"><span class="val">${mins}:${secs < 10 ? '0' : ''}${secs}</span>Time Elapsed</div>
          <div class="stat-card"><span class="val">${this.stats.stealthTakedowns}</span>Stealth Takedowns</div>
          <div class="stat-card"><span class="val">${this.stats.alertsTriggered}</span>Radio Alerts</div>
          <div class="stat-card"><span class="val">${this.stats.drivesDecrypted}</span>Drives Decrypted</div>
        `;
      }
      if (modal) modal.classList.remove('hidden');
    }
  }

  BelumProtocolZeroGame.validateCheckpoint = validateCheckpoint;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BelumProtocolZeroGame;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.BelumProtocolZeroGame = BelumProtocolZeroGame;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      window.belumGameInstance = new BelumProtocolZeroGame();
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
