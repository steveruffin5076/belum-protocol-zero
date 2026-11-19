// src/main.js - Belum: Protocol Zero (Act 1) Master Game Loop, State Machine & Combat Coordinator
(function (global) {
  'use strict';

  class BelumProtocolZeroGame {
    constructor() {
      this.ns = global.BelumGame || {};
      this.canvas = typeof document !== 'undefined' ? document.getElementById('game-canvas') : null;
      this.mode = 'PROLOGUE'; // 'PROLOGUE' | 'PLAYING' | 'CAMP' | 'VICTORY' | 'GAME_OVER'
      this.lastTs = 0;
      this.rafId = null;

      // Core subsystems
      this.sound = this.ns.SoundEngine ? new this.ns.SoundEngine() : null;
      this.renderer = this.ns.Renderer25D && this.canvas ? new this.ns.Renderer25D(this.canvas) : null;
      this.camera = this.ns.Camera25D ? new this.ns.Camera25D(1280, 720, 4200, 1320) : null;
      this.input = this.ns.InputManager
        ? new this.ns.InputManager(this.canvas, {
            onToggleMute: () => this._toggleMute(),
            onOpenDossier: () => this.hud && this.hud.openUtility('dossier')
          })
        : null;

      this.camp = this.ns.BivouacCamp
        ? new this.ns.BivouacCamp({
            onClose: () => {
              if (this.mode === 'CAMP') this.mode = 'PLAYING';
            },
            onCraftSuccess: () => {
              if (this.sound) this.sound.playDecoyClatter();
            },
            onDriveDecrypted: (entry) => {
              this.stats.drivesDecrypted++;
              if (this.sound) this.sound.playRadioAlert();
              if (this.hud) this.hud.showToast(`DECRYPTED: ${entry.title}`, 3.5);
            }
          })
        : null;

      this.hud = this.ns.HUDController
        ? new this.ns.HUDController({
            onOpenCamp: () => this.tryOpenCamp(),
            onSelectWeapon: (wid) => this._selectWeapon(wid),
            onToggleMute: () => this._toggleMute(),
            getSnapshot: () => ({
              player: this.player,
              audioMuted: this.sound ? this.sound.muted : false
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

      const btnRestart = document.getElementById('btn-restart-game');
      if (btnRestart) {
        btnRestart.addEventListener('click', () => {
          const modal = document.getElementById('endgame-modal');
          if (modal) modal.classList.add('hidden');
          this.resetAct1();
          this.startGameplay();
        });
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

      this.elapsedSec = 0;
      this.inCombat = false;
      this.currentSectorLabel = 'SECTOR 1 // SUNGAI BELUM RIVERBANK';
      this.interactHint = '';
      this.klaxonTimer = 0;

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
      if (this.hud) {
        this.hud.show();
        this.hud.showToast('INSERTION COMPLETE — STAY LOW IN FERNS & BEHIND LOGS', 3.5);
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
          this.update(dt);
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

      // 2. Update Player
      this.player.update(dt, this.input, this.level);
      if (this.camera) {
        this.camera.update(dt, this.player.centerX, this.player.centerY, this.input ? this.input.aimVector : null);
      }

      // 3. Sector Detection & Environmental Hazards (Rafflesia Spores, Floodlights, Tripwires)
      this._updateSectorAndHazards(dt);

      // 4. AI Updates (Mercenaries + Mutated Boars + Faction Infighting)
      const aiEvents = {
        onRadioAlert: (merc) => {
          this.stats.alertsTriggered++;
          if (this.sound) this.sound.playRadioAlert();
          this._spawnFloat(merc.centerX, merc.y - 24, 'CONTACT!', '#F85A5A', false);
          // Nearby guards within 360px investigate radio call
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
          if (merc.role === 'commander') {
            this.player.inventory.hasKeycard = true;
            if (this.hud) this.hud.showToast('COMMANDER WARD ELIMINATED — TIER-1 CLEARANCE SECURED!', 3.2);
          }
        },
        onBoarTelegraph: (boar) => {
          if (this.sound) this.sound.playBoarRoar();
          this._spawnFloat(boar.centerX, boar.y - 16, '!!', '#F85A5A', true);
        },
        onBoarCharge: () => {
          if (this.camera) this.camera.addShake(5, 0.25);
        },
        onBoarImpact: (victim, dmg, label) => {
          if (this.camera) this.camera.addShake(9, 0.3);
          this._spawnFloat(victim.centerX, victim.y - 12, label || String(dmg), '#F85A5A', true);
          if (victim.faction === 'MERC') {
            this.stats.factionInfightingHits++;
            if (this.hud) this.hud.showToast('FACTION INFIGHTING: MUTATED BOAR GORED IRONCLAD PMC!', 2.6);
          }
        },
        onBoarKilled: (boar) => {
          this._spawnFloat(boar.centerX, boar.y - 14, 'BOAR SLAIN', '#111E33', false);
        }
      };

      let anyAlert = false;
      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        m.update(dt, this.player, this.boars, this.level, aiEvents);
        if (!m.dead && m.state === 'ALERT' && Math.hypot(m.centerX - this.player.centerX, m.centerY - this.player.centerY) < 750) {
          anyAlert = true;
        }
      }
      for (let i = 0; i < this.boars.length; i++) {
        this.boars[i].update(dt, this.player, this.mercenaries, this.level, aiEvents);
      }
      this.inCombat = anyAlert || this.level.blastGateOpening;

      // 5. Update Projectiles & Collisions
      this._updateProjectiles(dt, aiEvents);

      // 6. Update Blast Gate 15-Second Opening Sequence & Victory Check
      this._updateBlastGateAndExtraction(dt, aiEvents);

      // 7. Update Visual FX (Acoustic rings, slashes, floating damage numbers)
      this._updateVisualFx(dt);

      // 8. Compute Context Interaction Hint
      this.interactHint = this._computeInteractHint();

      // 9. Procedural Audio Dynamic Tension Heartbeat
      const isTense = this.inCombat || this.player.hp <= Math.ceil(this.player.maxHp * 0.3);
      if (this.sound) this.sound.update(dt, isTense);

      // 10. Game Over Check
      if (this.player.dead) {
        this._triggerEndgame(false);
      }
    }

    _performParangSlash() {
      const p = this.player;
      if (!p || p.attackCooldown > 0) return;
      p.attackCooldown = 0.42;
      p.parangAnimTimer = 0.36;
      if (p.animParang) p.animParang.reset();
      if (this.sound) this.sound.playParangSlash();

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
      // Hit Mercenaries in 75px arc
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
              if (isStealthTakedown) this.stats.stealthTakedowns++;
              if (killed.role === 'commander') {
                p.inventory.hasKeycard = true;
              }
            }
          });
          if (isStealthTakedown) {
            this.slashEffects[this.slashEffects.length - 1].isStealth = true;
            this._spawnFloat(m.centerX, m.y - 16, 'SILENT TAKEDOWN', '#F85A5A', true);
          } else {
            this._spawnFloat(m.centerX, m.y - 14, String(dmg), '#F85A5A', true);
          }
        }
      }

      // Hit Mutated Boars in 75px arc
      for (let i = 0; i < this.boars.length; i++) {
        const b = this.boars[i];
        if (b.dead) continue;
        const dist = Math.hypot(b.centerX - p.centerX, b.centerY - p.centerY);
        if (dist <= reach + 10) {
          const dmg = b.takeDamage(45, { x: p.centerX, y: p.centerY });
          this._spawnFloat(b.centerX, b.y - 14, String(dmg), '#F85A5A', true);
        }
      }
    }

    _performRangedOrDecoy() {
      const p = this.player;
      const Proj = this.ns.Projectile;
      if (!p || !Proj || p.attackCooldown > 0) return;

      // Auto-pick best ranged weapon if Parang currently active
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
        if (this.sound) this.sound.playSuppressedShot();
        if (this.camera) this.camera.addShake(3, 0.12);
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
        // Small 120px suppressed acoustic ring
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

      // Alert/lure nearby mercenaries
      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        if (!m.dead && Math.hypot(m.centerX - x, m.centerY - y) <= radius) {
          m.hearSound(x, y, false);
        }
      }

      // Provoke Mutated Boars! If mercenaries are near the ravine checkpoint, charge right down the ravine into them!
      if (provokesBoars) {
        for (let i = 0; i < this.boars.length; i++) {
          const b = this.boars[i];
          if (b.dead) continue;
          if (Math.hypot(b.centerX - x, b.centerY - y) <= radius + 140) {
            // Pick closest mercenary within 460px to encourage natural faction infighting, else charge the clatter point
            let targetX = x;
            let targetY = y;
            let bestDist = 460;
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

      // 1. Priority: Silent Rear Stealth Takedown on nearby unalerted Mercenary
      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        if (m.dead || m.state === 'ALERT') continue;
        const dist = Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY);
        if (dist <= 78 && m.isBehindMe(p.centerX, p.centerY)) {
          this._performParangSlash();
          return;
        }
      }

      // 2. Harvest Boar Meat from slain Mutated Boar
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

      // 3. Level Pickups & Interactive Objectives
      const items = this.level.interactables || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.collected) continue;
        if (Math.hypot(it.x - p.centerX, it.y - p.centerY) > 74) continue;

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
          if (this.sound) this.sound.playAlarmKlaxon();
          if (this.camera) this.camera.addShake(7, 0.5);
          if (this.hud) this.hud.showToast('BLAST GATE OVERRIDE INITIATED — SURVIVE 15 SECONDS!', 4.0);
          // Alert nearby Sector 4 guards
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

    _computeInteractHint() {
      const p = this.player;
      if (!p || !this.level) return '';
      for (let i = 0; i < this.mercenaries.length; i++) {
        const m = this.mercenaries[i];
        if (!m.dead && m.state !== 'ALERT' && Math.hypot(m.centerX - p.centerX, m.centerY - p.centerY) <= 78 && m.isBehindMe(p.centerX, p.centerY)) {
          return '[E / HAND] SILENT PARANG TAKEDOWN';
        }
      }
      for (let i = 0; i < this.boars.length; i++) {
        const b = this.boars[i];
        if (b.dead && !b.meatHarvested && Math.hypot(b.centerX - p.centerX, b.centerY - p.centerY) <= 85) {
          return '[E / HAND] HARVEST BOAR MEAT';
        }
      }
      const items = this.level.interactables || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.collected && Math.hypot(it.x - p.centerX, it.y - p.centerY) <= 74) {
          return `[E / HAND] ${it.label.toUpperCase()}`;
        }
      }
      return '';
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

        // Player projectiles hit Mercenaries & Boars
        if (pr.faction === 'PLAYER') {
          let hit = false;
          for (let j = 0; j < this.mercenaries.length; j++) {
            const m = this.mercenaries[j];
            if (m.dead) continue;
            if (Math.hypot(pr.x - m.centerX, pr.y - (m.y + m.height * 0.5)) < 26) {
              const dealt = m.takeDamage(pr.damage, { x: this.player.centerX, y: this.player.centerY }, aiEvents);
              this._spawnFloat(m.centerX, m.y - 14, String(dealt), '#F85A5A', true);
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
          // Mercenary bullets hit BOTH Player AND Mutated Boars (Faction Infighting)
          if (!this.player.dead && Math.hypot(pr.x - this.player.centerX, pr.y - (this.player.y + this.player.height * 0.5)) < 22) {
            const dealt = this.player.takeDamage(pr.damage);
            if (dealt > 0) {
              if (this.camera) this.camera.addShake(6, 0.2);
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
      // Active sector banner
      for (let i = 0; i < l.sectors.length; i++) {
        const s = l.sectors[i];
        if (p.centerX >= s.x && p.centerX < s.x + s.width) {
          this.currentSectorLabel = s.label;
          break;
        }
      }

      // Toxic Rafflesia Spore Zones (Sector 3)
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
            this._spawnFloat(p.centerX, p.y - 12, 'BT-09 SPORE -1', '#F85A5A', false);
          }
        }
      } else {
        p.sporeTickTimer = 0;
      }

      // Sector 4 Red Laser Tripwires
      for (let i = 0; i < l.tripwires.length; i++) {
        const lw = l.tripwires[i];
        if (!lw.active) continue;
        if (
          Math.abs(p.centerX - lw.x1) < 12 &&
          p.centerY >= Math.min(lw.y1, lw.y2) &&
          p.centerY <= Math.max(lw.y1, lw.y2)
        ) {
          lw.active = false;
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
        // Spawn 1 Ironclad responder midway through survival hold
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

      // Check Extraction Zone beyond open Blast Gate
      if (l.blastGateOpen && l.extractionZone) {
        const ez = l.extractionZone;
        if (p.centerX >= ez.x && p.centerX <= ez.x + ez.width && p.centerY >= ez.y && p.centerY <= ez.y + ez.height) {
          this._triggerEndgame(true);
        }
      }
    }

    _updateVisualFx(dt) {
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

      if (stamp) stamp.textContent = victory ? 'OPERATION COMPLETE // ACT 1' : 'MIA // SIGNAL LOST';
      if (title) title.textContent = victory ? 'PERIMETER BLAST GATE BREACHED' : 'OPERATOR KANCIL DOWN';
      if (desc) {
        desc.textContent = victory
          ? 'Operator Kancil crossed the Temenggor Perimeter threshold into the surface warehouse complex above Facility Sub-Zero. Telemetry secured for Act 2.'
          : 'Ironclad forces or BT-09 mutated fauna overwhelmed your position. Remember: stay hidden in dense ferns, behind hollow logs, and turn the wild boars against the mercenaries.';
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
