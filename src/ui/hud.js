// src/ui/hud.js - In-game HUD controller matching reference image-1.png layout
(function (global) {
  'use strict';

  class HUDController {
    constructor(callbacks) {
      this.cb = callbacks || {};
      this.toastTimer = 0;
      this._cacheDom();
      this._buildSegments();
      this._bindEvents();
    }

    _cacheDom() {
      if (typeof document === 'undefined') return;
      this.root = document.getElementById('hud-root');
      this.healthSegmentsEl = document.getElementById('health-segments');
      this.healthTextEl = document.getElementById('health-text');
      this.staminaSegmentsEl = document.getElementById('stamina-segments');
      this.staminaTextEl = document.getElementById('stamina-text');
      this.dayTimeTextEl = document.getElementById('day-time-text');
      this.stealthPillEl = document.getElementById('stealth-status-pill');
      this.sectorBannerEl = document.getElementById('sector-banner');
      this.btnAudioStatus = document.getElementById('btn-audio-status');
      this.blastTimerBannerEl = document.getElementById('blast-timer-banner');
      this.blastTimerSecEl = document.getElementById('blast-timer-sec');
      this.toastEl = document.getElementById('hud-toast');
      this.interactPromptEl = document.getElementById('interact-prompt');

      this.questScrollEl = document.getElementById('quest-scroll');
      this.questToggleBtn = document.getElementById('quest-scroll-toggle');
      this.questChevronEl = document.getElementById('quest-scroll-chevron');
      this.questListEl = document.getElementById('quest-objectives-list');

      this.btnDossier = document.getElementById('btn-util-dossier');
      this.btnBackpack = document.getElementById('btn-util-backpack');
      this.btnWeapons = document.getElementById('btn-util-weapons');
      this.btnSettings = document.getElementById('btn-util-settings');
      this.btnGoHome = document.getElementById('btn-go-home');

      this.utilityModal = document.getElementById('utility-modal');
      this.utilityTitle = document.getElementById('utility-modal-title');
      this.utilityBody = document.getElementById('utility-modal-body');
      this.btnUtilityClose = document.getElementById('btn-utility-close');

      this.weaponSlots = Array.from(document.querySelectorAll('.weapon-slot'));
      this.ammoCrossbowEl = document.getElementById('ammo-crossbow');
      this.ammoPistolEl = document.getElementById('ammo-pistol');
      this.ammoDecoyEl = document.getElementById('ammo-decoy');
      this.bagQuickCountEl = document.getElementById('bag-quick-count');
      this.btnCrouchEl = document.getElementById('btn-action-crouch');
      this.btnHandEl = document.getElementById('btn-action-hand');
      this.btnSprintCenterEl = document.getElementById('btn-sprint-center');
    }

    _buildSegments() {
      if (!this.healthSegmentsEl || !this.staminaSegmentsEl) return;
      this.healthSegmentsEl.innerHTML = '';
      for (let i = 0; i < 11; i++) {
        const seg = document.createElement('div');
        seg.className = 'seg filled';
        this.healthSegmentsEl.appendChild(seg);
      }
      this.staminaSegmentsEl.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const seg = document.createElement('div');
        seg.className = 'seg filled';
        this.staminaSegmentsEl.appendChild(seg);
      }
    }

    _bindEvents() {
      if (this.questToggleBtn && this.questScrollEl) {
        this.questToggleBtn.addEventListener('click', () => {
          const collapsed = this.questScrollEl.classList.toggle('collapsed');
          this.questToggleBtn.setAttribute('aria-expanded', String(!collapsed));
          if (this.questChevronEl) {
            this.questChevronEl.textContent = collapsed ? '▸' : '▾';
          }
        });
      }

      if (this.btnGoHome) {
        this.btnGoHome.addEventListener('click', () => {
          if (this.cb.onOpenCamp) this.cb.onOpenCamp();
        });
      }
      if (this.btnAudioStatus) {
        this.btnAudioStatus.addEventListener('click', () => {
          if (this.cb.onAudioBadgeClick) this.cb.onAudioBadgeClick();
        });
      }

      if (this.btnDossier) {
        this.btnDossier.addEventListener('click', () => this.openUtility('dossier'));
      }
      if (this.btnBackpack) {
        this.btnBackpack.addEventListener('click', () => this.openUtility('backpack'));
      }
      if (this.btnWeapons) {
        this.btnWeapons.addEventListener('click', () => this.openUtility('weapons'));
      }
      if (this.btnSettings) {
        this.btnSettings.addEventListener('click', () => this.openUtility('settings'));
      }
      if (this.btnUtilityClose) {
        this.btnUtilityClose.addEventListener('click', () => this.closeUtility());
      }

      for (let i = 0; i < this.weaponSlots.length; i++) {
        const slot = this.weaponSlots[i];
        slot.addEventListener('click', () => {
          const weaponId = slot.getAttribute('data-weapon');
          if (this.cb.onSelectWeapon) this.cb.onSelectWeapon(weaponId);
        });
      }
    }

    show() {
      if (this.root) this.root.classList.remove('hud-hidden');
    }

    hide() {
      if (this.root) this.root.classList.add('hud-hidden');
    }

    showToast(msg, durationSec) {
      if (!this.toastEl) return;
      this.toastEl.textContent = msg;
      this.toastEl.classList.remove('hidden');
      this.toastTimer = durationSec || 2.8;
    }

    openUtility(tab) {
      if (!this.utilityModal || !this.utilityTitle || !this.utilityBody) return;
      const snapshot = this.cb.getSnapshot ? this.cb.getSnapshot() : null;
      this.utilityModal.classList.remove('hidden');

      if (tab === 'dossier') {
        this.utilityTitle.textContent = 'CLASSIFIED FIELD DOSSIER // GGK COMMAND';
        const drives = snapshot && snapshot.player ? snapshot.player.inventory.decryptedLore : [];
        const loreHtml = drives.length
          ? drives.map((l) => `<div class="utility-item"><strong>${l.title}</strong><br/>${l.body}</div>`).join('')
          : '<div class="utility-item">No VBS drives decrypted yet. Recover Encrypted Drive 01 in the Logging Outpost and decrypt it at the Go Home Bivouac camp.</div>';
        this.utilityBody.innerHTML = `
          <p><strong>OPERATOR:</strong> Kancil (Codename: SPECTRE) &bull; <strong>REGION:</strong> Belum-Temengor Rainforest, Perak</p>
          <p><strong>PRIMARY DIRECTIVE:</strong> Infiltrate Sungai Belum, secure Tier-1 Clearance, provoke local BT-09 mutated fauna against Ironclad PMC checkpoints, and breach the Temenggor Perimeter Blast Gate.</p>
          <div class="utility-grid">${loreHtml}</div>
        `;
      } else if (tab === 'backpack') {
        this.utilityTitle.textContent = 'TACTICAL BACKPACK & SCAVENGED SUPPLIES';
        const inv = snapshot && snapshot.player ? snapshot.player.inventory : {};
        this.utilityBody.innerHTML = `
          <div class="utility-grid">
            <div class="utility-item"><strong>Tier-1 Security Keycard:</strong> ${inv.hasKeycard ? 'ACQUIRED' : 'Missing'}</div>
            <div class="utility-item"><strong>Encrypted VBS Drives:</strong> ${inv.encryptedDrives || 0} (Decrypted: ${(inv.decryptedLore || []).length})</div>
            <div class="utility-item"><strong>Jungle Stew Ration (+6 HP):</strong> ${inv.jungleStew || 0}</div>
            <div class="utility-item"><strong>Pure Drinking Water (+50% Stamina):</strong> ${inv.pureWater || 0}</div>
            <div class="utility-item"><strong>Dirty Rainwater:</strong> ${inv.dirtyWater || 0}</div>
            <div class="utility-item"><strong>Wild Bamboo Shoots:</strong> ${inv.bambooShoots || 0}</div>
            <div class="utility-item"><strong>Harvested Boar Meat:</strong> ${inv.boarMeat || 0}</div>
            <div class="utility-item"><strong>Scrap Wire:</strong> ${inv.scrapWire || 0}</div>
          </div>
        `;
      } else if (tab === 'weapons') {
        this.utilityTitle.textContent = 'ARSENAL & HARDCORE STEALTH DOCTRINE';
        this.utilityBody.innerHTML = `
          <div class="utility-grid">
            <div class="utility-item"><strong>[1] Steel Parang</strong><br/>75px silent arc. Instant Stealth Takedown on unalerted guards from behind; 45 dmg open melee.</div>
            <div class="utility-item"><strong>[2] Crossbow</strong><br/>450px silent bolt (55 dmg). Retrievable bolts drop upon impact or neutralization.</div>
            <div class="utility-item"><strong>[3] Suppressed 9mm</strong><br/>550px fast round (70 dmg). Quiet 120px acoustic ring.</div>
            <div class="utility-item"><strong>[4] Decoy Rocks</strong><br/>Lob up to 300px. Lures guards &amp; provokes Mutated Boars into charging mercenaries.</div>
          </div>
        `;
      } else {
        this.utilityTitle.textContent = 'FIELD SETTINGS & AUDIO';
        const muted = snapshot && snapshot.audioMuted;
        const settings = (snapshot && snapshot.settings) || { shake: 100, reduceFlash: false };
        const shakeVal = Number.isFinite(settings.shake) ? Math.round(settings.shake) : 100;
        const reduceFlash = !!settings.reduceFlash;
        this.utilityBody.innerHTML = `
          <p>Procedural Web Audio Synthesizer (Tropical Rain, Belum Cicadas, Parang, Weapons, Radio Alerts).</p>
          <button id="btn-toggle-mute" class="ink-btn primary">${muted ? 'UNMUTE AUDIO' : 'MUTE AUDIO'}</button>
          <div class="utility-grid" style="margin-top:14px;">
            <div class="utility-item">
              <label for="setting-shake-slider"><strong>Screen shake:</strong> <span id="setting-shake-val">${shakeVal}%</span></label><br/>
              <input id="setting-shake-slider" type="range" min="0" max="100" step="5" value="${shakeVal}" style="width:100%;margin-top:6px;accent-color:#111E33;" />
            </div>
            <div class="utility-item">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input id="setting-reduce-flash" type="checkbox" ${reduceFlash ? 'checked' : ''} style="width:16px;height:16px;accent-color:#111E33;" />
                <strong>Reduce flashing</strong>
              </label>
              <div style="font-size:11px;margin-top:4px;opacity:0.85;">Replaces pulsing red hurt-flash rings with a steady soft tint.</div>
            </div>
          </div>
          <p style="margin-top:14px;"><strong>Controls:</strong> WASD / Arrows or Bottom-Left D-Pad to move &bull; C to Crouch/Fern Conceal &bull; Shift to Sprint &bull; Left Click / Slash for Primary Attack &bull; Right Click / Fire for Ranged &bull; E / Hand to Interact or Stealth Takedown &bull; Q / Bag for Quick Heal/Water &bull; B / Go Home for Bivouac Camp.</p>
        `;
        const muteBtn = document.getElementById('btn-toggle-mute');
        if (muteBtn) {
          muteBtn.addEventListener('click', () => {
            if (this.cb.onToggleMute) this.cb.onToggleMute();
            this.openUtility('settings');
          });
        }
        const shakeSlider = document.getElementById('setting-shake-slider');
        const shakeLabel = document.getElementById('setting-shake-val');
        if (shakeSlider) {
          shakeSlider.addEventListener('input', () => {
            const val = Number(shakeSlider.value);
            if (shakeLabel) shakeLabel.textContent = `${val}%`;
            if (this.cb.onUpdateSettings) this.cb.onUpdateSettings({ shake: val });
          });
        }
        const flashToggle = document.getElementById('setting-reduce-flash');
        if (flashToggle) {
          flashToggle.addEventListener('change', () => {
            if (this.cb.onUpdateSettings) this.cb.onUpdateSettings({ reduceFlash: !!flashToggle.checked });
          });
        }
      }
    }

    closeUtility() {
      if (this.utilityModal) this.utilityModal.classList.add('hidden');
    }

    update(state, dt) {
      if (!state || !state.player) return;
      const p = state.player;

      // Update toast timer
      if (this.toastTimer > 0) {
        this.toastTimer = Math.max(0, this.toastTimer - (dt || 0.016));
        if (this.toastTimer === 0 && this.toastEl) {
          this.toastEl.classList.add('hidden');
        }
      }

      // Health segmented bar (11 HP)
      if (this.healthSegmentsEl) {
        const segs = this.healthSegmentsEl.children;
        const filledCount = Math.max(0, Math.min(segs.length, Math.ceil(p.hp)));
        for (let i = 0; i < segs.length; i++) {
          segs[i].classList.toggle('filled', i < filledCount);
        }
      }
      if (this.healthTextEl) {
        this.healthTextEl.textContent = `${Math.max(0, Math.ceil(p.hp))}/${p.maxHp} HP`;
      }

      // Stamina segmented bar
      if (this.staminaSegmentsEl) {
        const segs = this.staminaSegmentsEl.children;
        const ratio = p.maxStamina > 0 ? p.stamina / p.maxStamina : 0;
        const filledCount = Math.round(ratio * segs.length);
        for (let i = 0; i < segs.length; i++) {
          segs[i].classList.toggle('filled', i < filledCount);
        }
        this.staminaSegmentsEl.classList.toggle('hydrated', p.hydrationBuffTimer > 0);
      }
      if (this.staminaTextEl) {
        this.staminaTextEl.textContent = p.hydrationBuffTimer > 0
          ? `HYDRATED +50% (${Math.ceil(p.hydrationBuffTimer)}s)`
          : `STAMINA ${Math.round(p.stamina)}%`;
      }

      // Day / Time ink badge (Starts Day 17 | 03:40 AM, advances gently)
      if (this.dayTimeTextEl) {
        const totalMinutes = Math.floor(220 + (state.elapsedSec || 0) * 0.5);
        const hrs24 = Math.floor(totalMinutes / 60) % 24;
        const mins = totalMinutes % 60;
        const period = hrs24 >= 12 ? 'PM' : 'AM';
        const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;
        const minStr = mins < 10 ? `0${mins}` : `${mins}`;
        this.dayTimeTextEl.textContent = `Day 17 | ${hrs12}:${minStr} ${period}`;
      }

      // Stealth / Alert pill
      if (this.stealthPillEl) {
        if (state.inCombat) {
          this.stealthPillEl.textContent = 'ALERT // COMPROMISED';
          this.stealthPillEl.className = 'stealth-pill alert';
        } else if (p.isConcealed) {
          this.stealthPillEl.textContent = 'CONCEALED (INVISIBLE)';
          this.stealthPillEl.className = 'stealth-pill concealed';
        } else if (p.crouching) {
          this.stealthPillEl.textContent = 'CROUCHING (QUIET)';
          this.stealthPillEl.className = 'stealth-pill';
        } else {
          this.stealthPillEl.textContent = 'EXPOSED';
          this.stealthPillEl.className = 'stealth-pill';
        }
      }

      // Active sector banner & persistent audio badge
      if (this.sectorBannerEl && state.currentSectorLabel) {
        this.sectorBannerEl.textContent = state.currentSectorLabel;
      }
      if (this.btnAudioStatus && state.audioStatusLabel) {
        this.btnAudioStatus.textContent = state.audioStatusLabel;
        this.btnAudioStatus.classList.toggle('active', !!state.audioActive);
        this.btnAudioStatus.classList.toggle('pulsing', !state.audioActive);
      }

      // Blast door 15-second survival countdown
      if (this.blastTimerBannerEl && this.blastTimerSecEl) {
        if (state.level && state.level.blastGateOpening && !state.level.blastGateOpen) {
          this.blastTimerBannerEl.classList.remove('hidden');
          this.blastTimerSecEl.textContent = Math.max(0, state.level.blastGateTimer).toFixed(1);
        } else {
          this.blastTimerBannerEl.classList.add('hidden');
        }
      }

      // Weapon bar sync
      for (let i = 0; i < this.weaponSlots.length; i++) {
        const slot = this.weaponSlots[i];
        const wid = slot.getAttribute('data-weapon');
        slot.classList.toggle('active', p.activeWeapon === wid);
        const unlocked = p.unlockedWeapons && p.unlockedWeapons[wid];
        slot.classList.toggle('locked', !unlocked);
      }
      if (this.ammoCrossbowEl) this.ammoCrossbowEl.textContent = String(p.ammo.crossbow || 0);
      if (this.ammoPistolEl) this.ammoPistolEl.textContent = String(p.ammo.pistol || 0);
      if (this.ammoDecoyEl) this.ammoDecoyEl.textContent = String(p.ammo.decoy || 0);

      // Quick bag count
      if (this.bagQuickCountEl) {
        const usable = (p.inventory.jungleStew || 0) + (p.inventory.pureWater || 0);
        this.bagQuickCountEl.textContent = usable > 0 ? `BAG(${usable})` : 'BAG';
      }

      // Crouch & Sprint button states
      if (this.btnCrouchEl) {
        this.btnCrouchEl.classList.toggle('active', !!p.crouching);
      }
      if (this.btnSprintCenterEl) {
        this.btnSprintCenterEl.classList.toggle('sprinting', !!p.sprinting);
      }

      // Context interaction prompt
      if (this.interactPromptEl) {
        if (state.interactHint) {
          this.interactPromptEl.textContent = state.interactHint;
          this.interactPromptEl.classList.remove('hidden');
          if (this.btnHandEl) this.btnHandEl.classList.add('ready');
        } else {
          this.interactPromptEl.classList.add('hidden');
          if (this.btnHandEl) this.btnHandEl.classList.remove('ready');
        }
      }

      // Objectives scroll
      if (this.questListEl && Array.isArray(state.objectives)) {
        const key = state.objectives.map((o) => `${o.id}:${o.done}`).join('|');
        if (key !== this._lastObjectiveKey) {
          this._lastObjectiveKey = key;
          let foundActive = false;
          this.questListEl.innerHTML = state.objectives.map((o) => {
            const isActive = !o.done && !foundActive;
            if (isActive) foundActive = true;
            const cls = o.done ? 'done' : (isActive ? 'active-obj' : '');
            const mark = o.done ? '[✓]' : (isActive ? '[>]' : '[ ]');
            return `<li class="${cls}"><span>${mark}</span><span>${o.text}</span></li>`;
          }).join('');
        }
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HUDController;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.HUDController = HUDController;
})(typeof window !== 'undefined' ? window : globalThis);
