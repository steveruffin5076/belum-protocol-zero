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

  const DIFFICULTY_PRESETS = {
    recruit:  { id: 'recruit',  label: 'Recruit',  maxHp: 14, guardBulletDmgMult: 0.7,  suspicionTimeMult: 1.4,  needsDrainMult: 0.6, medContainersDelta: 1 },
    operator: { id: 'operator', label: 'Operator', maxHp: 11, guardBulletDmgMult: 1.0,  suspicionTimeMult: 1.0,  needsDrainMult: 1.0, medContainersDelta: 0 },
    black_op: { id: 'black_op', label: 'Black Op', maxHp: 9,  guardBulletDmgMult: 1.25, suspicionTimeMult: 0.75, needsDrainMult: 1.3, medContainersDelta: -1 }
  };

  const VALID_WEAPONS = ['parang', 'crossbow', 'pistol', 'decoy'];
  const INVENTORY_SCHEMA = {
    hasParangPickup: 'boolean',
    hasLockerKey: 'boolean',
    hasBoltCutters: 'boolean',
    hasShedKey: 'boolean',
    hasPumpFuse: 'boolean',
    hasSafeCode: 'boolean',
    hasKeycard: 'boolean',
    encryptedDrives: 'number',
    decryptedLore: 'array',
    dirtyWater: 'number',
    pureWater: 'number',
    purificationTabs: 'number',
    bambooShoots: 'number',
    boarMeat: 'number',
    jungleStew: 'number',
    energyGel: 'number',
    medkit: 'number',
    bandage: 'number',
    tourniquet: 'number',
    filterMask: 'boolean',
    filterCartridge: 'number',
    sporeInjector: 'number',
    scrapWire: 'number',
    emptyCan: 'number',
    pebbles: 'number',
    flare: 'number',
    rag: 'number',
    diesel: 'number',
    radioParts: 'number',
    battery: 'number',
    tripwireFlares: 'number',
    smokeRags: 'number',
    radioJammers: 'number'
  };

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function isStringArray(arr) {
    return Array.isArray(arr) && arr.every((v) => typeof v === 'string');
  }

  function validateCheckpoint(data) {
    if (!isPlainObject(data)) {
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

    if (migrated.spawn !== undefined) {
      if (
        !isPlainObject(migrated.spawn) ||
        typeof migrated.spawn.x !== 'number' || !Number.isFinite(migrated.spawn.x) ||
        migrated.spawn.x < 0 || migrated.spawn.x > 4200 ||
        typeof migrated.spawn.y !== 'number' || !Number.isFinite(migrated.spawn.y) ||
        migrated.spawn.y < 0 || migrated.spawn.y > 1320
      ) {
        return { ok: false, reason: 'damaged', data: null };
      }
    }

    if (migrated.activeWeapon !== undefined) {
      if (typeof migrated.activeWeapon !== 'string' || !VALID_WEAPONS.includes(migrated.activeWeapon)) {
        return { ok: false, reason: 'damaged', data: null };
      }
    }

    if (migrated.unlockedWeapons !== undefined) {
      if (!isPlainObject(migrated.unlockedWeapons)) {
        return { ok: false, reason: 'damaged', data: null };
      }
      const wKeys = Object.keys(migrated.unlockedWeapons);
      for (let i = 0; i < wKeys.length; i++) {
        if (typeof migrated.unlockedWeapons[wKeys[i]] !== 'boolean') {
          return { ok: false, reason: 'damaged', data: null };
        }
      }
    }

    if (migrated.ammo !== undefined) {
      if (!isPlainObject(migrated.ammo)) {
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

    if (migrated.inventory !== undefined) {
      if (!isPlainObject(migrated.inventory)) {
        return { ok: false, reason: 'damaged', data: null };
      }
      const cleanInv = {};
      const invKeys = Object.keys(migrated.inventory);
      for (let i = 0; i < invKeys.length; i++) {
        const k = invKeys[i];
        if (!Object.prototype.hasOwnProperty.call(INVENTORY_SCHEMA, k)) {
          continue; // Drop unknown keys
        }
        const expected = INVENTORY_SCHEMA[k];
        const v = migrated.inventory[k];
        if (expected === 'number') {
          if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
            return { ok: false, reason: 'damaged', data: null };
          }
        } else if (expected === 'boolean') {
          if (typeof v !== 'boolean') {
            return { ok: false, reason: 'damaged', data: null };
          }
        } else if (expected === 'array') {
          if (!Array.isArray(v)) {
            return { ok: false, reason: 'damaged', data: null };
          }
        }
        cleanInv[k] = v;
      }
      migrated.inventory = cleanInv;
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
    if (migrated.flags !== undefined && !isPlainObject(migrated.flags)) {
      return { ok: false, reason: 'damaged', data: null };
    }
    migrated.flags = migrated.flags || {};

    if (migrated.proficiency !== undefined) {
      if (!isPlainObject(migrated.proficiency)) {
        return { ok: false, reason: 'damaged', data: null };
      }
      const cleanProf = { closeQuarters: 0, fieldcraft: 0, marksmanship: 0, fieldMedic: 0 };
      const pKeys = Object.keys(migrated.proficiency);
      for (let i = 0; i < pKeys.length; i++) {
        const k = pKeys[i];
        if (!Object.prototype.hasOwnProperty.call(cleanProf, k)) continue;
        const v = migrated.proficiency[k];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
          return { ok: false, reason: 'damaged', data: null };
        }
        cleanProf[k] = Math.floor(v);
      }
      migrated.proficiency = cleanProf;
    }

    return { ok: true, reason: null, data: migrated };
  }

  class BelumProtocolZeroGame {
    constructor() {
      this.ns = global.BelumGame || {};
      this.canvas = typeof document !== 'undefined' ? document.getElementById('game-canvas') : null;
      this.mode = 'PROLOGUE'; // 'PROLOGUE' | 'PLAYING' | 'PAUSED' | 'CAMP' | 'VICTORY' | 'GAME_OVER'
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
            onEscape: () => this._handleEscape(),
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
            onRestCheckpoint: () => {
              if (this.sound) this.sound.playDecoyClatter();
              this._saveSectorCheckpoint(this.currentSectorId, true);
              if (this.hud) this.hud.showToast('RESTED AT BASHA SITE — CHECKPOINT SAVED', 2.4);
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
            },
            onRadioHint: () => {
              if (this.sound) this.sound.playRadioAlert();
            }
          })
        : null;

      this.settings = this._loadSettings();
      this._applySettings();

      this.hud = this.ns.HUDController
        ? new this.ns.HUDController({
            onOpenCamp: () => this.tryOpenCampFromHud(),
            onSelectWeapon: (wid) => this._selectWeapon(wid),
            onToggleMute: () => this._toggleMute(),
            onAudioBadgeClick: () => this._handleAudioBadgeClick(),
            onUpdateSettings: (patch) => this._updateSettings(patch),
            onStartBandage: () => this.startBandage(),
            onToggleFilterMask: () => this._toggleFilterMask(),
            onUseSporeInjector: () => this._useSporeInjector(),
            onUtilityOpen: () => this._onUtilityOpen(),
            onUtilityClose: () => this._onUtilityClose(),
            getSnapshot: () => ({
              player: this.player,
              audioMuted: this.sound ? this.sound.muted : false,
              settings: Object.assign({}, this.settings),
              isPaused: this.mode === 'PAUSED'
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
      const defaults = { version: 1, shake: 100, reduceFlash: false, difficulty: 'operator' };
      if (typeof localStorage === 'undefined') return defaults;
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaults;
        const shake = Number.isFinite(parsed.shake) ? Math.max(0, Math.min(100, Math.round(parsed.shake))) : 100;
        const reduceFlash = typeof parsed.reduceFlash === 'boolean' ? parsed.reduceFlash : false;
        const difficulty = (typeof parsed.difficulty === 'string' && DIFFICULTY_PRESETS[parsed.difficulty]) ? parsed.difficulty : 'operator';
        return { version: 1, shake, reduceFlash, difficulty };
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
          reduceFlash: !!this.settings.reduceFlash,
          difficulty: this.settings.difficulty || 'operator'
        }));
      } catch (_) {
        // Ignore storage errors and keep in-memory settings
      }
    }

    _getDifficultyPreset() {
      const id = (this.settings && this.settings.difficulty) || 'operator';
      return DIFFICULTY_PRESETS[id] || DIFFICULTY_PRESETS.operator;
    }

    _applySettings() {
      if (this.camera && typeof this.camera.setShakeStrength === 'function') {
        this.camera.setShakeStrength((this.settings.shake || 0) / 100);
      }
      const preset = this._getDifficultyPreset();
      this.difficultyPreset = preset;
      global.BelumGame = global.BelumGame || {};
      global.BelumGame.reduceFlash = !!this.settings.reduceFlash;
      global.BelumGame.difficultyPreset = preset;
      if (this.player) {
        const bonusHp = (this.player.getProficiencyRank && this.player.getProficiencyRank('fieldMedic') >= 2) ? 1 : 0;
        const targetMax = preset.maxHp + bonusHp;
        const prevMax = this.player.maxHp || targetMax;
        const ratio = prevMax > 0 ? this.player.hp / prevMax : 1;
        this.player.maxHp = targetMax;
        this.player.hp = Math.max(1, Math.min(targetMax, Math.round(ratio * targetMax)));
      }
    }

    _recordProficiencyAction(key, delta) {
      const p = this.player;
      if (!p || !p.proficiency || !Object.prototype.hasOwnProperty.call(p.proficiency, key)) return;
      const beforeRank = p.getProficiencyRank(key);
      p.proficiency[key] += (delta || 1);
      const afterRank = p.getProficiencyRank(key);
      if (afterRank > beforeRank) {
        const msgs = {
          closeQuarters: {
            1: 'Close Quarters — Rank 1: faster takedowns (0.45s).',
            2: 'Close Quarters — Rank 2: silent body drag unlocked.'
          },
          fieldcraft: {
            1: 'Fieldcraft — Rank 1: footsteps quieter.',
            2: 'Fieldcraft — Rank 2: searches 25% faster.'
          },
          marksmanship: {
            1: 'Marksmanship — Rank 1: sway reduced.',
            2: 'Marksmanship — Rank 2: auto-recover bolts within 60px.'
          },
          fieldMedic: {
            1: 'Field Medic — Rank 1: bandage time 1.2s.',
            2: 'Field Medic — Rank 2: +1 max HP.'
          }
        };
        if (key === 'fieldMedic' && afterRank >= 2) {
          const preset = this._getDifficultyPreset();
          const newMax = preset.maxHp + 1;
          if (p.maxHp < newMax) {
            p.maxHp = newMax;
            p.hp = Math.min(p.maxHp, p.hp + 1);
          }
        }
        const toastMsg = msgs[key] && msgs[key][afterRank];
        if (toastMsg && this.hud) {
          this.hud.showToast(toastMsg, 3.6);
        }
      }
    }

    _getBandageDuration() {
      return (this.player && this.player.getProficiencyRank && this.player.getProficiencyRank('fieldMedic') >= 1) ? 1.2 : 2.0;
    }

    _getSearchTimeScale() {
      return (this.player && this.player.getProficiencyRank && this.player.getProficiencyRank('fieldcraft') >= 2) ? 0.75 : 1.0;
    }

    _updateSettings(patch) {
      if (!patch || typeof patch !== 'object') return;
      if (Number.isFinite(patch.shake)) {
        this.settings.shake = Math.max(0, Math.min(100, Math.round(patch.shake)));
      }
      if (typeof patch.reduceFlash === 'boolean') {
        this.settings.reduceFlash = patch.reduceFlash;
      }
      if (typeof patch.difficulty === 'string' && DIFFICULTY_PRESETS[patch.difficulty]) {
        this.settings.difficulty = patch.difficulty;
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
          proficiency: Object.assign({}, this.player.proficiency),
          collectedPickups,
          deadMercs,
          deadBoars,
          flags: {
            fenceCut: !!(this.level && this.level.fenceCut),
            outpostGateOpen: !!(this.level && this.level.outpostGateOpen),
            pumpPowered: !!(this.level && this.level.pumpPowered),
            culvertDrained: !!(this.level && this.level.culvertDrained),
            labSafeOpened: !!(this.level && this.level.labSafeOpened),
            generatorSabotaged: !!(this.level && this.level.generatorSabotaged),
            culvertUnlocked: !!(this.level && this.level.culvertUnlocked),
            blastGateOpen: !!(this.level && this.level.blastGateOpen),
            drivesDecrypted: this.stats ? this.stats.drivesDecrypted : 0,
            secondaryObjectives: (this.level && this.level.secondaryObjectives) ? Object.assign({}, this.level.secondaryObjectives) : {}
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
        if (cp.proficiency) {
          this.player.proficiency = Object.assign({}, this.player.proficiency, cp.proficiency);
          if (this.player.getProficiencyRank && this.player.getProficiencyRank('fieldMedic') >= 2) {
            const preset = this._getDifficultyPreset();
            this.player.maxHp = preset.maxHp + 1;
            this.player.hp = this.player.maxHp;
          }
        }
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
          const openGateById = (gateId) => {
            const gObs = this.level.obstacles.find((o) => o.id === gateId);
            if (gObs) {
              gObs.unlocked = true;
              gObs.solid = false;
            }
          };
          if (cp.flags.fenceCut) {
            this.level.fenceCut = true;
            openGateById('outpost_fence_gate');
          }
          if (cp.flags.outpostGateOpen) {
            this.level.outpostGateOpen = true;
            openGateById('outpost_east_gate');
          }
          if (cp.flags.pumpPowered) {
            this.level.pumpPowered = true;
            this.level.culvertDrained = true;
            openGateById('ravine_east_gate');
            openGateById('culvert_grate'); openGateById('culvert_entry_grate');
          }
          if (cp.flags.labSafeOpened) {
            this.level.labSafeOpened = true;
          }
          if (cp.flags.generatorSabotaged) {
            this.level.generatorSabotaged = true;
            for (let f = 0; f < this.level.floodlights.length; f++) {
              if (this.level.floodlights[f].sector === 2) this.level.floodlights[f].active = false;
            }
          }
          if (cp.flags.culvertUnlocked) {
            this.level.culvertUnlocked = true;
            openGateById('culvert_grate'); openGateById('culvert_entry_grate');
          }
          if (cp.flags.blastGateOpen) {
            this.level.blastGateOpen = true;
            const gateObs = this.level.obstacles.find((o) => o.id === 'blast_gate');
            if (gateObs) gateObs.openProgress = 1;
          }
          if (Number.isFinite(cp.flags.drivesDecrypted) && this.stats) {
            this.stats.drivesDecrypted = cp.flags.drivesDecrypted;
          }
          if (cp.flags.secondaryObjectives && typeof cp.flags.secondaryObjectives === 'object') {
            this.level.secondaryObjectives = Object.assign({}, this.level.secondaryObjectives, cp.flags.secondaryObjectives);
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
      if (this.player) {
        const preset = this._getDifficultyPreset();
        this.player.maxHp = preset.maxHp;
        this.player.hp = preset.maxHp;
      }

      this.mercenaries = this.level ? this.level.mercenaries : [];
      this.boars = this.level ? this.level.boars : [];
      this.drones = this.level ? (this.level.drones || []) : [];
      this.projectiles = [];
      this.acousticRings = [];
      this.floatingTexts = [];
      this.slashEffects = [];
      this.inkPuddles = [];
      this.footprints = [];
      this.bloodDrips = [];
      this.placedTripwireFlares = [];
      this.smokeClouds = [];
      this.placedJammers = [];
      global.BelumGame = global.BelumGame || {};
      global.BelumGame.activeSmokeClouds = this.smokeClouds;
      this.leafParticles = [];
      this.diegeticBadge = null;
      this.holdAction = null;

      this.elapsedSec = 0;
      this.hitStopTimer = 0;
      this.inCombat = false;
      this.currentSectorId = 1;
      this.highestSavedSector = 1;
      this._crossedSectors = new Set([1]);
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
      this._clearCheckpoint();
      this._saveSectorCheckpoint(1, true);
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

    _onUtilityOpen() {
      if (this.mode === 'PLAYING') {
        this.mode = 'PAUSED';
      }
    }

    _onUtilityClose() {
      if (this.mode === 'PAUSED') {
        this.mode = 'PLAYING';
        if (this.input) this.input.clearActions();
      }
    }

    _handleEscape() {
      if (!this.hud) return;
      if (this.hud.isUtilityOpen()) {
        this.hud.closeUtility();
      } else if (this.mode === 'PLAYING') {
        this.hud.openUtility('settings');
      }
    }

    _hasAlertGuard() {
      if (!Array.isArray(this.mercenaries)) return false;
      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        if (!m.dead && m.state === 'ALERT') return true;
      }
      return false;
    }

    _getNearbyBashaSite(maxDist) {
      if (!this.player || !this.level || !Array.isArray(this.level.bashaSites)) return null;
      const limit = Number.isFinite(maxDist) ? maxDist : 95;
      for (let i = 0; i < this.level.bashaSites.length; i++) {
        const site = this.level.bashaSites[i];
        if (Math.hypot(site.x - this.player.centerX, site.y - this.player.centerY) <= limit) {
          return site;
        }
      }
      return null;
    }

    _getNextHandlerHint() {
      const objs = this._getObjectives();
      for (let i = 0; i < objs.length; i++) {
        if (!objs[i].done) {
          return `GGK COMMAND: Next priority — ${objs[i].text}.`;
        }
      }
      return 'GGK COMMAND: Proceed to the extraction zone beyond the blast gate.';
    }

    tryOpenCamp(bashaSite) {
      if (this.mode === 'CAMP' && this.camp) {
        this.camp.close();
        return;
      }
      if (this.mode !== 'PLAYING') return;
      if (this.inCombat || this._hasAlertGuard()) {
        if (this.hud) this.hud.showToast('HOSTILES ON ALERT — CANNOT USE FIELD CACHE!', 2.6);
        return;
      }
      if (this.camp && this.player) {
        const site = bashaSite || this._getNearbyBashaSite(140) || { id: 'basha_field', label: 'Field Cache Basha', restedThisVisit: false };
        this.mode = 'CAMP';
        this.camp.open(this.player, site, () => this._getNextHandlerHint());
      }
    }

    tryOpenCampFromHud() {
      if (this.mode === 'CAMP' && this.camp) {
        this.camp.close();
        return;
      }
      if (this.mode !== 'PLAYING') return;
      const site = this._getNearbyBashaSite(110);
      if (!site) {
        if (this.hud) this.hud.showToast('FIND A HIDDEN BASHA SITE (FIELD CACHE) — HOLD [E] THERE TO REST & RESUPPLY', 2.8);
        return;
      }
      this.tryOpenCamp(site);
    }

    startBandage() {
      const p = this.player;
      if (!p || p.dead) return false;
      if (!p.bleeding) {
        if (this.hud) this.hud.showToast('NOT BLEEDING — NO BANDAGE NEEDED', 1.8);
        return false;
      }
      if ((p.inventory.bandage || 0) <= 0) {
        if (this.hud) this.hud.showToast('OUT OF BANDAGES — USE TOURNIQUET [Y] OR SALVAGE MED CASE', 2.4);
        return false;
      }
      if (this.holdAction && this.holdAction.type === 'bandage') return true;
      const dur = this._getBandageDuration();
      this.holdAction = {
        type: 'bandage',
        autoAdvance: true,
        x: p.centerX,
        y: p.y,
        elapsed: 0,
        duration: dur,
        label: `BANDAGING (${dur.toFixed(1)}s)`,
        onComplete: () => {
          if (p.inventory.bandage > 0) p.inventory.bandage--;
          p.bleeding = false;
          p.bleedTickTimer = 0;
          this._recordProficiencyAction('fieldMedic', 1);
          if (this.sound) this.sound.playDecoyClatter();
          if (this.hud) this.hud.showToast('PRESSURE BANDAGE APPLIED — BLEEDING STOPPED', 2.2);
        }
      };
      return true;
    }

    _toggleFilterMask() {
      if (!this.player) return;
      const res = this.player.toggleFilterMask();
      if (this.hud) this.hud.showToast(res.message, 2.2);
      if (res.ok && this.sound) this.sound.playDecoyClatter();
    }

    _useSporeInjector() {
      if (!this.player) return;
      const res = this.player.useSporeInjector();
      if (this.hud) this.hud.showToast(res.message, 2.4);
      if (res.ok) {
        this._recordProficiencyAction('fieldMedic', 1);
        if (this.sound) this.sound.playDecoyClatter();
      }
    }

    placeTripwireFlare() {
      const p = this.player;
      if (!p || (p.inventory.tripwireFlares || 0) <= 0) {
        if (this.hud) this.hud.showToast('NO TRIPWIRE FLARES — IMPROVISE AT A FIELD WORKBENCH', 2.0);
        return false;
      }
      p.inventory.tripwireFlares--;
      this.placedTripwireFlares.push({
        id: `tf_${Date.now()}`,
        x: p.centerX,
        y: p.centerY + 8,
        active: true
      });
      if (this.sound) this.sound.playDecoyClatter();
      if (this.hud) this.hud.showToast('TRIPWIRE FLARE SET — BLINDS GUARDS 3s & PROVOKES BOARS', 2.4);
      return true;
    }

    throwSmokeRag() {
      const p = this.player;
      if (!p || (p.inventory.smokeRags || 0) <= 0) {
        if (this.hud) this.hud.showToast('NO DIESEL SMOKE RAGS — IMPROVISE AT A FIELD WORKBENCH', 2.0);
        return false;
      }
      p.inventory.smokeRags--;
      const tx = p.centerX + Math.cos(p.aimAngle) * 135;
      const ty = p.centerY + Math.sin(p.aimAngle) * 135;
      this.smokeClouds.push({ x: tx, y: ty, radius: 98, ttl: 6.0 });
      if (this.sound) this.sound.playDecoyClatter();
      if (this.hud) this.hud.showToast('DIESEL SMOKE SCREEN DEPLOYED (6s VISION BLOCK)', 2.2);
      return true;
    }

    placeRadioJammer() {
      const p = this.player;
      if (!p || (p.inventory.radioJammers || 0) <= 0) {
        if (this.hud) this.hud.showToast('NO RADIO JAMMERS — IMPROVISE AT A FIELD WORKBENCH', 2.0);
        return false;
      }
      p.inventory.radioJammers--;
      this.placedJammers.push({ x: p.centerX, y: p.centerY + 6, radius: 340, ttl: 20.0 });
      if (this.sound) this.sound.playRadioAlert();
      if (this.hud) this.hud.showToast('RADIO JAMMER ACTIVE — GUARD ALLY CALLS BLOCKED FOR 20s', 2.6);
      return true;
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
        drones: this.drones,
        projectiles: this.projectiles,
        acousticRings: this.acousticRings,
        floatingTexts: this.floatingTexts,
        slashEffects: this.slashEffects,
        inkPuddles: this.inkPuddles,
        footprints: this.footprints,
        bloodDrips: this.bloodDrips,
        placedTripwireFlares: this.placedTripwireFlares,
        smokeClouds: this.smokeClouds,
        placedJammers: this.placedJammers,
        leafParticles: this.leafParticles,
        diegeticBadge: this.diegeticBadge,
        holdAction: this.holdAction,
        camera: this.camera
      };
    }

    _getObjectives() {
      const p = this.player;
      const l = this.level;
      if (!p || !l) return [];
      const sec = l.secondaryObjectives || {};
      const secCount = ['bodyCam', 'samplePhotos', 'scientistFreed', 'gpsPlanted'].filter((k) => !!sec[k]).length;
      const hasDrive1 = p.inventory.encryptedDrives > 0 || p.inventory.decryptedLore.length > 0;
      return [
        { id: 'cut_fence', text: 'Find Bolt Cutters (Fishing Hut) & cut Outpost Fence', done: !!l.fenceCut },
        { id: 'drive', text: 'Recover Drive 01 in VBS Field Lab (unlock Ravine Gate)', done: hasDrive1 && !!l.outpostGateOpen },
        { id: 'pump', text: 'Restore Ravine Pump Station power (drain Culvert)', done: !!l.pumpPowered },
        { id: 'keycard', text: p.inventory.hasSafeCode ? 'Get Tier-1 Keycard (Lab Safe code 4719 or Cmdr Ward)' : 'Get Tier-1 Keycard (Lab Safe or Cmdr Ward)', done: !!p.inventory.hasKeycard },
        { id: 'gate', text: 'Swipe Keycard & survive 15s Blast Gate hold', done: !!l.blastGateOpen },
        { id: 'extract', text: 'Enter Facility Sub-Zero Extraction Zone', done: this.mode === 'VICTORY' },
        { id: 'secondary', text: `Secondary Objectives (${secCount}/4 complete)`, done: secCount === 4 }
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
          // Task 6c: Pressing B anywhere no longer opens camp!
          if (this.hud) this.hud.showToast('FIND A HIDDEN BASHA SITE (FIELD CACHE) — HOLD [E] TO REST & RESUPPLY', 2.8);
        }
        if (actions.weaponSelect) this._selectWeapon(actions.weaponSelect);
        if (actions.dodge) this.player.triggerDodge(this.input.moveVector);
        if (actions.bandage) this.startBandage();
        if (actions.tourniquet) {
          const tRes = this.player.applyTourniquet();
          if (this.hud) this.hud.showToast(tRes.message, 2.4);
          if (tRes.ok) this._recordProficiencyAction('fieldMedic', 1);
        }
        if (actions.toggleFilterMask) this._toggleFilterMask();
        if (actions.throwSmoke) this.throwSmokeRag();
        if (actions.placeJammer) this.placeRadioJammer();
        if (actions.placeTripwireFlare) this.placeTripwireFlare();
        if (actions.quickConsumable) {
          const res = this.player.useQuickConsumable();
          if (this.hud) this.hud.showToast(res.message, 2.2);
          if (res.used && this.sound) this.sound.playDecoyClatter();
          if (res.used === 'medkit' || res.used === 'jungleStew' || res.used === 'bandage' || res.used === 'tourniquet' || res.used === 'sporeInjector') {
            this._recordProficiencyAction('fieldMedic', 1);
          }
        }
        if (actions.interact) this._handleInteractOrTakedown();
        if (actions.meleeSlash) this._performParangSlash();
        if (actions.attackRanged) this._performRangedOrDecoy();
        if (actions.attackPrimary) {
          if (this.player.activeWeapon === 'parang') this._performParangSlash();
          else this._performRangedOrDecoy();
        }
      }

      // 2. Update Player, Survival Needs & AAA Spring Camera
      const prevX = this.player.centerX;
      const prevY = this.player.centerY;
      this.player.update(dt, this.input, this.level);
      const diffPreset = this._getDifficultyPreset();
      if (typeof this.player.updateNeeds === 'function') {
        const needsRes = this.player.updateNeeds(dt, {
          isMoving: this.player.moving,
          isSprinting: this.player.sprinting,
          drainMult: diffPreset ? diffPreset.needsDrainMult : 1.0
        });
        if (needsRes && needsRes.dehydratedTick) {
          this._spawnFloat(this.player.centerX, this.player.y - 12, 'DEHYDRATED -1 HP', '#F85A5A', true);
          if (this.hud) this.hud.showToast('SEVERE DEHYDRATION — DRINK PURIFIED WATER!', 2.4);
        }
      }
      this._updateSurvivalAndGear(dt);
      this._updateHoldAction(dt);
      // Task 7 Close Quarters Rank 2: Silent body drag follows player smoothly
      if (this.player.draggingBody && this.player.draggingBody.dead) {
        const body = this.player.draggingBody;
        const backX = this.player.x - (this.player.facingRight ? 26 : -26);
        const backY = this.player.y + 4;
        body.x += (backX - body.x) * Math.min(1, dt * 8);
        body.y += (backY - body.y) * Math.min(1, dt * 8);
      }
      // Task 7 Marksmanship Rank 2: Auto-recover carbon bolts within 60 px
      if (this.player.getProficiencyRank && this.player.getProficiencyRank('marksmanship') >= 2 && this.level && Array.isArray(this.level.interactables)) {
        for (let i = 0; i < this.level.interactables.length; i++) {
          const it = this.level.interactables[i];
          if (!it.collected && it.type === 'bolt_pickup' && Math.hypot(it.x - this.player.centerX, it.y - this.player.centerY) <= 60) {
            it.collected = true;
            this.player.ammo.crossbow += 1;
            this._spawnFloat(this.player.centerX, this.player.y - 16, '+1 BOLT', '#111E33', false);
          }
        }
      }
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
          // Task 6d: Radio Jammer blocks guard radio ally calls within jammer radius for 20s
          let jammed = false;
          if (Array.isArray(this.placedJammers)) {
            for (let k = 0; k < this.placedJammers.length; k++) {
              const jm = this.placedJammers[k];
              if (Math.hypot(jm.x - merc.centerX, jm.y - merc.centerY) <= (jm.radius || 340)) {
                jammed = true;
                break;
              }
            }
          }
          if (jammed) {
            this._spawnFloat(merc.centerX, merc.y - 24, 'RADIO JAMMED!', '#111E33', true);
            return;
          }
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
          if (victim === this.player && !this.player.dead) {
            // Task 6b: Boar tusk hit has 100% bleeding chance
            this.player.bleeding = true;
            if (this.hud) this.hud.showToast('GORED & BLEEDING — PRESS [H] TO BANDAGE OR [Y] FOR TOURNIQUET!', 3.0);
          }
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
          // Task 6b: Guards crossing crimson blood drips follow the player's bleeding trail
          if ((m.state === 'PATROL' || m.state === 'SUSPICIOUS') && this.bloodDrips.length > 0) {
            for (let b = this.bloodDrips.length - 1; b >= 0; b--) {
              const drip = this.bloodDrips[b];
              if (!drip.inspected && Math.hypot(m.centerX - drip.x, m.centerY - drip.y) < 54) {
                drip.inspected = true;
                const nextDrip = this.bloodDrips[Math.min(this.bloodDrips.length - 1, b + 1)];
                const trailX = nextDrip && nextDrip !== drip ? nextDrip.x : this.player.centerX;
                const trailY = nextDrip && nextDrip !== drip ? nextDrip.y : this.player.centerY;
                const trailAng = Math.atan2(trailY - drip.y, trailX - drip.x);
                m.inspectFootprint(trailX, trailY, trailAng);
                this._spawnFloat(m.centerX, m.y - 18, 'BLOOD TRAIL!', '#F85A5A', false);
                break;
              }
            }
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
      if (Array.isArray(this.drones)) {
        const droneEvents = Object.assign({}, aiEvents, {
          onDroneSpot: (drone) => {
            if (this.sound) this.sound.playRadioAlert();
            this._spawnFloat(drone.x, drone.y - 68, 'DRONE SPOTTED!', '#F85A5A', true);
            if (this.hud) this.hud.showToast('PMC SURVEILLANCE DRONE SPOTTED YOU — GUARDS ALERTED!', 2.6);
          }
        });
        for (let i = 0; i < this.drones.length; i++) {
          this.drones[i].update(dt, this.player, this.mercenaries, droneEvents);
        }
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

    _updateSurvivalAndGear(dt) {
      const p = this.player;
      const l = this.level;
      if (!p || !l) return;

      // 1. Bleeding: 1 HP lost every 6 s + crimson blood drips every 1.5 s
      if (p.bleeding && !p.dead) {
        p.bleedTickTimer += dt;
        if (p.bleedTickTimer >= 6.0) {
          p.bleedTickTimer -= 6.0;
          const dealt = p.takeDamage(1);
          if (dealt > 0) {
            this._vibrate([25, 40]);
            this._spawnFloat(p.centerX, p.y - 12, 'BLEEDING -1 HP', '#F85A5A', true);
          }
        }
        p.bleedDripTimer += dt;
        if (p.bleedDripTimer >= 1.5) {
          p.bleedDripTimer -= 1.5;
          this.bloodDrips.push({
            x: p.centerX + (Math.random() - 0.5) * 6,
            y: p.y + p.height - 4,
            age: 0,
            duration: 14.0,
            inspected: false
          });
        }
      } else {
        p.bleedTickTimer = 0;
        p.bleedDripTimer = 0;
      }

      // Age & expire blood drips
      for (let i = this.bloodDrips.length - 1; i >= 0; i--) {
        this.bloodDrips[i].age += dt;
        if (this.bloodDrips[i].age >= this.bloodDrips[i].duration) {
          this.bloodDrips.splice(i, 1);
        }
      }

      // 2. Basha Site discovery (Task 6c)
      if (Array.isArray(l.bashaSites)) {
        for (let i = 0; i < l.bashaSites.length; i++) {
          const site = l.bashaSites[i];
          if (!site.discovered && Math.hypot(site.x - p.centerX, site.y - p.centerY) <= 150) {
            site.discovered = true;
            if (this.hud) this.hud.showToast(`BASHA SITE DISCOVERED: ${site.label.toUpperCase()} — HOLD [E] TO ACCESS`, 3.2);
          }
        }
      }

      // 3. Placed Tripwire Flares (Task 6d): alerts player, blinds guards 3s, provokes boars
      if (Array.isArray(this.placedTripwireFlares)) {
        for (let i = this.placedTripwireFlares.length - 1; i >= 0; i--) {
          const fl = this.placedTripwireFlares[i];
          if (!fl.active) {
            this.placedTripwireFlares.splice(i, 1);
            continue;
          }
          let triggered = false;
          for (let j = 0; j < this.mercenaries.length; j++) {
            const m = this.mercenaries[j];
            if (!m.dead && Math.hypot(m.centerX - fl.x, m.centerY - fl.y) < 48) {
              triggered = true;
              break;
            }
          }
          if (!triggered) {
            for (let j = 0; j < this.boars.length; j++) {
              const b = this.boars[j];
              if (!b.dead && Math.hypot(b.centerX - fl.x, b.centerY - fl.y) < 54) {
                triggered = true;
                break;
              }
            }
          }
          if (triggered) {
            fl.active = false;
            this.placedTripwireFlares.splice(i, 1);
            if (this.sound) this.sound.playAlarmKlaxon();
            this._emitAcousticRing(fl.x, fl.y, 260, true);
            this._spawnFloat(fl.x, fl.y - 18, 'FLARE POP!', '#F85A5A', true);
            if (this.hud) this.hud.showToast('TRIPWIRE FLARE TRIGGERED — GUARDS BLINDED 3s & BOARS PROVOKED!', 2.8);
            for (let j = 0; j < this.mercenaries.length; j++) {
              const m = this.mercenaries[j];
              if (!m.dead && Math.hypot(m.centerX - fl.x, m.centerY - fl.y) <= 170) {
                m.blindTimer = 3.0;
                this._spawnFloat(m.centerX, m.y - 18, 'BLINDED (3s)', '#F85A5A', true);
              }
            }
          }
        }
      }

      // 4. Diesel Smoke Rag Clouds (6s vision block)
      if (Array.isArray(this.smokeClouds)) {
        for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
          this.smokeClouds[i].ttl -= dt;
          if (this.smokeClouds[i].ttl <= 0) this.smokeClouds.splice(i, 1);
        }
        global.BelumGame = global.BelumGame || {};
        global.BelumGame.activeSmokeClouds = this.smokeClouds;
      }

      // 5. Radio Jammers (20s ally-call block)
      if (Array.isArray(this.placedJammers)) {
        for (let i = this.placedJammers.length - 1; i >= 0; i--) {
          this.placedJammers[i].ttl -= dt;
          if (this.placedJammers[i].ttl <= 0) this.placedJammers.splice(i, 1);
        }
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

    _getTakedownDuration() {
      return (this.player && this.player.getProficiencyRank && this.player.getProficiencyRank('closeQuarters') >= 1) ? 0.45 : 0.6;
    }

    _executeSilentTakedown(m) {
      const p = this.player;
      if (!p || !m || m.dead) return;
      p.attackCooldown = 0.42;
      p.parangAnimTimer = 0.5;
      if (p.animParang) p.animParang.reset();
      if (this.sound) this.sound.playParangSlash();
      const dx = m.centerX - p.centerX;
      const dy = m.centerY - p.centerY;

      this.slashEffects.push({
        x: p.centerX,
        y: p.centerY - 8,
        angle: Math.atan2(dy, dx),
        radius: 66,
        isStealth: true,
        age: 0,
        duration: 0.22
      });

      m.takeDamage(999, { x: p.centerX, y: p.centerY }, {
        onMercKilled: (killed) => {
          this.stats.enemiesNeutralized++;
          this.stats.stealthTakedowns++;
          this._spawnInkPuddle(killed.centerX, killed.y + killed.height - 6, killed.role === 'commander' ? 40 : 30);
        }
      });

      // Fix 6.5: Silent stealth takedowns feel quiet (0.2 trauma, no hit-stop)
      if (this.camera) this.camera.addTrauma(0.2, dx, dy);
      this._vibrate([25, 40, 25]);
      this._spawnFloat(m.centerX, m.y - 16, 'SILENT TAKEDOWN', '#F85A5A', true);
      this._recordProficiencyAction('closeQuarters', 1);
    }

    _updateHoldAction(dt) {
      const p = this.player;
      if (!p || !this.input) {
        this.holdAction = null;
        return;
      }
      const held = this.input.isInteractHeld();

      if (!this.holdAction) {
        if (held) {
          for (let i = 0; i < this.mercenaries.length; i++) {
            const m = this.mercenaries[i];
            if (m.dead || m.state === 'ALERT') continue;
            const dist = Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY);
            if (dist <= 78 && m.isBehindMe(p.centerX, p.centerY)) {
              this.holdAction = {
                type: 'takedown',
                target: m,
                x: m.centerX,
                y: m.y,
                elapsed: 0,
                duration: this._getTakedownDuration(),
                label: 'HOLD [E] TAKEDOWN'
              };
              break;
            }
          }
          // Task 6c: Hold E at a basha site to enter Field Cache (only if no guard is ALERT)
          if (!this.holdAction) {
            const site = this._getNearbyBashaSite(95);
            if (site) {
              if (this.inCombat || this._hasAlertGuard()) {
                if (this.hud) this.hud.showToast('HOSTILES ON ALERT — CANNOT USE FIELD CACHE!', 2.4);
              } else {
                this.holdAction = {
                  type: 'basha',
                  x: site.x,
                  y: site.y,
                  elapsed: 0,
                  duration: 0.6,
                  maxDist: 105,
                  cancelOnAlert: true,
                  label: 'HOLD [E] FIELD CACHE',
                  onComplete: () => this.tryOpenCamp(site)
                };
              }
            }
          }
        }
        return;
      }

      const ha = this.holdAction;
      if (ha.type === 'takedown') {
        const m = ha.target;
        const invalid = !m || m.dead || m.state === 'ALERT' || Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY) > 84 || !m.isBehindMe(p.centerX, p.centerY);
        if (!held || invalid) {
          // Task 9: Releasing E early fails takedown and makes the guard turn toward the player
          if (m && !m.dead && m.state !== 'ALERT' && ha.elapsed > 0.02) {
            const turnAngle = Math.atan2(p.centerY - m.centerY, p.centerX - m.centerX);
            m.facingAngle = turnAngle;
            m.targetFacingAngle = turnAngle;
            m.facingRight = Math.cos(turnAngle) >= 0;
            m._updateSpriteDir();
            m.hearSound(p.centerX, p.centerY, false);
            this._spawnFloat(m.centerX, m.y - 16, 'TAKEDOWN ABORTED!', '#F85A5A', false);
          }
          this.holdAction = null;
          return;
        }
        ha.x = m.centerX;
        ha.y = m.y;
        ha.elapsed += dt;
        if (ha.elapsed >= ha.duration) {
          this.holdAction = null;
          this._executeSilentTakedown(m);
        }
      } else if (ha.autoAdvance && typeof ha.onComplete === 'function') {
        // Timed self-action (e.g. Bandage 2.0s / 1.2s): cancels if sprinting or attacking
        if (p.dead || p.sprinting || p.attackCooldown > 0.1) {
          this.holdAction = null;
          return;
        }
        ha.x = p.centerX;
        ha.y = p.y;
        ha.elapsed += dt;
        if (ha.elapsed >= ha.duration) {
          const doneFn = ha.onComplete;
          this.holdAction = null;
          doneFn();
        }
      } else if (typeof ha.onComplete === 'function') {
        const dist = Math.hypot((ha.x || 0) - p.centerX, (ha.y || 0) - p.centerY);
        if (!held || dist > (ha.maxDist || 90) || (ha.cancelOnAlert && (this.inCombat || this._hasAlertGuard()))) {
          this.holdAction = null;
          return;
        }
        ha.elapsed += dt;
        if (ha.elapsed >= ha.duration) {
          const doneFn = ha.onComplete;
          this.holdAction = null;
          doneFn();
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
          const dmg = 45;
          m.takeDamage(dmg, { x: p.centerX, y: p.centerY }, {
            onMercKilled: (killed) => {
              this.stats.enemiesNeutralized++;
              this._spawnInkPuddle(killed.centerX, killed.y + killed.height - 6, killed.role === 'commander' ? 40 : 30);
            }
          });
          this.triggerHitStop(45);
          if (this.camera) this.camera.addTrauma(0.34, dx, dy);
          this._spawnFloat(m.centerX, m.y - 14, String(dmg), '#F85A5A', true);
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
          if (this.hud) this.hud.showToast('NO RANGED AMMO — USE PARANG OR SALVAGE SUPPLIES', 2.0);
          return;
        }
      }

      const ang = p.aimAngle;
      if (weapon === 'crossbow') {
        if (p.ammo.crossbow <= 0) {
          if (this.hud) this.hud.showToast('OUT OF BOLTS — RECOVER OR SALVAGE CARBON BOLTS', 2.0);
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
            damage: 60, // Task 9: 60 dmg kills 60 HP rifleman in 1 shot from stealth
            maxRange: 450
          })
        );
      } else if (weapon === 'pistol') {
        if (p.ammo.pistol <= 0) {
          if (this.hud) this.hud.showToast('OUT OF 9MM ROUNDS — SALVAGE MAGAZINES', 2.0);
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
            damage: 55, // Task 9: 55 body dmg (2 shots) or 1 headshot-zone hit
            maxRange: 550
          })
        );
        // Task 9: Suppressed 9mm noise radius increased to 220 px
        this._emitAcousticRing(p.centerX, p.centerY, 220, false);
      } else if (weapon === 'decoy') {
        if (p.ammo.decoy <= 0) {
          if (this.hud) this.hud.showToast('OUT OF NOISEMAKERS', 1.6);
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

      // Task 7 Close Quarters Rank 2: Press E while dragging a body to drop it silently
      if (p.draggingBody) {
        p.draggingBody = null;
        if (this.hud) this.hud.showToast('BODY DROPPED', 1.6);
        return;
      }

      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        if (m.dead || m.state === 'ALERT') continue;
        const dist = Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY);
        if (dist <= 78 && m.isBehindMe(p.centerX, p.centerY)) {
          if (!this.holdAction || this.holdAction.type !== 'takedown') {
            this.holdAction = {
              type: 'takedown',
              target: m,
              x: m.centerX,
              y: m.y,
              elapsed: 0,
              duration: this._getTakedownDuration(),
              label: 'HOLD [E] TAKEDOWN'
            };
          }
          return;
        }
      }

      // Search Commander Ward's dead body for Tier-1 Keycard (Task 4: alternate keycard path)
      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        if (m.dead && m.role === 'commander' && !m.bodySearched && Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY) <= 85) {
          m.bodySearched = true;
          p.inventory.hasKeycard = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.sound) this.sound.playDecoyClatter();
          if (this.hud) this.hud.showToast('SALVAGED TIER-1 SECURITY KEYCARD FROM CMDR WARD!', 3.2);
          return;
        }
      }

      // Task 7 Close Quarters Rank 2: Pick up & silently drag dead guard body
      if (p.getProficiencyRank && p.getProficiencyRank('closeQuarters') >= 2) {
        for (let i = 0; i < this.mercenaries.length; i++) {
          const m = this.mercenaries[i];
          if (m.dead && Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY) <= 85) {
            p.draggingBody = m;
            if (this.hud) this.hud.showToast('SILENT BODY DRAG — PRESS [E] TO DROP', 2.0);
            return;
          }
        }
      }

      for (let i = 0; i < this.boars.length; i++) {
        const b = this.boars[i];
        if (b.dead && !b.meatHarvested && Math.hypot(b.centerX - p.centerX, b.centerY - p.centerY) <= 85) {
          b.meatHarvested = true;
          p.inventory.boarMeat++;
          if (this.sound) this.sound.playParangSlash();
          if (this.hud) this.hud.showToast('BOAR MEAT TAKEN — GRILL AT A FIELD CACHE', 2.6);
          return;
        }
      }

      const openGateById = (gateId) => {
        const gObs = this.level.obstacles.find((o) => o.id === gateId);
        if (gObs) {
          gObs.unlocked = true;
          gObs.solid = false;
        }
      };

      const items = this.level.interactables || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.collected) continue;
        if (Math.hypot(it.x - p.centerX, it.y - p.centerY) > 78) continue;

        if (it.type === 'weapon_parang') {
          it.collected = true;
          p.unlockedWeapons.parang = true;
          p.inventory.hasParangPickup = true;
          if (this.hud) this.hud.showToast('ACQUIRED STEEL PARANG — HOLD [E] BEHIND GUARDS', 2.8);
        } else if (it.type === 'weapon_crossbow') {
          it.collected = true;
          p.unlockedWeapons.crossbow = true;
          p.ammo.crossbow += 5;
          if (this.hud) this.hud.showToast('ACQUIRED COMPOUND CROSSBOW (+5 CARBON BOLTS)', 2.8);
        } else if (it.type === 'weapon_pistol') {
          it.collected = true;
          p.unlockedWeapons.pistol = true;
          p.ammo.pistol += 8;
          if (this.hud) this.hud.showToast('ACQUIRED SUPPRESSED 9MM PISTOL (+8 ROUNDS)', 2.8);
        } else if (it.type === 'locker_key') {
          it.collected = true;
          p.inventory.hasLockerKey = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('SALVAGED BOAT LOCKER KEY — UNLOCK FISHING HUT BOAT LOCKER', 3.0);
        } else if (it.type === 'bolt_cutters') {
          if (!p.inventory.hasLockerKey) {
            if (this.hud) this.hud.showToast('BOAT LOCKER PADLOCKED — FIND LOCKER KEY AT NORTH SENTRY CRATE', 3.0);
            return;
          }
          it.collected = true;
          p.inventory.hasBoltCutters = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('SALVAGED HEAVY BOLT CUTTERS — CUT NW & SE FENCE RELAYS', 3.2);
        } else if (it.type === 's1_breaker_north') {
          if (!p.inventory.hasBoltCutters) {
            if (this.hud) this.hud.showToast('NEED BOLT CUTTERS TO SEVER NW FENCE VOLTAGE FEEDER', 2.8);
            return;
          }
          it.collected = true;
          this.level.s1BreakerNorthCut = true;
          this._emitAcousticRing(it.x, it.y, 120, false);
          if (this.hud) this.hud.showToast('NW FENCE VOLTAGE FEEDER SEVERED (1/2)', 2.8);
        } else if (it.type === 's1_breaker_south') {
          if (!p.inventory.hasBoltCutters) {
            if (this.hud) this.hud.showToast('NEED BOLT CUTTERS TO SEVER SE OUTPOST GROUNDING RELAY', 2.8);
            return;
          }
          it.collected = true;
          this.level.s1BreakerSouthCut = true;
          this._emitAcousticRing(it.x, it.y, 120, false);
          if (this.hud) this.hud.showToast('SE OUTPOST GROUNDING RELAY SEVERED — FENCE DE-ENERGIZED!', 3.0);
        } else if (it.type === 'cut_fence') {
          if (!p.inventory.hasBoltCutters) {
            if (this.hud) this.hud.showToast('LOCKED FENCE — FIND BOLT CUTTERS IN SOUTH FISHING HUT BOAT LOCKER', 3.0);
            return;
          }
          if (!this.level.s1BreakerNorthCut || !this.level.s1BreakerSouthCut) {
            if (this.hud) this.hud.showToast('FENCE ELECTRIFIED — CUT BOTH NW & SE FENCE RELAYS FIRST', 3.2);
            return;
          }
          it.collected = true;
          this.level.fenceCut = true;
          openGateById('outpost_fence_gate');
          this._emitAcousticRing(it.x, it.y, 140, false);
          if (this.hud) this.hud.showToast('OUTPOST FENCE CUT OPEN — SECTOR 2 ACCESSIBLE!', 3.0);
        } else if (it.type === 'shed_key') {
          it.collected = true;
          p.inventory.hasShedKey = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('ACQUIRED DIESEL SHED SHUTOFF KEY — KILL POWER AT SW GENERATOR', 3.2);
        } else if (it.type === 'lab_safe') {
          if (!p.inventory.hasSafeCode) {
            if (this.hud) this.hud.showToast('LAB SAFE LOCKED — DECRYPT DRIVE 01 AT A FIELD CACHE FOR 4-DIGIT CODE', 3.2);
            return;
          }
          it.collected = true;
          this.level.labSafeOpened = true;
          p.inventory.hasKeycard = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('SAFE CODE ACCEPTED — ACQUIRED TIER-1 SECURITY KEYCARD!', 3.4);
        } else if (it.type === 'outpost_gate') {
          const hasDrive1 = p.inventory.encryptedDrives > 0 || p.inventory.decryptedLore.length > 0;
          if (!hasDrive1) {
            if (this.hud) this.hud.showToast('RECOVER ENCRYPTED DRIVE 01 FROM VBS FIELD LAB FIRST', 3.0);
            return;
          }
          it.collected = true;
          this.level.outpostGateOpen = true;
          openGateById('outpost_east_gate');
          if (this.hud) this.hud.showToast('RAVINE CHECKPOINT UNLOCKED — ENTERING SECTOR 3!', 3.0);
        } else if (it.type === 'pump_fuse') {
          it.collected = true;
          p.inventory.hasPumpFuse = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('SALVAGED HIGH-AMP PUMP FUSE — INSTALL AT NW RAVINE BREAKER', 3.2);
        } else if (it.type === 'intake_valve') {
          it.collected = true;
          this.level.intakeValveOpen = true;
          this._emitAcousticRing(it.x, it.y, 140, false);
          if (this.hud) this.hud.showToast('RAVINE INTAKE SLUICE CLEARED — LINE READY FOR PUMP POWER', 3.0);
        } else if (it.type === 'ravine_breaker') {
          if (!p.inventory.hasPumpFuse) {
            if (this.hud) this.hud.showToast('BREAKER BLOWN — SALVAGE PUMP FUSE FROM NE RAVINE WATCHTOWER', 3.2);
            return;
          }
          it.collected = true;
          this.level.ravineBreakerPowered = true;
          this._emitAcousticRing(it.x, it.y, 160, false);
          if (this.hud) this.hud.showToast('PUMP FUSE INSTALLED — POWER UP SE RAVINE PUMP STATION', 3.2);
        } else if (it.type === 'pump_station') {
          if (!this.level.intakeValveOpen || !this.level.ravineBreakerPowered) {
            if (this.hud) this.hud.showToast('PUMP OFFLINE — CLEAR SW INTAKE SLUICE & INSTALL FUSE AT NW BREAKER', 3.4);
            return;
          }
          it.collected = true;
          this.level.pumpPowered = true;
          this.level.culvertDrained = true;
          this.level.culvertUnlocked = true;
          openGateById('culvert_grate'); openGateById('culvert_entry_grate');
          this._emitAcousticRing(it.x, it.y, 260, false);
          if (this.hud) this.hud.showToast('PUMP STATION POWERED — CULVERT DRAINED! HIT NE PERIMETER GATE RELEASE', 3.4);
        } else if (it.type === 'ravine_gate_ctrl') {
          if (!this.level.pumpPowered) {
            if (this.hud) this.hud.showToast('PERIMETER GATE UNPOWERED — RESTORE SE RAVINE PUMP STATION FIRST', 3.2);
            return;
          }
          it.collected = true;
          this.level.ravineGateReleased = true;
          openGateById('ravine_east_gate');
          this._emitAcousticRing(it.x, it.y, 180, false);
          if (this.hud) this.hud.showToast('PERIMETER GATE RELEASED — SECTOR 4 ACCESSIBLE!', 3.2);
        } else if (it.type === 's4_relay_tower') {
          it.collected = true;
          this.level.s4RelayOff = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('NE GUARD TOWER BLAST INTERLOCK DISABLED', 2.8);
        } else if (it.type === 's4_hydraulic_a') {
          it.collected = true;
          this.level.s4HydraulicA = true;
          this._emitAcousticRing(it.x, it.y, 150, false);
          if (this.hud) this.hud.showToast('SW BUNKER HYDRAULIC LOCK A RELEASED', 2.8);
        } else if (it.type === 's4_override_truck') {
          it.collected = true;
          this.level.s4OverrideToken = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('CAPTURED BLAST GATE ROLLING OVERRIDE TOKEN FROM COMMAND RELAY', 3.0);
        } else if (it.type === 's4_hydraulic_b') {
          it.collected = true;
          this.level.s4HydraulicB = true;
          this._emitAcousticRing(it.x, it.y, 150, false);
          if (this.hud) this.hud.showToast('SE BUNKER HYDRAULIC LOCK B RELEASED — PURGE WEST MANIFOLD', 3.0);
        } else if (it.type === 's4_purge_valve') {
          if (!this.level.s4HydraulicA || !this.level.s4HydraulicB) {
            if (this.hud) this.hud.showToast('MANIFOLD LOCKED — RELEASE HYDRAULIC LOCKS A & B FIRST', 3.2);
            return;
          }
          it.collected = true;
          this.level.s4PurgeDone = true;
          this._emitAcousticRing(it.x, it.y, 180, false);
          if (this.hud) this.hud.showToast('BUNKER PRESSURE PURGED — BLAST GATE TERMINAL ARMED FOR KEYCARD!', 3.2);
        } else if (it.type === 'sec_body_cam') {
          it.collected = true;
          if (this.level.secondaryObjectives) this.level.secondaryObjectives.bodyCam = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('SECONDARY OBJECTIVE: RECOVERED VBS COURIER BODY CAMERA', 3.2);
        } else if (it.type === 'sec_photo_samples') {
          if (!this.holdAction) {
            const photoDur = Number((2.0 * this._getSearchTimeScale()).toFixed(2));
            this.holdAction = {
              type: 'photograph',
              x: it.x,
              y: it.y,
              elapsed: 0,
              duration: photoDur,
              maxDist: 82,
              label: `HOLD [E] PHOTOGRAPH (${photoDur}s)`,
              onComplete: () => {
                it.collected = true;
                if (this.level.secondaryObjectives) this.level.secondaryObjectives.samplePhotos = true;
                if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
                if (this.sound) this.sound.playDecoyClatter();
                if (this.hud) this.hud.showToast('SECONDARY OBJECTIVE: LAB SAMPLES PHOTOGRAPHED!', 3.2);
              }
            };
          }
          return;
        } else if (it.type === 'sec_free_scientist') {
          it.collected = true;
          if (this.level.secondaryObjectives) this.level.secondaryObjectives.scientistFreed = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('SCIENTIST FREED: "WARD PATROLS THE BLAST GATE; DRONE SWEEPS THE NORTH YARD!"', 4.0);
        } else if (it.type === 'sec_gps_truck') {
          it.collected = true;
          if (this.level.secondaryObjectives) this.level.secondaryObjectives.gpsPlanted = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast("SECONDARY OBJECTIVE: GPS TRACKER PLANTED ON WARD'S RADIO TRUCK!", 3.2);
        } else if (it.type === 'side_footlocker') {
          it.collected = true;
          p.inventory.jungleStew += 1;
          p.inventory.bandage = (p.inventory.bandage || 0) + 1;
          p.inventory.energyGel = (p.inventory.energyGel || 0) + 1;
          p.ammo.pistol += 4;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('FOOTLOCKER SALVAGED: +1 MRE, +1 BANDAGE, +1 ENERGY GEL, +4 9MM', 3.2);
        } else if (it.type === 'side_ammo_can') {
          it.collected = true;
          p.ammo.crossbow += 2;
          p.ammo.pistol += 4;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('AMMO CAN SALVAGED: +2 CARBON BOLTS, +4 9MM ROUNDS', 3.0);
        } else if (it.type === 'side_med_case') {
          it.collected = true;
          p.inventory.medkit += 1;
          p.inventory.bandage = (p.inventory.bandage || 0) + 1;
          p.inventory.tourniquet = (p.inventory.tourniquet || 0) + 1;
          p.inventory.purificationTabs = (p.inventory.purificationTabs || 0) + 2;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('MEDICAL CASE SALVAGED: +1 MEDKIT, +1 BANDAGE, +1 TOURNIQUET, +2 PURIF. TABS', 3.2);
        } else if (it.type === 'side_cold_storage') {
          it.collected = true;
          p.inventory.medkit += 1;
          p.inventory.sporeInjector = (p.inventory.sporeInjector || 0) + 1;
          p.inventory.filterCartridge = (p.inventory.filterCartridge || 0) + 1;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('COLD-STORAGE SALVAGED: +1 MEDKIT, +1 SPORE AUTO-INJECTOR, +1 FILTER CARTRIDGE', 3.4);
        } else if (it.type === 'side_guard_tower') {
          it.collected = true;
          p.inventory.scrapWire += 2;
          p.inventory.radioParts = (p.inventory.radioParts || 0) + 2;
          p.inventory.battery = (p.inventory.battery || 0) + 1;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('GUARD TOWER SALVAGED: +2 RADIO PARTS, +1 BATTERY & SCRAP WIRE', 3.2);
        } else if (it.type === 'filter_mask') {
          it.collected = true;
          p.inventory.filterMask = true;
          p.filterCartridgeTimer = 90;
          p.filterMaskOn = true;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('RESPIRATOR FILTER MASK EQUIPPED (90s CARTRIDGE) — PRESS [R] TO TOGGLE', 3.4);
        } else if (it.type === 'salvage_can_pebbles') {
          it.collected = true;
          p.inventory.emptyCan = (p.inventory.emptyCan || 0) + 1;
          p.inventory.pebbles = (p.inventory.pebbles || 0) + 1;
          if (this.hud) this.hud.showToast('SALVAGED EMPTY CAN & PEBBLES — IMPROVISE NOISEMAKER AT WORKBENCH', 3.0);
        } else if (it.type === 'salvage_diesel_rag') {
          it.collected = true;
          p.inventory.diesel = (p.inventory.diesel || 0) + 1;
          p.inventory.rag = (p.inventory.rag || 0) + 1;
          if (this.hud) this.hud.showToast('SALVAGED DIESEL FUEL & RAG — IMPROVISE SMOKE RAG AT WORKBENCH', 3.0);
        } else if (it.type === 'salvage_flare') {
          it.collected = true;
          p.inventory.flare = (p.inventory.flare || 0) + 1;
          p.inventory.scrapWire = (p.inventory.scrapWire || 0) + 1;
          if (this.hud) this.hud.showToast('SALVAGED ROAD FLARE & WIRE — IMPROVISE TRIPWIRE FLARE AT WORKBENCH', 3.0);
        } else if (it.type === 'salvage_radio_parts') {
          it.collected = true;
          p.inventory.radioParts = (p.inventory.radioParts || 0) + 2;
          p.inventory.battery = (p.inventory.battery || 0) + 1;
          if (this.hud) this.hud.showToast('SALVAGED RADIO PARTS (x2) & BATTERY — IMPROVISE RADIO JAMMER AT WORKBENCH', 3.0);
        } else if (it.type === 'encrypted_drive') {
          if (it.id === 'pickup_drive_01' && !this.level.generatorSabotaged) {
            if (this.hud) this.hud.showToast('FIELD LAB BACK ROOM MAGLOCKED — SHUT DOWN SW DIESEL GENERATOR FIRST', 3.4);
            return;
          }
          it.collected = true;
          p.inventory.encryptedDrives++;
          if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
          if (this.hud) this.hud.showToast('RECOVERED VBS ENCRYPTED DRIVE — DECRYPT AT A FIELD CACHE', 3.0);
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
          if (this.hud) this.hud.showToast('SALVAGED SCRAP WIRE (+2)', 2.0);
        } else if (it.type === 'decoy_rocks') {
          it.collected = true;
          p.ammo.decoy += 5;
          if (this.hud) this.hud.showToast('COLLECTED NOISEMAKERS (+5) — PRESS [4] TO LURE BOARS', 2.8);
        } else if (it.type === 'bolt_pickup') {
          it.collected = true;
          p.ammo.crossbow += 1;
          if (this.hud) this.hud.showToast('RECOVERED CARBON BOLT (+1)', 1.5);
        } else if (it.type === 'generator') {
          if (!p.inventory.hasShedKey) {
            if (this.hud) this.hud.showToast('DIESEL SHED LOCKED — FIND SHUTOFF KEY AT NE BARRACKS LOCKBOX', 3.2);
            return;
          }
          it.collected = true;
          this.level.generatorSabotaged = true;
          for (let f = 0; f < this.level.floodlights.length; f++) {
            if (this.level.floodlights[f].sector === 2) this.level.floodlights[f].active = false;
          }
          this._emitAcousticRing(it.x, it.y, 290, false);
          if (this.hud) this.hud.showToast('GENERATOR SABOTAGED — FLOODLIGHTS DARK & FIELD LAB BACK ROOM UNLOCKED!', 3.4);
        } else if (it.type === 'culvert_unlock') {
          if (!this.level.culvertDrained && !p.inventory.hasKeycard) {
            if (this.hud) this.hud.showToast('CULVERT FLOODED — POWER SECTOR 3 PUMP STATION FIRST', 2.8);
            return;
          }
          it.collected = true;
          this.level.culvertUnlocked = true;
          openGateById('culvert_grate'); openGateById('culvert_entry_grate');
          if (this.hud) this.hud.showToast('DRAINAGE CULVERT OPEN — STEALTH BYPASS CLEAR!', 3.0);
        } else if (it.type === 'blast_terminal') {
          if (!p.inventory.hasKeycard) {
            if (this.hud) this.hud.showToast('ACCESS DENIED — GET TIER-1 KEYCARD (LAB SAFE OR CMDR WARD)', 3.2);
            return;
          }
          if (!this.level.s4RelayOff || !this.level.s4HydraulicA || !this.level.s4OverrideToken || !this.level.s4HydraulicB || !this.level.s4PurgeDone) {
            if (this.hud) this.hud.showToast('BLAST GATE INTERLOCKED — CLEAR GUARD TOWER RELAY, OVERRIDE, HYDRAULIC LOCKS & PRESSURE PURGE', 3.6);
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

      if (p.draggingBody) {
        this.interactHint = '[E / TAP] DROP BODY';
        this.diegeticBadge = { x: p.centerX, y: p.y - 4, text: '[E] DROP BODY', urgent: false };
        return;
      }

      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        if (!m.dead && m.state !== 'ALERT' && Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY) <= 78 && m.isBehindMe(p.centerX, p.centerY)) {
          const sec = this._getTakedownDuration().toFixed(2).replace(/0$/, '');
          this.interactHint = `HOLD [E] SILENT TAKEDOWN (${sec}s)`;
          this.diegeticBadge = { x: m.centerX, y: m.y, text: `HOLD [E] TAKEDOWN (${sec}s)`, urgent: true };
          return;
        }
        if (m.dead && m.role === 'commander' && !m.bodySearched && Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY) <= 85) {
          this.interactHint = '[E / TAP] SEARCH CMDR WARD (TIER-1 KEYCARD)';
          this.diegeticBadge = { x: m.centerX, y: m.y, text: '[E] SEARCH CMDR WARD', urgent: true };
          return;
        }
        if (m.dead && p.getProficiencyRank && p.getProficiencyRank('closeQuarters') >= 2 && Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY) <= 85) {
          this.interactHint = '[E / TAP] DRAG BODY SILENTLY';
          this.diegeticBadge = { x: m.centerX, y: m.y, text: '[E] DRAG BODY', urgent: false };
          return;
        }
      }
      for (let i = 0; i < this.boars.length; i++) {
        const b = this.boars[i];
        if (b.dead && !b.meatHarvested && Math.hypot(b.centerX - p.centerX, b.centerY - p.centerY) <= 85) {
          this.interactHint = '[E / TAP] TAKE BOAR MEAT';
          this.diegeticBadge = { x: b.centerX, y: b.y, text: '[E / TAP] TAKE BOAR MEAT', urgent: false };
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
      // Task 6c: Basha Site Hold-E prompt
      const basha = this._getNearbyBashaSite(95);
      if (basha) {
        const blocked = this.inCombat || this._hasAlertGuard();
        const label = blocked ? 'FIELD CACHE BLOCKED (GUARD ALERT)' : `HOLD [E] ${basha.label.toUpperCase()}`;
        this.interactHint = label;
        this.diegeticBadge = { x: basha.x, y: basha.y - 8, text: label, urgent: blocked };
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
              // Task 9 + Task 7: Headshot zone (Rank 1 Marksmanship stabilizes aim / widens head zone to 0.44)
              const headRatio = (this.player.getProficiencyRank && this.player.getProficiencyRank('marksmanship') >= 1) ? 0.44 : 0.36;
              const isHeadshot = (pr.type === 'pistol9mm' || pr.type === 'bolt') && pr.y <= m.y + m.height * headRatio;
              const hitDmg = isHeadshot ? Math.round(pr.damage * 1.35) : pr.damage;
              const dealt = m.takeDamage(hitDmg, { x: this.player.centerX, y: this.player.centerY }, aiEvents);
              this._spawnFloat(m.centerX, m.y - 14, isHeadshot ? `HEADSHOT ${dealt}` : String(dealt), '#F85A5A', true);
              if (isHeadshot) {
                this._recordProficiencyAction('marksmanship', 1);
              }
              if (pr.retrievable && this.sound) this.sound.playBoltThud();
              if (m.dead) this.triggerHitStop(35);
              if (pr.retrievable) {
                this.level.interactables.push({
                  id: `bolt_hit_${Date.now()}_${j}`,
                  type: 'bolt_pickup',
                  x: m.centerX,
                  y: m.centerY,
                  badge: 'BLT',
                  label: 'Carbon Bolt',
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
              // Task 6b: Bullet hit has 60% bleeding chance
              if (!this.player.dead && Math.random() < 0.6) {
                this.player.bleeding = true;
                if (this.hud) this.hud.showToast('BULLET WOUND BLEEDING — PRESS [H] TO BANDAGE OR [Y] FOR TOURNIQUET!', 3.0);
              }
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
            if (!this._crossedSectors) this._crossedSectors = new Set([1]);
            if (!this._crossedSectors.has(s.id)) {
              this._crossedSectors.add(s.id);
              if (!this.inCombat) this._recordProficiencyAction('fieldcraft', 1);
            }
            if (s.id > this.highestSavedSector) {
              this.highestSavedSector = s.id;
              this._saveSectorCheckpoint(s.id, false);
            }
          }
          break;
        }
      }

      // Task 6b: Filter Mask 90s cartridge drain while worn
      if (p.filterMaskOn) {
        p.filterCartridgeTimer = Math.max(0, (p.filterCartridgeTimer || 0) - dt);
        if (p.filterCartridgeTimer <= 0) {
          p.filterMaskOn = false;
          if (this.hud) this.hud.showToast('FILTER CARTRIDGE DEPLETED — SPORE PROTECTION LOST!', 2.8);
        }
      }

      // Task 6b: Spore Exposure Meter (blocked while filter mask has cartridge; at 100 -> blurred vision & 1 HP / 4s)
      let inSpore = false;
      for (let i = 0; i < l.sporeZones.length; i++) {
        const sp = l.sporeZones[i];
        if (Math.hypot(p.centerX - sp.x, p.centerY - sp.y) < sp.radius) {
          inSpore = true;
          break;
        }
      }
      if (inSpore) {
        const protectedByMask = !!(p.filterMaskOn && p.filterCartridgeTimer > 0);
        if (!protectedByMask) {
          p.sporeExposure = Math.min(100, (p.sporeExposure || 0) + 12.5 * dt);
          if (p.sporeExposure >= 100) {
            p.sporeHpTimer = (p.sporeHpTimer || 0) + dt;
            if (p.sporeHpTimer >= 4.0) {
              p.sporeHpTimer -= 4.0;
              const dealt = p.takeDamage(1);
              if (dealt > 0) {
                this._vibrate([40, 60]);
                this._spawnFloat(p.centerX, p.y - 12, 'BT-09 SPORES -1 HP', '#F85A5A', true);
              }
            }
          }
        }
      } else {
        p.sporeHpTimer = 0;
        if ((p.sporeExposure || 0) > 0) {
          p.sporeExposure = Math.max(0, p.sporeExposure - 3.0 * dt);
        }
      }

      // Fix 3: Leeches attach only inside actual level.riverZone (x 0..135) or flooded culvert (> 4 s)
      const rz = l.riverZone;
      const inRiver = !!(
        rz &&
        p.centerX >= rz.x && p.centerX <= rz.x + rz.width &&
        p.centerY >= rz.y && p.centerY <= rz.y + rz.height
      );
      const cz = l.culvertZone;
      const inFloodedCulvert = !!(
        cz && !l.culvertDrained &&
        p.centerX >= cz.x && p.centerX <= cz.x + cz.width &&
        p.centerY >= cz.y && p.centerY <= cz.y + cz.height
      );
      if (inRiver || inFloodedCulvert) {
        p.wadeTimer = (p.wadeTimer || 0) + dt;
        if (p.wadeTimer >= 4.0 && (p.leeches || 0) < 3) {
          p.wadeTimer = 0;
          p.leeches = (p.leeches || 0) + 1;
          this._spawnFloat(p.centerX, p.y - 14, `LEECH x${p.leeches} (-10% STA)`, '#F85A5A', false);
          if (this.hud) this.hud.showToast('LEECH ATTACHED (-10% MAX STAMINA) — REMOVE AT A FIELD CACHE', 2.6);
        }
      } else {
        p.wadeTimer = Math.max(0, (p.wadeTimer || 0) - dt * 0.5);
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
