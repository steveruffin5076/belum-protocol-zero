# Belum: Protocol Zero — Audit Fix Tasks

> **Status: COMPLETED** (`b8084f4`) — All fixes implemented, verified in headless Chromium (`npm run qc` 69/69, `npm run test:ai` 3/3, `tools/check_queued_input.js`, and full Fix 4–6.5 browser suite), and merged on `main`:
> - [x] **Fix 1:** Queued input gated & cleared outside gameplay (`src/input/input_manager.js`, `src/main.js`, `tools/check_queued_input.js`)
> - [x] **Fix 2:** Guard wall-sliding, sidestepping & stuck-waypoint recovery (`src/entities/mercenary.js`, `tools/ai_regression_checks.js`)
> - [x] **Fix 3:** `±0.26` `facingRight` dead-band (`src/entities/mercenary.js`, `tools/ai_regression_checks.js`)
> - [x] **Fix 4:** Versioned checkpoints (`version: 1`), world-state persistence, migration & error toasts (`src/main.js`, `src/world/level_act1.js`)
> - [x] **Fix 5:** Boar `'FAUNA'` alerts separated from player `alertsTriggered` (`src/entities/mercenary.js`, `src/entities/boar.js`, `src/main.js`)
> - [x] **Fix 6 & Approved Fix 6.5:** Screen shake (`0–100%`) & Reduce flashing accessibility settings (`belum_settings`) + quiet stealth takedowns (`0.2` trauma, no hit-stop) (`src/engine/camera.js`, `src/ui/hud.js`, `src/main.js`, `src/entities/*.js`)

Task file for the implementing agent. These fixes come from an audit with the project skills `game-ai`, `game-feel`, `input-systems`, `level-design` and `save-systems`, found in `.claude/skills/`. Do the fixes in the order below. Each fix must pass its checks before the next one starts.

## Rules

- Run the game with `npm start`, which opens <http://localhost:3000>. Run the QC suite with `npm run qc`.
- Change only what each fix describes. Do not change gameplay numbers (vision range, FOV, speeds, damage, timers) unless the fix says so.
- `npm run qc` must pass after each fix, with no new browser console errors.
- Test in a real browser by playing the game, not only by reading the code. Every fix below has a check you can run, and Fixes 1–3 have a script that showed the bug before the fix.
- Line numbers refer to the code at commit `bba08cf` on `main`. Search by the quoted code if lines have moved.

---

## Fix 1 — Keys pressed outside gameplay fire later (input)

**Problem:** the keydown handler (`src/input/input_manager.js:87-125`), the canvas pointer handler (around line 149) and the touch action buttons (`bindMultiTouchTap`, around line 230) queue actions in every game mode. Queued actions are only consumed during gameplay (`main.js:400`, `consumeActions()`), so they wait until the next gameplay frame.

**Reproduced:** on the briefing screen, press **B** and **Space**, then click BEGIN OPERATION. The game opens the Bivouac Camp at once (`mode` becomes `CAMP`), and a parang slash is also queued.

**Required change:**
1. Add a `clearActions()` method to `InputManager` that resets every field in `this.actions`, the same fields `consumeActions()` resets.
2. Pass a callback `isGameplayActive: () => this.mode === 'PLAYING'` in the callbacks object given to `new InputManager(...)` (`main.js:29`).
3. In the keydown handler, the canvas pointerdown handler and every `bindMultiTouchTap` handler, set an action flag only when `this.cb.isGameplayActive` is missing or returns `true`. Leave **M** (mute) and **J** (dossier) working in every mode, as they are now.
4. Call `this.input.clearActions()` in every place where `mode` becomes `'PLAYING'`: `startGameplay()` (`main.js:264`), `retryFromCheckpoint()` (`main.js:214`) and the camp-close path (`main.js:41`).
5. Do not change `crouchToggle` or `touchSprintToggle`. They are toggles, not queued actions.

**Checks:**
1. Run the Playwright script in Appendix A. It must print `"after":{"mode":"PLAYING"}` and `meleeSlashQueued: false`.
2. In the browser, press B during the briefing, then start the game. The camp must not open.
3. In the camp, press Space and E, then close the camp. The player must not slash or interact.
4. During gameplay, B, Space, E, Q and 1–4 still work exactly as before.

---

## Fix 2 — Guards get stuck on walls forever (AI)

**Problem:** `Mercenary._moveToward` (`src/entities/mercenary.js:361`) moves in a straight line and only slides along walls. There is no pathfinding and no stuck check. In `PATROL`, a guard blocked from its waypoint stays blocked forever, because PATROL has no timer.

**Reproduced:** a guard placed above the barracks, with its next waypoint straight below it, was still pressed against the roof after 10 s (Appendix B, test `stuck`).

**Required change (stuck guard, as recommended by the `game-ai` skill):**
1. Add `this.stuckTimer = 0` and `this.lastProgressDist = Infinity` to the constructor.
2. Each frame that `_moveToward` is called, measure the distance to its target. If the distance dropped by less than `0.5 * speed * dt` that frame, add `dt` to `stuckTimer`. Otherwise reset `stuckTimer` to 0.
3. After 0.6 s stuck, try a sidestep: move for 0.4 s along the direction perpendicular to the target (try one side, then the other), then go back to moving toward the target.
4. After 2.0 s stuck in total:
   - `PATROL`: skip to the next waypoint (`waypointIdx + 1`) and reset `stuckTimer`. If every waypoint has been skipped in a row, stand still and wait 3 s before trying again, instead of looping forever.
   - `SUSPICIOUS` or `ALERT` with no visible target: give up on `suspicionTarget`, set it to the guard's own position, and start the existing sweep at the current position.
5. Do not add a full A* grid in this fix. The level is small and the patrols are hand-placed, so a stuck guard that recovers is enough for now.

**Checks:**
1. Appendix B test `stuck` passes: the guard is more than 100 px from where it got stuck within 10 s.
2. In the browser, get a Sector 2 guard to chase you around the Logging Barracks, then hide in a fern until the guard returns to patrol. Record the guard for 20 s. It must not stay pressed against the building for more than 3 s.
3. Normal patrols that were never blocked look the same as before.

---

## Fix 3 — Guard sprite flips every frame when facing up or down (AI and visual)

**Problem:** `this.facingRight = Math.cos(this.facingAngle) >= 0` (`mercenary.js:63` and `:121`) has no dead band. When a guard faces almost straight up or down, small changes in angle flip the sprite every frame.

**Reproduced:** with the target wobbling 1° around straight up, the sprite flipped 60 times in 1 s at 60 fps (Appendix B, test `flip`).

**Required change:**
1. In `_rotateToward`, compute `const c = Math.cos(this.facingAngle)`. Set `this.facingRight = true` only when `c > 0.26`, and `false` only when `c < -0.26`. Between those values, keep the current value. 0.26 is about 75° from horizontal.
2. Apply the same rule in the constructor, with a plain `>= 0` as the starting value.
3. If `VIEW_READABILITY_TASKS.md` Phase B (up and down sprites) is already done, the up and down sheet selection must also use its own hysteresis, as that file describes. The two must not fight each other.

**Checks:**
1. Appendix B test `flip` passes: 0 flips in 1 s for the wobble case, and exactly 2 flips for one full 360° turn.
2. In the browser, stand straight above a guard while it searches. Its sprite must not flicker.

---

## Fix 4 — Checkpoint save: add a version, save world state and validate on load (save)

**Problem:** the checkpoint (`main.js:159-221`) saves only the player's sector, weapons, ammo and inventory:
- It has no `version` field.
- It does not save the world. On retry, `resetAct1()` rebuilds the level, so every pickup and enemy comes back. The player can pick up the crossbow and pistol ammo again on top of the restored ammo, so ammo grows with each retry.
- `_loadCheckpoint()` uses whatever `JSON.parse` returns, without checking it.
- A failed save is ignored with no message to the player.

**Required change:**
1. Add `const CHECKPOINT_VERSION = 1;` next to `CHECKPOINT_KEY` (`main.js:7`), and write `version: CHECKPOINT_VERSION` into every save.
2. Save the world state as plain data, using ids that already exist in `level_act1.js`:
   - `collectedPickups`: the ids of all `level.pickups` with `collected === true`.
   - `deadMercs`: the ids of dead mercenaries. They already have stable ids such as `merc_s1_1`.
   - `deadBoars`: give each boar a stable `id` in `level_act1.js` first, for example `boar_s3_1`, and save the dead ones.
   - `flags`: `generatorSabotaged`, `culvertUnlocked` and `drivesDecrypted` (from `this.stats`), plus any other `level.*` boolean that changes quest state. Search for `this.level.` assignments in `main.js`.
3. In `retryFromCheckpoint()`, after `resetAct1()`, apply the saved world state: mark saved pickups as collected, mark saved enemies as dead without spawning ink puddles or toasts, and restore the flags. Restore ammo by **replacing** it with the saved values, as it does now. Because collected pickups stay collected, ammo can no longer grow.
4. Add a function `validateCheckpoint(data)` that returns the data or `null`. It must check that `data` is an object, that `version` is an integer, that `sector` is an integer from 1 to 4, that `ammo` values are finite numbers of 0 or more, and that arrays are arrays of strings.
   - If `version > CHECKPOINT_VERSION`: return `null`, and show the toast "Checkpoint is from a newer version and was not loaded."
   - If `version` is missing: treat it as an old save. Migrate it to version 1 by adding empty `collectedPickups`, `deadMercs`, `deadBoars` and `flags`.
   - Any other failure: return `null`, remove the bad key, and show the toast "Checkpoint was damaged and has been reset."
5. If `localStorage.setItem` throws, show the toast "CHECKPOINT NOT SAVED (storage blocked)" instead of failing silently.
6. Keep the save under the single key `belum_checkpoint`. `localStorage.setItem` already replaces the whole value in one step, so no temporary file or backup is needed.

**Checks:**
1. Collect the crossbow (+5 bolts), reach the Sector 2 checkpoint, die, and choose Retry. The bolt count must equal the count at the checkpoint, and the crossbow pickup must not reappear.
2. Kill the Sector 1 guard, reach the Sector 2 checkpoint, die, and choose Retry. The Sector 1 guard stays dead.
3. In DevTools, set `localStorage.belum_checkpoint` to `{"version":99,"sector":2}` and choose Retry. The "newer version" toast shows, and the game starts from Sector 1 without errors.
4. Set the key to `{bad json` and choose Retry. The "damaged" toast shows, the key is removed, and there are no console errors.
5. Set the key to an old save with no `version` (copy the current format) and choose Retry. It loads as before.

---

## Fix 5 — Spotting a boar counts as a stealth alert (AI and stats)

**Problem:** when a guard sees an aggressive boar, `triggerAlert` runs (`mercenary.js:270`), which calls `onRadioAlert` (`main.js:443`). That handler adds 1 to `stats.alertsTriggered`, shows "CONTACT!" and alerts nearby guards. The end-of-act stealth stats then count alerts the player did not cause.

**Required change:**
1. Give `triggerAlert(tx, ty, ctxEvents, faction)` a fourth argument. Pass `activeTarget.faction` from the `activeTarget` branch, and `'PLAYER'` from the suspicion-meter path (`mercenary.js:247`) and from `takeDamage` when the attacker is the player.
2. Pass the faction to `onRadioAlert(merc, faction)`.
3. In `main.js`, add 1 to `stats.alertsTriggered` only when `faction === 'PLAYER'`. For `'FAUNA'`, show the float text "BOAR!" instead of "CONTACT!". Keep alerting nearby guards in both cases, because that behaviour is part of the faction-infighting design.

**Checks:**
1. Lure a boar into a Sector 3 guard without being seen. The end screen shows `alertsTriggered` = 0.
2. Get seen by a guard. `alertsTriggered` goes up by 1, as before.

---

## Fix 6 — Screen shake and flashing settings (game feel and accessibility)

**Problem:** the game has no setting to reduce screen shake or flashing. The `game-feel` skill lists these as required accessibility options.

**Required change:**
1. In the Settings utility modal (`btn-util-settings`, built in `src/ui/hud.js`), add two controls:
   - **Screen shake:** a slider from 0 to 100%, default 100%.
   - **Reduce flashing:** a toggle, default off.
2. In `Camera.addTrauma` (`src/engine/camera.js`), multiply the added trauma by `shakeStrength` (0–1).
3. When Reduce flashing is on, replace the red hurt-flash rings on the player, guards and boars (each `hurtFlashTimer` block in `draw()`) with a steady tint that is not pulsing, and skip any full-screen flash effects.
4. Save both settings in `localStorage` under the separate key `belum_settings`, with `{ "version": 1, "shake": 100, "reduceFlash": false }`. Load them at startup. Wrap every read and write in `try`/`catch` and fall back to the defaults.
5. Optional design change, which needs the owner's OK: lower the stealth takedown trauma from `0.58` to `0.2` and remove its hit-stop (`main.js:661-662`), so silent takedowns feel quiet. Do not make this change without approval.

**Checks:**
1. Set shake to 0% and get hit by a boar charge. The camera does not move. Set it to 100%, and the shake is the same as before.
2. Turn on Reduce flashing and take damage. No pulsing red ring appears.
3. Reload the page. Both settings keep their values.

---

## Appendix A — Playwright check for Fix 1

Save this as `tools/check_queued_input.js` and run it with `node tools/check_queued_input.js` while `npm start` is running.

```js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:3000/');
  await p.waitForTimeout(1200);
  await p.keyboard.press('Space');
  await p.keyboard.press('KeyB');
  await p.click('#btn-prologue-skip');
  await p.waitForTimeout(300);
  await p.click('text=BEGIN OPERATION');
  await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({
    mode: window.belumGameInstance.mode,
    meleeSlashQueued: window.belumGameInstance.input.actions.meleeSlash
  }));
  console.log(JSON.stringify({ after }));
  await b.close();
  process.exit(after.mode === 'PLAYING' && !after.meleeSlashQueued ? 0 : 1);
})();
```

Before the fix this printed `"mode":"CAMP"`.

## Appendix B — Node checks for Fixes 2 and 3

Save this as `tools/ai_regression_checks.js`, add `"test:ai": "node tools/ai_regression_checks.js"` to `package.json` scripts, and run `npm run test:ai`.

```js
const M = require('../src/entities/mercenary.js');
let failed = 0;

// flip: target wobbles 1 degree around straight up for 1 s at 60 fps
{
  const m = new M({ x: 500, y: 500, facingAngle: -Math.PI / 2 });
  let flips = 0, prev = m.facingRight;
  for (let f = 0; f < 60; f++) {
    m._rotateToward(-Math.PI / 2 + (f % 2 ? 0.017 : -0.017), 1 / 60);
    if (m.facingRight !== prev) { flips++; prev = m.facingRight; }
  }
  console.log(flips === 0 ? '[PASS]' : '[FAIL]', 'flip wobble: flips =', flips, '(want 0)');
  if (flips !== 0) failed++;
}

// flip: one full slow turn
{
  const m = new M({ x: 500, y: 500, facingAngle: 0 });
  let flips = 0, prev = m.facingRight;
  for (let f = 0; f <= 360; f++) {
    m._rotateToward(f * Math.PI / 180, 1);
    if (m.facingRight !== prev) { flips++; prev = m.facingRight; }
  }
  console.log(flips === 2 ? '[PASS]' : '[FAIL]', 'flip full turn: flips =', flips, '(want 2)');
  if (flips !== 2) failed++;
}

// stuck: guard above the barracks with its waypoint straight below
{
  const level = { obstacles: [{ solid: true, x: 1140, y: 210, width: 280, height: 150 }] };
  const m = new M({ x: 1256, y: 120, waypoints: [{ x: 1280, y: 450 }, { x: 1500, y: 450 }] });
  const sx = m.centerX, sy = m.centerY;
  for (let f = 0; f < 600; f++) m.update(1 / 60, null, [], level, {});
  const moved = Math.hypot(m.centerX - sx, m.centerY - sy);
  console.log(moved > 100 ? '[PASS]' : '[FAIL]', 'stuck: moved', moved.toFixed(0), 'px in 10 s (want > 100)');
  if (moved <= 100) failed++;
}

process.exit(failed ? 1 : 0);
```

Before the fixes, this script printed `flip wobble: flips = 60` and `stuck: moved 19 px in 10 s`: the guard stopped against the roof at (1280, 187). `flip full turn` already passes and must keep passing.

---

## Final report from the implementing agent

For each fix, report:
- The files changed.
- The check results, including the output of `npm run qc`, `npm run test:ai` and `tools/check_queued_input.js`.
- Screenshots or short recordings for the browser checks.
- Any check that did not pass, with the reason.
