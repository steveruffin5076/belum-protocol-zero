# Belum: Protocol Zero — Follow-up Fix Tasks

> **Status: COMPLETED** (`10820d6`) — All Fixes 1–5 implemented, verified in headless Chromium (`npm run qc` 69/69, `npm run test:ai` 3/3, `tools/check_new_game_checkpoint.js` exit 0, `tools/check_queued_input.js` exit 0, 3x `tools/capture_player_strip.js`, Fix 4 5 s pause check, and Fix 5 damaged-checkpoint checks), and merged on `main`:
> - [x] **Fix 1:** Clear stale checkpoint and write fresh Sector 1 checkpoint in `startGameplay()` (`src/main.js`, `tools/check_new_game_checkpoint.js`)
> - [x] **Fix 2:** Use `AIM_HOLD_FRAME = 5` in `Mercenary.draw()` to hide painted horizontal laser until B1 fire art lands (`src/entities/mercenary.js`, `tools/capture_enemy_strip.js`)
> - [x] **Fix 3:** Freeze enemies, prevent damage, snap player to open Sector 1 spot per row, and assert `PLAYING` & unchanged HP in `tools/capture_player_strip.js`
> - [x] **Fix 4:** Add `PAUSED` mode, `onUtilityOpen`/`onUtilityClose` HUD callbacks, `PAUSED` header badge, and `Escape` open/close (`src/main.js`, `src/ui/hud.js`, `src/input/input_manager.js`, `index.html`, `style.css`)
> - [x] **Fix 5:** Validate `spawn`, `inventory` (schema types & unknown-key stripping), `unlockedWeapons`, and `activeWeapon` in `validateCheckpoint()` (`src/main.js`)

Task file for the implementing agent. These fixes come from a review of commit `b8084f4` (the `AUDIT_FIX_TASKS.md` fixes and Part A of the player and enemy art tasks). Do them in order, before `ACT1_EXPANSION_MODERN_TASKS.md`.

## Rules

- Run the game with `npm start` (<http://localhost:3000>). Run `npm run qc` and `npm run test:ai` after each fix. Both must still pass.
- Change only what each fix describes. Do not change gameplay numbers.
- Test in a real browser by playing the game, not only by reading the code. Each fix has a check. Fix 1 has a script that shows the bug today.
- Line numbers refer to commit `5de8d75` on `main`. Search by the quoted code if lines have moved.

---

## Fix 1 — Starting a new game keeps the old checkpoint (High, new in `b8084f4`)

**Problem:** `startGameplay()` (`src/main.js`, around line 500) now saves a Sector 1 checkpoint only when none exists:

```js
if (!this._hasSavedCheckpointKey()) {
  this._saveSectorCheckpoint(1, true);
}
```

So a checkpoint from an earlier session is never replaced.

**Reproduced:** with a saved Sector 3 checkpoint, reload the page, click BEGIN OPERATION, and die in Sector 1. **Retry** sends the player to **Sector 3** with the keycard and 20 pistol rounds, and the Sector 1 guard stays dead. Appendix A shows this.

**Required change:**
1. Starting from the briefing (BEGIN OPERATION) is a **new game**. Clear the old checkpoint, then save a fresh Sector 1 checkpoint: call `this._clearCheckpoint()` and then `this._saveSectorCheckpoint(1, true)`.
2. Leave `retryFromCheckpoint()` as it is. That is the only path that loads a saved checkpoint until the main menu's **Continue** exists (`ACT1_EXPANSION_MODERN_TASKS.md` Task 1).
3. Keep the **Restart** button behaviour (clear the checkpoint, then start new).

**Check:** run Appendix A. It must print `"sector":1` after Retry, with `"keycard":false` and `"s1GuardDead":false`.

---

## Fix 2 — The aim-hold pose shows a sideways laser painted in the art (Low)

**Problem:** the aim-hold pose draws `merc_fire` frame index 1 (`mercenary.js`, `aimAnim.currentFrame = 1`). That frame has a **horizontal red laser painted into the art**, so a guard aiming up, down or diagonally shows a laser pointing the wrong way. The code already draws the real laser at the true angle.

**Required change (temporary, until the new fire art from `ENEMY_ART_ANIMATION_TASKS.md` B1):**
1. Add a constant `AIM_HOLD_FRAME`, set to **5** (frame 6: rifle raised, no laser and no flash in the current art). Use it instead of the hard-coded `1`.
2. Leave a comment saying to set it back to `1` when the new B1 fire sheet (with no painted laser) lands.

**Check:** capture a guard in aim-hold facing right, up and down (Appendix B of `ENEMY_ART_ANIMATION_TASKS.md`, row `fire_aim_hold`). No painted laser appears in any direction. Only the code-drawn laser shows, at the true angle.

---

## Fix 3 — The player capture tool lets guards kill the player (Low, test tool)

**Problem:** `tools/capture_player_strip.js` plays the live game, so guards see and shoot the player during the crouch and slash rows. In a recent run the player took damage, then reached the game-over screen before the slash row finished. The strip cannot be trusted as a check.

**Required change:**
1. Right after BEGIN OPERATION, stop all enemies for the capture. In `page.evaluate`, set `update` to an empty function on every mercenary and boar, clear `projectiles`, and set `player.takeDamage = () => 0`. Do this only in the tool, never in the game.
2. Before each row, snap the player back to the same open spot with no pickups, for example near the Sector 1 spawn, so labels and plants do not cover the sprite.
3. Fail the run (exit code 1) if `mode` is not `PLAYING` at the end, or if the player's HP changed.

**Check:** run it 3 times. Every run shows all rows complete. The slash row shows the full 8-frame slash, with no damage numbers and no game-over screen.

---

## Fix 4 — Menus do not pause the game (Medium, already true before `b8084f4`)

**Problem:** the Settings, Backpack, Dossier and Weapons windows (`hud.openUtility(...)`, `src/ui/hud.js:134`) open while `mode` stays `PLAYING`, so guards keep moving and shooting behind the window.

**Required change:**
1. Add a `PAUSED` mode. When a utility window opens while `mode === 'PLAYING'`, set `mode = 'PAUSED'`. When it closes, set `mode = 'PLAYING'` and call `this.input.clearActions()`.
2. Add a callback from the HUD to the game (for example `onUtilityOpen` and `onUtilityClose`). Do not let the HUD change `mode` directly.
3. While `PAUSED`, rendering continues and nothing in the level updates, the same as `CAMP`. Show a small "PAUSED" label on the window.
4. **Esc** closes an open utility window. When none is open and the game is `PLAYING`, Esc opens Settings.
5. Opening a window from the camp, the briefing or the end screen does not change `mode`.

**Check:**
1. Stand in a guard's view cone and open Settings for 5 s. HP, the guard's position and `elapsedSec` do not change.
2. Close the window. The game resumes, and no key pressed while it was open fires afterwards.
3. Esc opens and closes Settings during play.

---

## Fix 5 — Checkpoint validation misses `spawn` and `inventory` (Low)

**Problem:** `validateCheckpoint()` (`src/main.js`, near the top) checks `version`, `sector`, `ammo` and the id arrays, but not `spawn` or `inventory`. A bad value there loads without warning. For example, `spawn: { x: "a" }` sets `player.x` to `"a"`.

**Required change:**
1. `spawn` must be missing, or an object with finite numeric `x` and `y` inside the world (0–4200 for `x`, 0–1320 for `y`). If it is missing, use `SECTOR_SPAWNS[sector]` as now.
2. `inventory` must be missing, or an object. Keep only the keys that exist in a new player's `inventory`, and check each value has the same type as that default: number (finite, 0 or more), boolean, or array. Drop unknown keys. Any wrong type makes the save `damaged`.
3. `unlockedWeapons` values must be booleans, and `activeWeapon` must be one of `parang`, `crossbow`, `pistol` or `decoy`.

**Check:** in DevTools, set each of these as `belum_checkpoint`, then die and choose Retry. Each shows the "damaged" toast, removes the key, and starts at Sector 1 with no console errors:
- `{"version":1,"sector":2,"spawn":{"x":"a","y":5},"collectedPickups":[],"deadMercs":[],"deadBoars":[]}`
- `{"version":1,"sector":2,"inventory":{"encryptedDrives":"lots"},"collectedPickups":[],"deadMercs":[],"deadBoars":[]}`
- `{"version":1,"sector":2,"activeWeapon":"rocket","collectedPickups":[],"deadMercs":[],"deadBoars":[]}`

---

## Appendix A — Browser check for Fix 1

Save as `tools/check_new_game_checkpoint.js`. With `npm start` running, run `node tools/check_new_game_checkpoint.js`.

```js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3000/');
  await p.waitForTimeout(800);
  // An earlier session left a Sector 3 checkpoint with the Sector 1 guard dead
  await p.evaluate(() => localStorage.setItem('belum_checkpoint', JSON.stringify({
    version: 1, sector: 3, spawn: { x: 2215, y: 640 },
    ammo: { crossbow: 9, pistol: 20, decoy: 9 },
    unlockedWeapons: { parang: true, crossbow: true, pistol: true, decoy: true },
    inventory: { hasKeycard: true },
    collectedPickups: ['pickup_keycard', 'pickup_pistol'], deadMercs: ['merc_s1_1'], deadBoars: [], flags: {}
  })));
  await p.reload();
  await p.waitForTimeout(1000);
  await p.click('#btn-prologue-skip');
  await p.waitForTimeout(200);
  await p.click('text=BEGIN OPERATION');
  await p.waitForTimeout(800);
  await p.evaluate(() => window.belumGameInstance.player.takeDamage(99));
  await p.waitForTimeout(1500);
  if (await p.isVisible('#btn-retry-sector')) {
    await p.click('#btn-retry-sector');
    await p.waitForTimeout(800);
  }
  const after = await p.evaluate(() => {
    const g = window.belumGameInstance;
    return {
      sector: g.currentSectorId,
      keycard: !!g.player.inventory.hasKeycard,
      pistolAmmo: g.player.ammo.pistol,
      s1GuardDead: g.mercenaries.find(m => m.id === 'merc_s1_1').dead
    };
  });
  console.log(JSON.stringify({ after, errs }));
  await b.close();
  process.exit(after.sector === 1 && !after.keycard && !after.s1GuardDead && errs.length === 0 ? 0 : 1);
})();
```

Before the fix, this printed `{"sector":3,"keycard":true,"pistolAmmo":20,"s1GuardDead":true}`.

---

## Final report from the implementing agent

For each fix, report:
- The files changed.
- The check results, including `npm run qc`, `npm run test:ai` and `tools/check_new_game_checkpoint.js`.
- Screenshots for the browser checks.
- Any check that did not pass, with the reason.
