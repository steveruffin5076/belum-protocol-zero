# Belum: Protocol Zero — Enemy Art and Animation Fix Tasks

Task file for the implementing agent. It fixes the problems found in an audit of the guard (mercenary) and boar sprites and animation, captured from the running game after the View Readability work (commit `f48a097`). Part A needs only code. Part B needs new art. Do Part A first.

## Rules

- Run the game with `npm start`, which opens <http://localhost:3000>. Run the QC suite with `npm run qc`.
- Do not change gameplay numbers (vision, speeds, damage, fire cooldowns, burst timing, telegraph and charge durations). These fixes change only how enemies look.
- `npm run qc` must pass after each task, with no new browser console errors.
- Test in a real browser by playing the game, not only by reading the code. For each task, capture a strip with Appendix B and **look at it**. Check the size, the foot line, the frame order, and anything that should not be there.
- **Shared with `PLAYER_ART_ANIMATION_TASKS.md`:** task A2 (draw frames at their real aspect ratio), A4 (the new slicer with one frame size and a fixed baseline) and A5 (the per-animation `scale` option) change the same files. Do each of them only once. If they are already done, just run their checks on the enemy sheets.
- Line numbers refer to commit `7a72b8e` on `main`. Search by the quoted code if lines have moved.

## Canonical looks (apply to every enemy sheet)

**Ironclad mercenary**, matching `assets/sprites/merc_patrol_8f.png`:
- A rounded combat helmet with dark goggles, in **every** frame of **every** sheet. No beret.
- A plate carrier with pouches, a backpack, knee pads, combat boots and a thigh holster.
- An assault rifle with a small red-dot optic. The optic is the only crimson accent.

**Mutated boar**, matching `assets/sprites/boar_idle_8f.png`:
- A heavy wild boar with coarse bristly hair, a bristle ridge along the spine, a long snout, large curved tusks and a thin tail.
- No red glow and no ground decoration painted into the art. The game draws telegraph effects itself.

## Audit summary (what is wrong today)

| # | Problem | Fixed in |
|---|---|---|
| 1 | A dead guard is drawn as a small ink "X". There is no body. | B3, A6 |
| 2 | A guard facing up or down switches to the side fire sprite for each burst, because `merc_fire_up` and `merc_fire_down` were not made. | B2 |
| 3 | The fire sheet shows a **beret without goggles**. Every patrol sheet shows a **helmet with goggles**. | B1 |
| 4 | The guard is about 15% taller when facing up or down, because the new frames are 316 × 356 (up) and 288 × 328 (down) and the side frames are 332 × 372. | A3 |
| 5 | In the up and down sheets, the bottom-row frames are offset from the top-row frames (baseline spread 15 px up, 7 px down), so the guard jitters every loop. | A3 |
| 6 | The new up and down sheets have a textured paper background and frame sizes that do not match the quality gate. | A3 |
| 7 | The fire animation never restarts, so the muzzle flash frames do not line up with the bullets. The art's horizontal laser in frames 1–2 also ignores the real aim. | A1, B1 |
| 8 | The spotter looks exactly like a rifleman. The commander is the same sprite drawn larger. | A7 |
| 9 | Guards have no idle pose. They freeze mid-step at waypoint stops and during search sweeps. | B4, A6 |
| 10 | All guard frames are about 12% too wide. | A2 |
| 11 | Telegraph and charge play one shared 8-frame loop, so the boar shows running legs while standing still in the telegraph, and pawing frames during the charge. | A4, B5 |
| 12 | A dead boar stays standing, drawn at 40% opacity. | B6, A6 |
| 13 | Boars are stretched about 32% too wide (332 × 372 frames drawn into a 104 × 88 box). | A2 |
| 14 | The red telegraph glow is painted into the charge art and also drawn by the code. | B5 |
| 15 | A stunned boar plays the slow graze walk instead of a dazed pose. | B7, A6 |

---

## Part A — Code fixes

### A1. Sync the fire animation with each burst

**Where:** `Mercenary.update()` in `src/entities/mercenary.js`. A burst starts where `this.burstRemaining = ...` is set, each shot sets `this.firingAnimTimer = 0.22`, and `animFire.update()` runs only while that timer is above zero.

**Change** (no change to burst timing):
1. When a burst starts, call `reset()` on the fire animator for the current direction (`animFire`, `animFireUp` or `animFireDown`), set its `currentFrame = 2` (the first muzzle-flash frame in the new art), and set `firingAnimTimer` long enough for the rest of the sheet to play (frames 3–8).
2. Set the fire animators' `fps` to `1 / 0.13 ≈ 7.7`, so that frames 3, 4 and 5 (index 2–4) each last one shot interval and line up with the three shots. For the commander's 2-round burst, frames 3 and 4 line up with its shots and frame 5 simply plays.
3. While the guard is `ALERT`, can see its target and is turning to aim (`aimErr >= 0.35`) or waiting for `fireCooldown`, draw the fire sheet held on **frame 2** (the aiming pose) instead of the patrol walk.
4. Do not draw the art's laser. After B1 the art has none. The code already draws the real laser at the true angle (`renderer.js`, `_drawVisionConesAndLasers`).

**Check:** capture a guard firing at 40 ms intervals. Each of the 3 bullets leaves while a muzzle-flash frame is showing. Between bursts, the guard holds the aim pose instead of walking in place.

### A2. Draw frames at their real aspect ratio (shared)

The same change as `PLAYER_ART_ANIMATION_TASKS.md` A2, in `Sprite8FrameAnimator.draw()`. Keep `drawH`, set the width from the frame's real aspect ratio, and keep the bottom edge in place.

**Check:** in Appendix B, guards and boars are no longer stretched sideways. A boar at 88 px high should be about 78 px wide for a 332 × 372 frame. If that now looks too small, raise the boar's `drawH` and keep the aspect ratio. Do not stretch.

### A3. Re-slice the guard up and down sheets

Use the shared slicer from `PLAYER_ART_ANIMATION_TASKS.md` A4 on `merc_patrol_up_8f.png` and `merc_patrol_down_8f.png`. It cuts inside the detected grid lines, puts every frame on a 332 × 372 canvas, and puts the boot soles on the y = 356 baseline. The textured background is light enough (mean luma 232) for the background removal, so the sheets do not need to be made again unless the check below fails.

Then use the shared `scale` option (`PLAYER_ART_ANIMATION_TASKS.md` A5) so that the up and down figures are the same height on screen as the side figure, within 5%.

**Check:**
1. `python3 tools/scan_frames.py merc_patrol merc_patrol_up merc_patrol_down` reports one frame size, a baseline spread of 3 px or less, and no grid lines.
2. In Appendix B, the guard's head height stays the same, within about 3 px, when it turns from side to up to down. The figure does not shift between frames 4 and 5 of a loop.

### A4. Split the boar telegraph frames from the charge frames

**Where:** `MutatedBoar.update()` and `draw()` in `src/entities/boar.js`. Today `animCharge` loops all 8 frames in both `TELEGRAPH` (at half speed) and `CHARGE`.

**Change:**
1. Add optional `firstFrame` and `lastFrame` options to `Sprite8FrameAnimator`, defaulting to 0 and `frameCount - 1`. `update()` loops only within that range, and `reset()` goes to `firstFrame`.
2. Create two animators from the same frames:
   - `animPaw`: frames 0–2 (pawing), looping, about 6 fps, used in `TELEGRAPH`.
   - `animRun`: frames 3–7 (galloping), looping, 14 fps, used in `CHARGE`.
3. Remove the `* 0.5` and `* 1.4` speed hacks.

**Check:** capture a telegraph and a charge. During the telegraph, the boar stays in a head-down pawing pose and its legs never show a run. During the charge, every frame is a gallop.

### A5. Remove the baked telegraph glow

This is done by new art in B5. After B5, confirm that the only red under a boar comes from the code-drawn telegraph and charge zones.

### A6. Add idle, death and stun animations

After the B sheets exist:
- **Guards:**
  - `animIdle` (`merc_idle`, 6 fps, looping) plays when the guard is not moving and not firing. When the guard faces up or down, hold frame 0 of `animPatrolUp` or `animPatrolDown` instead of a mid-step frame.
  - `animDeath` (`merc_death`, 10 fps, `loop: false`) plays once when the guard dies and then holds its last frame for the rest of the run. Remove the "X" drawing (`mercenary.js`, the `if (this.dead)` block in `draw()`). Draw the dead guard at full opacity, or at least 0.85.
  - Keep the ink puddle.
- **Boars:**
  - `animStun` (`boar_stun`, 8 fps, looping) plays in `STUNNED`, under the existing stars.
  - `animDeath` (`boar_death`, 10 fps, `loop: false`) plays once on death and then holds its last frame. Remove the 0.4 opacity standing pose.
- Every new animator falls back to the current animator if its frames have not loaded. An enemy must never be drawn as nothing.
- Dead bodies keep the same depth sorting (`sortY`), so the player can walk in front of them and behind them.

**Check:**
1. Kill a guard and a boar. Each plays a fall and then stays on the ground as a body.
2. Stun a boar against a wall. It plays the dazed loop under the stars.
3. Watch a guard wait at a waypoint. It breathes in the idle pose instead of freezing mid-step.

### A7. Make the spotter and commander easy to tell apart (no new art)

Draw a small role mark above the head with Canvas code in the ink palette:
- **Spotter:** a small ink binoculars icon.
- **Commander:** a small ink star or chevron rank mark, next to the existing "CMDR WARD" label.

Show the mark only while the guard is not `ALERT`, so it never covers the "!". Keep the commander's larger draw size.

**Check:** take a screenshot of a rifleman, the spotter and the commander. All three can be told apart at normal zoom.

---

## Part B — New art

Generate each sheet, check it against the quality gate in B8, and only then add it to the game. For every **guard** sheet, attach `assets/sprites/merc_patrol_8f.png` as the identity reference. For every **boar** sheet, attach `assets/sprites/boar_idle_8f.png`.

### Sheet format (all new sheets)

| Spec | Value |
|---|---|
| Size | 1376 × 768 px PNG |
| Grid | 4 columns × 2 rows, 8 cells of 344 × 384 px, separated by thin dark navy lines that run straight across the whole sheet. Do not inset the grid or draw an outer border. |
| Background | Flat cream `#F7F3E8` inside the cells, with **no paper texture**, no plants, no rocks and no ground objects |
| Guard height | Standing: helmet top at about y = 40 and boot soles at about y = 350 in each cell (about 310 px tall), centred horizontally |
| Boar size | Body length about 280 px and height about 200 px, with the hooves at about y = 350 |
| Baseline | The lowest point (boots or hooves) on the same line (y ≈ 350) in **every** frame and **every** sheet. Lying poses rest on the same line. |
| Shadow | Only a small hatched ink shadow under the feet or body |
| Facing | Right for side views. Up and down sheets as stated in the prompt. |
| Frame order | Left to right, top row first. Looping unless the prompt says the sheet plays once. |

### Shared style block (paste at the start of every prompt)

> Vintage dip-pen ink etching on flat cream parchment paper (#F7F3E8). Dense cross-hatching and stipple shading in dark Prussian-blue navy ink (#111E33). No colour fill, no gradients, no paper texture inside the cells, and no plants, rocks or scenery: only the subject and a small hatched ink shadow beneath it. Sprite sheet: 1376×768 px, a 4-column × 2-row grid of 8 equal cells (344×384 px each), with thin dark navy grid lines running straight edge to edge and no outer border. One subject per cell, centred, the same size in every cell, with its lowest point on the same baseline near the bottom of every cell. Match the attached reference sheet exactly in line weight, shading density, proportions and gear.

**Guard identity line** (add after the style block for guard sheets):

> Character: an Ironclad mercenary soldier, exactly as in the attached reference: a rounded combat helmet with dark goggles in every frame (never a beret or cap), a plate carrier with pouches, a backpack, knee pads, combat boots, a thigh holster, and an assault rifle with a small red-dot optic, which is the only crimson (#F85A5A) accent.

**Boar identity line** (add after the style block for boar sheets):

> Creature: a mutated wild boar, exactly as in the attached reference: heavy body, coarse bristly hair, a bristle ridge along the spine, a long snout, large curved tusks and a thin tail. No red glow or colour under the boar.

### B1. Guard fire, side view (replaces `merc_fire_8f.png`)

File: `assets/sprites/merc_fire_8f.png`. Also attach the current `merc_fire_8f.png` as the **pose** reference.

> [Style block] [Guard identity line] Subject: the mercenary facing right, firing a 3-round burst to the right, keeping the poses of the attached fire reference but with the helmet and goggles. Frame 1: raising the rifle. Frame 2: braced, aiming down the sight (no flash). This is the hold pose. Frames 3, 4 and 5: one shot each, with a small ink-hatched muzzle flash at the barrel (crimson tint on the flash only), a slight recoil kick, and a spent casing in frames 4–5. Frames 6–8: recovery, lowering the rifle slightly back to a ready stance. No laser line anywhere. The sheet plays once per burst.

### B2. Guard fire, up and down (new)

Files: `assets/sprites/merc_fire_up_8f.png` and `assets/sprites/merc_fire_down_8f.png`. Attach `merc_patrol_up_8f.png` or `merc_patrol_down_8f.png` as the matching **view** reference.

`merc_fire_up_8f.png`:
> [Style block] [Guard identity line] Subject: the mercenary seen from behind, at the same angle as the attached up-view reference, firing a 3-round burst AWAY from the viewer with the rifle at the shoulder. Frame 1: raising the rifle. Frame 2: braced, aiming (hold pose, no flash). Frames 3–5: one shot each, with a small ink-hatched muzzle flash just past the helmet (crimson tint on the flash only). Frames 6–8: recovery. The face is not visible. No laser line.

`merc_fire_down_8f.png`:
> [Style block] [Guard identity line] Subject: the mercenary facing the viewer, at the same angle as the attached down-view reference, firing a 3-round burst TOWARD the viewer with the rifle at the shoulder, pointing slightly down and forward. Frame 1: raising the rifle. Frame 2: braced, aiming (hold pose, no flash). Frames 3–5: one shot each, with a small ink-hatched muzzle flash at the barrel (crimson tint on the flash only). Frames 6–8: recovery. No laser line.

### B3. Guard death (new)

File: `assets/sprites/merc_death_8f.png`

> [Style block] [Guard identity line] Subject: the mercenary, facing right, hit and collapsing. Frame 1: struck, recoiling backward. Frames 2–4: knees buckling, the rifle slipping from the hands. Frames 5–6: falling backward to the left. Frames 7–8: lying still on his back on the ground, with the rifle beside him. Frame 8 is the final resting pose and must be clean and still. The body rests on the same baseline as standing frames. No blood: the game draws an ink puddle. The sheet plays once.

### B4. Guard idle (new)

File: `assets/sprites/merc_idle_8f.png`

> [Style block] [Guard identity line] Subject: the mercenary standing still on watch, facing right, holding the rifle low and ready. Very small motion across the 8 frames: slow breathing (the chest rises and falls by a few pixels) and a slight head turn as if scanning, then back. The feet stay planted. It loops smoothly.

### B5. Boar paw and charge (replaces `boar_charge_8f.png`)

File: `assets/sprites/boar_charge_8f.png`. Also attach the current `boar_charge_8f.png` as the **pose** reference.

> [Boar identity line, after the style block] Subject: the boar, facing right. Frames 1–3 are a looping telegraph: head lowered, tusks forward, one front hoof scraping the ground with a few small ink dirt flecks, and the body still. Frames 4–8 are a looping full-speed gallop to the right, with legs stretched and gathered, the body low and the ears back. Frame 8 leads smoothly back into frame 4. No red glow, no coloured ground and no speed lines under the boar.

### B6. Boar death (new)

File: `assets/sprites/boar_death_8f.png`

> [Boar identity line, after the style block] Subject: the boar, facing right, collapsing. Frames 1–2: staggering, with the head dropping. Frames 3–5: the legs giving way, rolling onto its side. Frames 6–8: lying still on its side, with the legs out and the tusks visible. Frame 8 is the final resting pose and must be clean and still. It rests on the same baseline as the standing frames. No blood. The sheet plays once.

### B7. Boar stun (new)

File: `assets/sprites/boar_stun_8f.png`

> [Boar identity line, after the style block] Subject: the boar, facing right, dazed after slamming into a wall. It stands in place, wobbling: the head lolls slowly side to side, the eyes are half closed, and the legs are slightly splayed and unsteady. Leave empty space above the head, because the game draws orbiting stars there. It loops smoothly over the 8 frames.

### B8. Art quality gate (check before any code)

Reject a sheet and generate it again if any of these fail:
- The size is not 1376 × 768, the grid is not 4 × 2, or the grid lines are inset or have an outer border.
- Any guard frame shows a beret or cap, or is missing the goggles, plate carrier or backpack.
- Any boar frame has a red glow, coloured ground or speed lines.
- The background inside a cell is textured or not cream, or there is scenery.
- The figure height differs from the matching reference by more than 5%.
- The baseline varies by more than 3 px between frames (`python3 tools/scan_frames.py <prefix>` after slicing).
- A guard fire sheet has a laser line, or has a muzzle flash outside frames 3–5.
- The final frame of a death sheet is not a clean, still resting pose.
- A looping sheet jumps between its last frame and the first frame of its loop.

### B9. Add the new sheets to the game

1. Slice each sheet with the shared slicer into `assets/sprites/frames/`, using the file name without `_8f` as the prefix, for example `merc_fire_up`.
2. In `mercenary.js`:
   - Replace `this.animFireUp = null` and `this.animFireDown = null` with real animators (`merc_fire_up`, `merc_fire_down`).
   - Add `animIdle` and `animDeath`.
   - Wire them as described in A1 and A6.
3. In `boar.js`:
   - Use the `animPaw` and `animRun` split (A4) on the new `boar_charge` frames.
   - Add `animStun` and `animDeath` (A6).
4. Add the new sheet and frame files to the required-file list in `tools/qc_validator.js`.

### B10. Checks after Part B

Capture strips with Appendix B and look at them:
1. **Same look:** the helmet and goggles appear in every guard frame of every sheet. The boars show no red glow in the art.
2. **Same size:** the guard's head height is the same across side, up, down, idle and fire, within about 3 px on screen.
3. **Feet on the line:** boots and hooves stay on the blue baseline in every frame, including lying poses.
4. **Firing up and down:** a guard facing up or down fires with its up or down fire sheet and does not turn sideways.
5. **Muzzle flash in sync:** each bullet leaves on a flash frame.
6. **Bodies:** dead guards and boars lie on the ground as bodies, not as an "X" or a pale standing sprite.
7. **Telegraph:** the boar paws in place during the telegraph and gallops only during the charge.
8. **Roles:** the rifleman, spotter and commander can be told apart.

---

## Appendix A — Frame scan

Use `tools/scan_frames.py` from `PLAYER_ART_ANIMATION_TASKS.md` Appendix A, for example:

`python3 tools/scan_frames.py merc_patrol merc_patrol_up merc_patrol_down merc_fire merc_fire_up merc_fire_down merc_idle merc_death boar_idle boar_charge boar_stun boar_death`

Before the fixes, it reported these problems:
- Baseline spread: `merc_patrol` 7 px, `merc_fire` 14 px, `merc_patrol_up` 15 px, `merc_patrol_down` 7 px, `boar_idle` 5 px and `boar_charge` 23 px.
- Frame sizes: 332 × 372 for most sheets, 316 × 356 for `merc_patrol_up` and 288 × 328 for `merc_patrol_down`.

## Appendix B — In-game enemy strip capture

Save as `tools/capture_enemy_strip.js`. With `npm start` running, run `node tools/capture_enemy_strip.js <output-folder>`. It starts the game, stops the game logic (so the script can set each pose), and saves a 150 × 145 crop of a rifleman in each direction and fire pose, the commander, and a boar in each state, including dead and stunned. Put the crops side by side in one image and look at it. After Part B, add rows for the new animators (`animIdle`, `animDeath`, `animStun`, `animPaw`, `animRun`) in the same way.

```js
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3000/');
  await p.waitForTimeout(1200);
  await p.click('#btn-prologue-skip');
  await p.waitForTimeout(200);
  await p.click('text=BEGIN OPERATION');
  await p.waitForTimeout(2500);
  // Stop game logic so poses can be set by hand; rendering keeps running.
  await p.evaluate(() => { const g = window.belumGameInstance; g.mode = 'TEST'; g.player.x = -5000; });
  const clip = (kind, idx) => p.evaluate(([kind, idx]) => {
    const g = window.belumGameInstance, e = g[kind][idx], c = g.camera.getRenderOffset(), z = c.zoom || 1;
    const W = innerWidth, H = innerHeight;
    const sx = (e.centerX - c.x - W / 2) * z + W / 2, sy = (e.y + e.height - c.y - H / 2) * z + H / 2;
    return { x: Math.round(sx - 75), y: Math.round(sy - 125), width: 150, height: 145 };
  }, [kind, idx]);
  const snap = (kind, idx) => p.evaluate(([kind, idx]) => {
    const g = window.belumGameInstance, e = g[kind][idx]; g.camera.snapTo(e.centerX, e.centerY);
  }, [kind, idx]);
  const shot = async (name, kind, idx) => {
    await p.waitForTimeout(60);
    await p.screenshot({ path: `${out}/${name}.png`, clip: await clip(kind, idx) });
  };
  const mi = await p.evaluate(() => window.belumGameInstance.mercenaries.findIndex(m => m.role === 'rifleman'));
  const ci = await p.evaluate(() => window.belumGameInstance.mercenaries.findIndex(m => m.role === 'commander'));
  await snap('mercenaries', mi);
  for (const [dn, ang] of [['right', 0], ['left', Math.PI], ['up', -Math.PI / 2], ['down', Math.PI / 2]]) {
    for (let f = 0; f < 8; f++) {
      await p.evaluate(([i, ang, f]) => {
        const m = window.belumGameInstance.mercenaries[i];
        m.state = 'PATROL'; m.suspicionMeter = 0; m.firingAnimTimer = 0;
        m.facingAngle = ang; m.facingRight = Math.cos(ang) >= 0; m.spriteDir = 'side'; m._updateSpriteDir();
        for (const a of [m.animPatrol, m.animPatrolUp, m.animPatrolDown]) if (a) a.currentFrame = f;
      }, [mi, ang, f]);
      await shot(`merc_${dn}_${f}`, 'mercenaries', mi);
    }
  }
  for (const [dn, ang] of [['right', 0], ['up', -Math.PI / 2], ['down', Math.PI / 2]]) {
    for (let f = 0; f < 8; f++) {
      await p.evaluate(([i, ang, f]) => {
        const m = window.belumGameInstance.mercenaries[i];
        m.facingAngle = ang; m.facingRight = Math.cos(ang) >= 0; m.spriteDir = 'side'; m._updateSpriteDir();
        m.firingAnimTimer = 1;
        for (const a of [m.animFire, m.animFireUp, m.animFireDown]) if (a) a.currentFrame = f;
      }, [mi, ang, f]);
      await shot(`fire_${dn}_${f}`, 'mercenaries', mi);
    }
  }
  await p.evaluate(([i]) => { const m = window.belumGameInstance.mercenaries[i]; m.firingAnimTimer = 0; m.dead = true; m.state = 'DEAD'; }, [mi]);
  await shot('merc_dead', 'mercenaries', mi);
  await snap('mercenaries', ci);
  await shot('commander', 'mercenaries', ci);
  await snap('boars', 0);
  for (const [n, st, an] of [['graze', 'GRAZE', 'animIdle'], ['telegraph', 'TELEGRAPH', 'animCharge'], ['charge', 'CHARGE', 'animCharge']]) {
    for (let f = 0; f < 8; f++) {
      await p.evaluate(([st, an, f]) => {
        const bo = window.belumGameInstance.boars[0];
        bo.state = st; bo.facingRight = true; if (bo[an]) bo[an].currentFrame = f;
      }, [st, an, f]);
      await shot(`boar_${n}_${f}`, 'boars', 0);
    }
  }
  await p.evaluate(() => { window.belumGameInstance.boars[0].state = 'STUNNED'; });
  await shot('boar_stunned', 'boars', 0);
  await p.evaluate(() => { const bo = window.belumGameInstance.boars[0]; bo.dead = true; bo.state = 'DEAD'; });
  await shot('boar_dead', 'boars', 0);
  console.log('page errors:', errs);
  await b.close();
})();
```

Before the fixes, this capture showed:
- The dead guard as an "X".
- `fire_up` using the side sprite.
- The boar's legs running during the telegraph.
- The dead boar as a pale standing sprite.

---

## Final report from the implementing agent

For each task, report:
- The files changed.
- The Appendix A output and the Appendix B strip image.
- The `npm run qc` result.
- Any check that did not pass, with the reason.
