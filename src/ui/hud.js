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
      this.hydrationGaugeEl = document.getElementById('hydration-gauge');
      this.hydrationFillEl = document.getElementById('hydration-fill');
      this.hydrationTextEl = document.getElementById('hydration-text');
      this.energyGaugeEl = document.getElementById('energy-gauge');
      this.energyFillEl = document.getElementById('energy-fill');
      this.energyTextEl = document.getElementById('energy-text');
      this.statusEffectsEl = document.getElementById('status-effects-row');
      this.sporeBlurEl = document.getElementById('spore-blur-overlay');
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
      this.utilityPausedBadge = document.getElementById('utility-paused-badge');
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

    isUtilityOpen() {
      return !!(this.utilityModal && !this.utilityModal.classList.contains('hidden'));
    }

    openUtility(tab) {
      if (!this.utilityModal || !this.utilityTitle || !this.utilityBody) return;
      if (this.cb.onUtilityOpen) this.cb.onUtilityOpen(tab);
      const snapshot = this.cb.getSnapshot ? this.cb.getSnapshot() : null;
      this.utilityModal.classList.remove('hidden');
      if (this.utilityPausedBadge) {
        this.utilityPausedBadge.classList.toggle('hidden', !(snapshot && snapshot.isPaused));
      }

      if (tab === 'dossier') {
        this.utilityTitle.textContent = 'MISSION LOG & SERVICE RECORD // GGK COMMAND';
        const pl = snapshot && snapshot.player ? snapshot.player : null;
        const drives = pl ? pl.inventory.decryptedLore : [];
        const prof = (pl && pl.proficiency) || { closeQuarters: 0, fieldcraft: 0, marksmanship: 0, fieldMedic: 0 };
        const rankOf = (n) => (n >= 12 ? 2 : n >= 5 ? 1 : 0);
        const profDefs = [
          { key: 'closeQuarters', name: 'Close Quarters', r1: 'Takedown 0.6s -> 0.45s', r2: 'Silent body drag' },
          { key: 'fieldcraft', name: 'Fieldcraft', r1: 'Footsteps 15% quieter', r2: 'Searches 25% faster' },
          { key: 'marksmanship', name: 'Marksmanship', r1: 'Sway reduced', r2: 'Auto-recover bolts within 60px' },
          { key: 'fieldMedic', name: 'Field Medic', r1: 'Bandage 2.0s -> 1.2s', r2: '+1 Max HP' }
        ];
        const serviceHtml = profDefs.map((d) => {
          const count = prof[d.key] || 0;
          const rk = rankOf(count);
          const next = rk === 0 ? `${count}/5` : (rk === 1 ? `${count}/12` : `${count} — MAX`);
          const trait = rk === 2 ? `${d.r1} &bull; ${d.r2}` : (rk === 1 ? d.r1 : `Next (5): ${d.r1}`);
          return `<div class="utility-item"><strong>${d.name} — Rank ${rk}</strong> (${next})<br/><span style="font-size:11px;opacity:0.9;">${trait}</span></div>`;
        }).join('');
        const loreHtml = drives.length
          ? drives.map((l) => `<div class="utility-item"><strong>${l.title}</strong><br/>${l.body}</div>`).join('')
          : '<div class="utility-item">No VBS drives decrypted yet. Recover Encrypted Drive 01 in the Logging Outpost and decrypt it at a Field Cache (basha site).</div>';
        this.utilityBody.innerHTML = `
          <p><strong>OPERATOR:</strong> Kancil (Codename: SPECTRE) &bull; <strong>REGION:</strong> Belum-Temengor Rainforest, Perak</p>
          <p><strong>PRIMARY DIRECTIVE:</strong> Infiltrate Sungai Belum, secure Tier-1 Clearance (Lab Safe 4719 or Commander Ward), and breach the Temenggor Perimeter Blast Gate.</p>
          <h3 style="margin:12px 0 6px;font-size:13px;letter-spacing:1px;">SERVICE RECORD // OPERATOR PROFICIENCY</h3>
          <div class="utility-grid" id="service-record-grid" style="grid-template-columns:repeat(2,minmax(0,1fr));">${serviceHtml}</div>
          <h3 style="margin:14px 0 6px;font-size:13px;letter-spacing:1px;">RECOVERED TELEMETRY &amp; INTEL</h3>
          <div class="utility-grid">${loreHtml}</div>
        `;
      } else if (tab === 'backpack') {
        this.utilityTitle.textContent = 'TACTICAL BACKPACK & SALVAGED SUPPLIES';
        const pl = snapshot && snapshot.player ? snapshot.player : null;
        const inv = pl ? pl.inventory : {};
        this.utilityBody.innerHTML = `
          <div class="utility-grid">
            <div class="utility-item"><strong>Tier-1 Security Keycard:</strong> ${inv.hasKeycard ? 'ACQUIRED' : 'Missing'}</div>
            <div class="utility-item"><strong>Encrypted VBS Drives:</strong> ${inv.encryptedDrives || 0} (Decrypted: ${(inv.decryptedLore || []).length})</div>
            <div class="utility-item"><strong>Medical Kit (+4 HP):</strong> ${inv.medkit || 0}</div>
            <div class="utility-item"><strong>Bandages [H] / Tourniquets [Y]:</strong> ${inv.bandage || 0} / ${inv.tourniquet || 0}</div>
            <div class="utility-item"><strong>Field Ration (MRE) / Energy Gel:</strong> ${inv.jungleStew || 0} / ${inv.energyGel || 0}</div>
            <div class="utility-item"><strong>Purified Water / Purif. Tabs:</strong> ${inv.pureWater || 0} / ${inv.purificationTabs || 0}</div>
            <div class="utility-item"><strong>Dirty Rainwater / Bamboo Shoots:</strong> ${inv.dirtyWater || 0} / ${inv.bambooShoots || 0}</div>
            <div class="utility-item"><strong>Respirator Mask [R]:</strong> ${inv.filterMask ? `${pl.filterMaskOn ? 'ON' : 'OFF'} (${Math.ceil(pl.filterCartridgeTimer || 0)}s)` : 'Missing'} &bull; Cartridges: ${inv.filterCartridge || 0}</div>
            <div class="utility-item"><strong>Spore Auto-Injector:</strong> ${inv.sporeInjector || 0}</div>
            <div class="utility-item"><strong>Improvised Gear:</strong> Tripwire Flare [F]: ${inv.tripwireFlares || 0} &bull; Smoke Rag [G]: ${inv.smokeRags || 0} &bull; Jammer [T]: ${inv.radioJammers || 0}</div>
            <div class="utility-item"><strong>Salvage Materials:</strong> Wire ${inv.scrapWire || 0} &bull; Can ${inv.emptyCan || 0} &bull; Flare ${inv.flare || 0} &bull; Diesel ${inv.diesel || 0} &bull; Rag ${inv.rag || 0} &bull; Radio ${inv.radioParts || 0} &bull; Battery ${inv.battery || 0}</div>
            <div class="utility-item"><strong>Boar Meat:</strong> ${inv.boarMeat || 0}</div>
          </div>
        `;
      } else if (tab === 'weapons') {
        this.utilityTitle.textContent = 'ARSENAL & HARDCORE STEALTH DOCTRINE';
        this.utilityBody.innerHTML = `
          <div class="utility-grid">
            <div class="utility-item"><strong>[1] Steel Parang</strong><br/>75px silent arc (45 dmg melee). Hold [E] 0.6s inside 120&deg; rear cone for silent takedown.</div>
            <div class="utility-item"><strong>[2] Compound Crossbow</strong><br/>450px silent carbon bolt (60 dmg — 1-shot rifleman from stealth). Retrievable bolts.</div>
            <div class="utility-item"><strong>[3] Suppressed 9mm</strong><br/>550px fast round (55 dmg, 1-shot headshot zone). 220px gunshot noise radius.</div>
            <div class="utility-item"><strong>[4] Noisemaker</strong><br/>Throw up to 300px. Lures guards &amp; provokes Mutated Boars into charging mercenaries.</div>
          </div>
        `;
      } else {
        this.utilityTitle.textContent = 'FIELD SETTINGS & AUDIO';
        const muted = snapshot && snapshot.audioMuted;
        const settings = (snapshot && snapshot.settings) || { shake: 100, reduceFlash: false, difficulty: 'operator' };
        const shakeVal = Number.isFinite(settings.shake) ? Math.round(settings.shake) : 100;
        const reduceFlash = !!settings.reduceFlash;
        const diff = settings.difficulty || 'operator';
        this.utilityBody.innerHTML = `
          <p>Procedural Web Audio Synthesizer (Tropical Rain, Belum Cicadas, Parang, Weapons, Radio Alerts).</p>
          <button id="btn-toggle-mute" class="ink-btn primary">${muted ? 'UNMUTE AUDIO' : 'MUTE AUDIO'}</button>
          <div class="utility-item" style="margin-top:14px;">
            <strong>Difficulty:</strong>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
              <button class="ink-btn ${diff === 'recruit' ? 'primary' : 'secondary'} btn-diff-opt" data-diff="recruit">RECRUIT (14 HP)</button>
              <button class="ink-btn ${diff === 'operator' ? 'primary' : 'secondary'} btn-diff-opt" data-diff="operator">OPERATOR (11 HP)</button>
              <button class="ink-btn ${diff === 'black_op' ? 'primary' : 'secondary'} btn-diff-opt" data-diff="black_op">BLACK OP (9 HP)</button>
            </div>
            <div style="font-size:11px;margin-top:6px;opacity:0.85;">Adjusts operator max HP, enemy bullet lethality, suspicion fill speed, and survival needs drain.</div>
          </div>
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
          <p style="margin-top:14px;"><strong>Controls:</strong> WASD / Arrows or Bottom-Left D-Pad to move &bull; C to Crouch/Fern Conceal &bull; Shift to Sprint &bull; Left Click / Slash for Primary Attack &bull; Right Click / Fire for Ranged &bull; Hold E / Hand for Stealth Takedown &amp; Interact &bull; Q / Bag for Quick Ration/Medkit &bull; Esc for Settings.</p>
        `;
        const muteBtn = document.getElementById('btn-toggle-mute');
        if (muteBtn) {
          muteBtn.addEventListener('click', () => {
            if (this.cb.onToggleMute) this.cb.onToggleMute();
            this.openUtility('settings');
          });
        }
        const diffBtns = this.utilityBody.querySelectorAll('.btn-diff-opt');
        for (let i = 0; i < diffBtns.length; i++) {
          diffBtns[i].addEventListener('click', () => {
            const nextDiff = diffBtns[i].getAttribute('data-diff');
            if (this.cb.onUpdateSettings) this.cb.onUpdateSettings({ difficulty: nextDiff });
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
      const wasOpen = this.isUtilityOpen();
      if (this.utilityModal) this.utilityModal.classList.add('hidden');
      if (this.utilityPausedBadge) this.utilityPausedBadge.classList.add('hidden');
      if (wasOpen && this.cb.onUtilityClose) this.cb.onUtilityClose();
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

      // Health segmented bar (scales dynamically with difficulty: 14 Recruit / 11 Operator / 9 Black Op)
      if (this.healthSegmentsEl) {
        const targetSegs = Math.max(1, Math.round(p.maxHp || 11));
        if (this.healthSegmentsEl.children.length !== targetSegs) {
          this.healthSegmentsEl.innerHTML = '';
          for (let i = 0; i < targetSegs; i++) {
            const seg = document.createElement('div');
            seg.className = 'seg filled';
            this.healthSegmentsEl.appendChild(seg);
          }
        }
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
      const effMaxStam = typeof p.getEffectiveMaxStamina === 'function' ? p.getEffectiveMaxStamina() : p.maxStamina;
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
          : `STAMINA ${Math.round(p.stamina)}/${Math.round(effMaxStam)}`;
      }

      // Task 6a: Hydration & Energy ink gauges (pulse at <= 25%)
      const hyd = Number.isFinite(p.hydration) ? Math.max(0, Math.min(100, p.hydration)) : 100;
      const eng = Number.isFinite(p.energy) ? Math.max(0, Math.min(100, p.energy)) : 100;
      if (this.hydrationFillEl) this.hydrationFillEl.style.width = `${hyd.toFixed(1)}%`;
      if (this.hydrationTextEl) this.hydrationTextEl.textContent = `${Math.round(hyd)}%`;
      if (this.hydrationGaugeEl) this.hydrationGaugeEl.classList.toggle('warning', hyd <= 25);

      if (this.energyFillEl) this.energyFillEl.style.width = `${eng.toFixed(1)}%`;
      if (this.energyTextEl) this.energyTextEl.textContent = `${Math.round(eng)}%`;
      if (this.energyGaugeEl) this.energyGaugeEl.classList.toggle('warning', eng <= 25);

      // Task 6b: Spore full-meter blurred vision overlay
      if (this.sporeBlurEl) {
        this.sporeBlurEl.classList.toggle('hidden', (p.sporeExposure || 0) < 100);
      }

      // Task 6b: Active injury & respirator status chips
      if (this.statusEffectsEl) {
        const chips = [];
        if (p.bleeding) chips.push({ id: 'bleed', text: 'BLEEDING [H: BANDAGE]', cls: 'danger' });
        if (p.tourniquetRestricted) chips.push({ id: 'tourn', text: 'TOURNIQUET (-20% SPD)', cls: 'danger' });
        if ((p.sporeExposure || 0) >= 1) {
          chips.push({ id: 'spore', text: `SPORES ${Math.round(p.sporeExposure)}%`, cls: p.sporeExposure >= 60 ? 'danger' : '' });
        }
        if (p.inventory && p.inventory.filterMask) {
          const secs = Math.ceil(p.filterCartridgeTimer || 0);
          chips.push({ id: 'mask', text: p.filterMaskOn ? `MASK ON (${secs}s)` : `MASK OFF (${secs}s)`, cls: p.filterMaskOn ? 'active-mask' : '' });
        }
        if ((p.leeches || 0) > 0) {
          chips.push({ id: 'leech', text: `LEECHES x${p.leeches} (-${p.leeches * 10}% STA)`, cls: 'danger' });
        }
        const chipKey = chips.map((c) => `${c.id}:${c.text}`).join('|');
        if (chipKey !== this._lastStatusChipKey) {
          this._lastStatusChipKey = chipKey;
          this.statusEffectsEl.innerHTML = '';
          for (let i = 0; i < chips.length; i++) {
            const c = chips[i];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `status-chip ${c.cls}`;
            btn.textContent = c.text;
            btn.addEventListener('click', () => {
              if (c.id === 'bleed' && this.cb.onStartBandage) this.cb.onStartBandage();
              else if (c.id === 'mask' && this.cb.onToggleFilterMask) this.cb.onToggleFilterMask();
              else if (c.id === 'spore' && this.cb.onUseSporeInjector) this.cb.onUseSporeInjector();
            });
            this.statusEffectsEl.appendChild(btn);
          }
        }
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
        const usable = (p.inventory.medkit || 0) + (p.inventory.jungleStew || 0) + (p.inventory.pureWater || 0);
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
