// src/ui/camp.js - Field Cache / Basha Site Overlay (Rest + Checkpoint, Purify, Hexamine Stove, Workbench, Radio)
(function (global) {
  'use strict';

  const VBS_LORE_ENTRIES = [
    {
      title: 'VBS TELEMETRY DRIVE 01 // BT-09 "RUST SPORE"',
      body: 'LOG 19-NOV-2026: Chemical runoff from Pulau Banding processing tanks entered the Sungai Belum limestone ravine. Wild Babi Hutan subjects show 300% aggression spikes and dermal ossification. Acoustic disturbances trigger indiscriminate charge behavior. FIELD LAB SAFE CODE: 4719 (Tier-1 Keycard backup inside Sector 2 VBS Field Lab safe).'
    },
    {
      title: 'VBS TELEMETRY DRIVE 02 // FACILITY SUB-ZERO',
      body: 'COMMANDER WARD EYES ONLY: Blast Gate hydraulic override requires Tier-1 Clearance swipe followed by a 15-second pressure cycle. Power the Sector 3 Ravine Pump Station to drain the auxiliary drainage culvert.'
    }
  ];

  class BivouacCamp {
    constructor(callbacks) {
      this.cb = callbacks || {};
      this.isOpen = false;
      this.bashaSite = null;
      this.getHandlerHint = null;
      this._leechTimerId = null;
      this._removingLeeches = false;
      this._cacheDom();
      this._bindEvents();
    }

    _cacheDom() {
      if (typeof document === 'undefined') return;
      this.modal = document.getElementById('camp-modal');
      this.siteTitle = document.getElementById('camp-site-title');
      this.statusMsg = document.getElementById('camp-status-msg');
      this.btnClose = document.getElementById('btn-camp-close');

      this.btnRest = document.getElementById('btn-camp-rest');
      this.btnLeeches = document.getElementById('btn-camp-leeches');

      this.waterCounts = document.getElementById('camp-water-counts');
      this.cookCounts = document.getElementById('camp-cook-counts');
      this.benchCounts = document.getElementById('camp-bench-counts');
      this.recipesList = document.getElementById('camp-recipes-list');
      this.decryptCounts = document.getElementById('camp-decrypt-counts');
      this.loreOutput = document.getElementById('camp-lore-output');

      this.btnCraftWater = document.getElementById('btn-craft-water');
      this.btnCraftStew = document.getElementById('btn-craft-stew');
      this.btnDecrypt = document.getElementById('btn-decrypt-drive');
      this.btnRadioHint = document.getElementById('btn-radio-hint');
    }

    _bindEvents() {
      if (this.btnClose) {
        this.btnClose.addEventListener('click', () => this.close());
      }
      if (this.btnRest) {
        this.btnRest.addEventListener('click', () => this.restAtBasha());
      }
      if (this.btnLeeches) {
        this.btnLeeches.addEventListener('click', () => this._startRemoveLeeches());
      }
      if (this.btnCraftWater) {
        this.btnCraftWater.addEventListener('click', () => this._craftWater());
      }
      if (this.btnCraftStew) {
        this.btnCraftStew.addEventListener('click', () => this._grillBoarStrips());
      }
      if (this.btnDecrypt) {
        this.btnDecrypt.addEventListener('click', () => this._decryptDrive());
      }
      if (this.btnRadioHint) {
        this.btnRadioHint.addEventListener('click', () => this._requestHandlerHint());
      }
    }

    open(player, bashaSite, getHandlerHint) {
      this.player = player;
      this.bashaSite = bashaSite || { id: 'basha_field', label: 'Hidden Basha Site', restedThisVisit: false };
      this.bashaSite.restedThisVisit = false; // Allow +2 HP top-up once per visit
      this.getHandlerHint = typeof getHandlerHint === 'function' ? getHandlerHint : null;
      this.isOpen = true;
      this._removingLeeches = false;
      if (this._leechTimerId) {
        clearTimeout(this._leechTimerId);
        this._leechTimerId = null;
      }
      if (this.siteTitle) {
        this.siteTitle.textContent = `FIELD CACHE // ${(this.bashaSite.label || 'BASHA SITE').toUpperCase()}`;
      }
      if (this.modal) this.modal.classList.remove('hidden');
      this._setStatus('Sheltered beneath the basha tarp. Rest to save your checkpoint or use a station below.');
      this.refresh();
    }

    close() {
      this.isOpen = false;
      this._removingLeeches = false;
      if (this._leechTimerId) {
        clearTimeout(this._leechTimerId);
        this._leechTimerId = null;
      }
      if (this.modal) this.modal.classList.add('hidden');
      if (this.cb.onClose) this.cb.onClose();
    }

    _setStatus(msg) {
      if (this.statusMsg) this.statusMsg.textContent = msg;
    }

    restAtBasha() {
      const p = this.player;
      if (!p) return;
      const hadLeeches = p.leeches > 0;
      const hadTourniquet = !!p.tourniquetRestricted;
      p.leeches = 0;
      p.tourniquetRestricted = false;
      p.stamina = typeof p.getEffectiveMaxStamina === 'function' ? p.getEffectiveMaxStamina() : p.maxStamina;
      let healed = 0;
      if (this.bashaSite && !this.bashaSite.restedThisVisit) {
        healed = typeof p.heal === 'function' ? p.heal(2) : 0;
        this.bashaSite.restedThisVisit = true;
      }
      const notes = ['Stamina restored', 'Checkpoint saved'];
      if (healed > 0) notes.unshift(`+${healed} HP`);
      if (hadLeeches) notes.push('Leeches removed');
      if (hadTourniquet) notes.push('Tourniquet dressed (move speed restored)');
      this._setStatus(`Rested under tarp: ${notes.join(' • ')}.`);
      if (this.cb.onRestCheckpoint) this.cb.onRestCheckpoint(this.bashaSite);
      this.refresh();
    }

    _startRemoveLeeches() {
      const p = this.player;
      if (!p || p.leeches <= 0 || this._removingLeeches) return;
      this._removingLeeches = true;
      this._setStatus('Removing jungle leeches with salt & lighter... (3s)');
      if (this.btnLeeches) {
        this.btnLeeches.disabled = true;
        this.btnLeeches.textContent = 'REMOVING LEECHES (3s)...';
      }
      this._leechTimerId = setTimeout(() => {
        this._leechTimerId = null;
        this._removingLeeches = false;
        if (!this.isOpen || !this.player) return;
        this.player.leeches = 0;
        this._setStatus('All leeches removed. Max stamina restored.');
        if (this.cb.onCraftSuccess) this.cb.onCraftSuccess('leeches');
        this.refresh();
      }, 3000);
    }

    _craftWater() {
      const p = this.player;
      if (!p) return;
      const dirty = p.inventory.dirtyWater || 0;
      const tabs = p.inventory.purificationTabs || 0;
      if (dirty < 1 || tabs < 1) {
        this._setStatus(`Need 1 Dirty Water (${dirty}/1) + 1 Purification Tablet (${tabs}/1).`);
        return;
      }
      p.inventory.dirtyWater -= 1;
      p.inventory.purificationTabs -= 1;
      p.inventory.pureWater += 1;
      this._setStatus('Purified 1 canteen of drinking water (+60% Hydration). Press [Q] in the field to hydrate.');
      if (this.cb.onCraftSuccess) this.cb.onCraftSuccess('water');
      this.refresh();
    }

    _grillBoarStrips() {
      const p = this.player;
      if (!p) return;
      if (p.inventory.boarMeat < 1) {
        this._setStatus('Requires 1 pack of Boar Meat taken from a downed boar.');
        return;
      }
      p.inventory.boarMeat -= 1;
      p.inventory.jungleStew += 1;
      this._setStatus('Prepared 1 pack of Grilled Boar Strips (Field Ration: +2 HP, +50% Energy).');
      if (this.cb.onCraftSuccess) this.cb.onCraftSuccess('ration');
      this.refresh();
    }

    _craftImprovised(recipeId) {
      const p = this.player;
      const Recipes = global.BelumGame && global.BelumGame.FieldRecipes;
      if (!p || !Recipes) return;
      const result = Recipes.craftRecipe(recipeId, p);
      this._setStatus(result.message);
      if (result.ok && this.cb.onCraftSuccess) {
        this.cb.onCraftSuccess(recipeId);
      }
      this.refresh();
    }

    _decryptDrive() {
      const p = this.player;
      if (!p) return;
      if (p.inventory.encryptedDrives < 1) {
        this._setStatus('No encrypted VBS drives in pack. Recover Drive 01 from the Outpost Field Lab.');
        return;
      }
      p.inventory.encryptedDrives -= 1;
      const idx = Math.min(VBS_LORE_ENTRIES.length - 1, p.inventory.decryptedLore.length);
      const entry = VBS_LORE_ENTRIES[idx];
      p.inventory.decryptedLore.push(entry);
      if (idx === 0) {
        p.inventory.hasSafeCode = true;
      }
      this._setStatus(`Decryption complete: ${entry.title}`);
      if (this.cb.onDriveDecrypted) this.cb.onDriveDecrypted(entry);
      this.refresh();
    }

    _requestHandlerHint() {
      const hint = this.getHandlerHint
        ? this.getHandlerHint()
        : 'GGK COMMAND: Proceed east through the logging outpost, recover Drive 01, and breach the blast gate.';
      this._setStatus(hint);
      if (this.loreOutput) {
        this.loreOutput.textContent = `RADIO CHECK-IN\n${hint}`;
      }
      if (this.cb.onRadioHint) this.cb.onRadioHint(hint);
    }

    refresh() {
      const p = this.player;
      if (!p) return;
      const inv = p.inventory;

      if (this.btnRest) {
        const rested = this.bashaSite && this.bashaSite.restedThisVisit;
        this.btnRest.textContent = rested
          ? 'REST & SAVE CHECKPOINT (Full Stamina, Save Progress)'
          : 'REST & SAVE CHECKPOINT (+2 HP once, Full Stamina, Clear Leeches/Tourniquet)';
      }
      if (this.btnLeeches) {
        const hasLeeches = (p.leeches || 0) > 0;
        this.btnLeeches.classList.toggle('hidden', !hasLeeches);
        if (hasLeeches && !this._removingLeeches) {
          this.btnLeeches.disabled = false;
          this.btnLeeches.textContent = `REMOVE LEECHES (${p.leeches}) — 3s`;
        }
      }

      if (this.waterCounts) {
        this.waterCounts.textContent = `Dirty Water: ${inv.dirtyWater || 0} | Purif. Tabs: ${inv.purificationTabs || 0} | Purified: ${inv.pureWater || 0}`;
      }
      if (this.cookCounts) {
        this.cookCounts.textContent = `Boar Meat: ${inv.boarMeat || 0} | Field Rations (MRE): ${inv.jungleStew || 0}`;
      }
      if (this.benchCounts) {
        this.benchCounts.textContent = `Wire: ${inv.scrapWire || 0} | Cans: ${inv.emptyCan || 0} | Flares: ${inv.flare || 0} | Diesel: ${inv.diesel || 0} | Radio Parts: ${inv.radioParts || 0}`;
      }
      if (this.decryptCounts) {
        this.decryptCounts.textContent = `Encrypted Drives: ${inv.encryptedDrives || 0} | Decrypted: ${(inv.decryptedLore || []).length}`;
      }

      if (this.btnCraftWater) this.btnCraftWater.disabled = (inv.dirtyWater || 0) < 1 || (inv.purificationTabs || 0) < 1;
      if (this.btnCraftStew) this.btnCraftStew.disabled = (inv.boarMeat || 0) < 1;
      if (this.btnDecrypt) this.btnDecrypt.disabled = (inv.encryptedDrives || 0) < 1;

      // Render discovered atomic field-improvisation recipes (Task 6d)
      if (this.recipesList) {
        const Recipes = global.BelumGame && global.BelumGame.FieldRecipes;
        const discovered = Recipes ? Recipes.getDiscoveredRecipes(p) : [];
        if (discovered.length === 0) {
          this.recipesList.innerHTML = '<div style="font-size:11px;opacity:0.8;">Salvage empty cans, flares, diesel/rags, or radio parts to unlock field improvisations.</div>';
        } else {
          this.recipesList.innerHTML = '';
          for (let i = 0; i < discovered.length; i++) {
            const r = discovered[i];
            const canCraft = Recipes.hasAllInputs(r, p).ok;
            const btn = document.createElement('button');
            btn.className = `ink-btn ${canCraft ? 'primary' : 'secondary'}`;
            btn.disabled = !canCraft;
            btn.setAttribute('data-recipe', r.id);
            btn.title = r.use;
            btn.textContent = `${r.name} (${Recipes.formatRecipeInputs(r, p)})`;
            btn.addEventListener('click', () => this._craftImprovised(r.id));
            this.recipesList.appendChild(btn);
          }
        }
      }

      if (this.loreOutput) {
        if (inv.decryptedLore.length > 0) {
          const latest = inv.decryptedLore[inv.decryptedLore.length - 1];
          this.loreOutput.textContent = `${latest.title}\n${latest.body}`;
        } else {
          this.loreOutput.textContent = 'No decrypted telemetry loaded. Find Encrypted Drive 01 in Sector 2.';
        }
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BivouacCamp;
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.BivouacCamp = BivouacCamp;
})(typeof window !== 'undefined' ? window : globalThis);
