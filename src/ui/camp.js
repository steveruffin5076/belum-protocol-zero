// src/ui/camp.js - "Go Home" Bivouac Camp Overlay (Filtration, Cookstove, Workbench, Decryption Terminal)
(function (global) {
  'use strict';

  const VBS_LORE_ENTRIES = [
    {
      title: 'VBS TELEMETRY DRIVE 01 // BT-09 "RUST SPORE"',
      body: 'LOG 19-NOV-2026: Chemical runoff from Pulau Banding processing tanks entered the Sungai Belum limestone ravine. Wild Babi Hutan subjects show 300% aggression spikes and dermal ossification. Acoustic disturbances trigger indiscriminate charge behavior — Ironclad patrols advised to avoid decoy echoes. CULVERT MAINTENANCE CODE: 09-BELUM-ZERO.'
    },
    {
      title: 'VBS TELEMETRY DRIVE 02 // FACILITY SUB-ZERO',
      body: 'COMMANDER WARD EYES ONLY: Blast Gate hydraulic override requires Tier-1 Clearance swipe followed by a 15-second pressure cycle. Auxiliary drainage culvert on the south perimeter bypasses the main bunker sightlines. Hold the shaft until extraction.'
    }
  ];

  class BivouacCamp {
    constructor(callbacks) {
      this.cb = callbacks || {};
      this.isOpen = false;
      this._cacheDom();
      this._bindEvents();
    }

    _cacheDom() {
      if (typeof document === 'undefined') return;
      this.modal = document.getElementById('camp-modal');
      this.statusMsg = document.getElementById('camp-status-msg');
      this.btnClose = document.getElementById('btn-camp-close');

      this.waterCounts = document.getElementById('camp-water-counts');
      this.cookCounts = document.getElementById('camp-cook-counts');
      this.benchCounts = document.getElementById('camp-bench-counts');
      this.decryptCounts = document.getElementById('camp-decrypt-counts');
      this.loreOutput = document.getElementById('camp-lore-output');

      this.btnCraftWater = document.getElementById('btn-craft-water');
      this.btnCraftStew = document.getElementById('btn-craft-stew');
      this.btnCraftBolts = document.getElementById('btn-craft-bolts');
      this.btnCraftAmmo = document.getElementById('btn-craft-ammo');
      this.btnDecrypt = document.getElementById('btn-decrypt-drive');
    }

    _bindEvents() {
      if (this.btnClose) {
        this.btnClose.addEventListener('click', () => this.close());
      }
      if (this.btnCraftWater) {
        this.btnCraftWater.addEventListener('click', () => this._craftWater());
      }
      if (this.btnCraftStew) {
        this.btnCraftStew.addEventListener('click', () => this._craftStew());
      }
      if (this.btnCraftBolts) {
        this.btnCraftBolts.addEventListener('click', () => this._craftBolts());
      }
      if (this.btnCraftAmmo) {
        this.btnCraftAmmo.addEventListener('click', () => this._craftAmmo());
      }
      if (this.btnDecrypt) {
        this.btnDecrypt.addEventListener('click', () => this._decryptDrive());
      }
    }

    open(player) {
      this.player = player;
      this.isOpen = true;
      if (this.modal) this.modal.classList.remove('hidden');
      this._setStatus('Sheltered beneath the Belum canopy. Select a field station.');
      this.refresh();
    }

    close() {
      this.isOpen = false;
      if (this.modal) this.modal.classList.add('hidden');
      if (this.cb.onClose) this.cb.onClose();
    }

    _setStatus(msg) {
      if (this.statusMsg) this.statusMsg.textContent = msg;
    }

    _craftWater() {
      const p = this.player;
      if (!p) return;
      if (p.inventory.dirtyWater < 1) {
        this._setStatus('Need 1 Dirty Rainwater collected along the riverbank or ravine.');
        return;
      }
      p.inventory.dirtyWater -= 1;
      p.inventory.pureWater += 1;
      this._setStatus('Filtered 1 Pure Drinking Water! Press [Q] in the field for +50% stamina regen.');
      if (this.cb.onCraftSuccess) this.cb.onCraftSuccess('water');
      this.refresh();
    }

    _craftStew() {
      const p = this.player;
      if (!p) return;
      if (p.inventory.bambooShoots < 1 || p.inventory.boarMeat < 1) {
        this._setStatus('Requires 1 Wild Bamboo Shoot + 1 Harvested Boar Meat.');
        return;
      }
      p.inventory.bambooShoots -= 1;
      p.inventory.boarMeat -= 1;
      p.inventory.jungleStew += 1;
      this._setStatus('Cooked 1 Jungle Stew Ration (+6 HP). Use with [Q] or Bag button.');
      if (this.cb.onCraftSuccess) this.cb.onCraftSuccess('stew');
      this.refresh();
    }

    _craftBolts() {
      const p = this.player;
      if (!p) return;
      if (p.inventory.bambooShoots < 1 || p.inventory.scrapWire < 1) {
        this._setStatus('Requires 1 Wild Bamboo Shoot + 1 Scrap Wire.');
        return;
      }
      p.inventory.bambooShoots -= 1;
      p.inventory.scrapWire -= 1;
      p.ammo.crossbow += 3;
      this._setStatus('Fletched +3 Silent Crossbow Bolts at the workbench.');
      if (this.cb.onCraftSuccess) this.cb.onCraftSuccess('bolts');
      this.refresh();
    }

    _craftAmmo() {
      const p = this.player;
      if (!p) return;
      if (p.inventory.scrapWire < 1) {
        this._setStatus('Requires 1 Scrap Wire to press Improvised 9mm Subsonic Rounds.');
        return;
      }
      p.inventory.scrapWire -= 1;
      p.ammo.pistol += 4;
      this._setStatus('Pressed +4 Improvised 9mm Subsonic Rounds.');
      if (this.cb.onCraftSuccess) this.cb.onCraftSuccess('ammo');
      this.refresh();
    }

    _decryptDrive() {
      const p = this.player;
      if (!p) return;
      if (p.inventory.encryptedDrives < 1) {
        this._setStatus('No encrypted VBS drives in pack. Recover drives from the Outpost Field Lab.');
        return;
      }
      p.inventory.encryptedDrives -= 1;
      const idx = Math.min(VBS_LORE_ENTRIES.length - 1, p.inventory.decryptedLore.length);
      const entry = VBS_LORE_ENTRIES[idx];
      p.inventory.decryptedLore.push(entry);
      this._setStatus(`Decryption complete: ${entry.title}`);
      if (this.cb.onDriveDecrypted) this.cb.onDriveDecrypted(entry);
      this.refresh();
    }

    refresh() {
      const p = this.player;
      if (!p) return;
      const inv = p.inventory;

      if (this.waterCounts) {
        this.waterCounts.textContent = `Dirty Rainwater: ${inv.dirtyWater} | Pure Water: ${inv.pureWater}`;
      }
      if (this.cookCounts) {
        this.cookCounts.textContent = `Bamboo Shoots: ${inv.bambooShoots} | Boar Meat: ${inv.boarMeat} | Stew: ${inv.jungleStew}`;
      }
      if (this.benchCounts) {
        this.benchCounts.textContent = `Bamboo: ${inv.bambooShoots} | Scrap Wire: ${inv.scrapWire} | Bolts: ${p.ammo.crossbow} | 9mm: ${p.ammo.pistol}`;
      }
      if (this.decryptCounts) {
        this.decryptCounts.textContent = `Encrypted Drives: ${inv.encryptedDrives} | Decrypted: ${inv.decryptedLore.length}`;
      }

      if (this.btnCraftWater) this.btnCraftWater.disabled = inv.dirtyWater < 1;
      if (this.btnCraftStew) this.btnCraftStew.disabled = inv.bambooShoots < 1 || inv.boarMeat < 1;
      if (this.btnCraftBolts) this.btnCraftBolts.disabled = inv.bambooShoots < 1 || inv.scrapWire < 1;
      if (this.btnCraftAmmo) this.btnCraftAmmo.disabled = inv.scrapWire < 1;
      if (this.btnDecrypt) this.btnDecrypt.disabled = inv.encryptedDrives < 1;

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
