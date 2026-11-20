# Belum: Protocol Zero — View Readability Tasks

Task file for the implementing agent. Do the phases in order. Each phase must pass its checks before the next one starts.

## Context

- The game is plain JavaScript on HTML5 Canvas with no engine. Run it with `npm start`, which opens <http://localhost:3000>. Run the QC suite with `npm run qc`.
- The view is a top-down 3/4 ("oblique") 2.5D view. The ground is a flat top-down map, characters are drawn upright from the side, and objects are depth-sorted by Y (`src/engine/renderer.js:78`).
- **The problem to fix:** guards can face any angle (`mercenary.facingAngle`, `src/entities/mercenary.js:60`), and their vision cone is drawn at that angle (`src/engine/renderer.js:599`). The body sprite can only face left or right (`mercenary.js:121`, `facingRight`). A guard looking up or down the screen is still drawn facing sideways, so the player cannot read the guard's facing from the body.

## Rules

- Do not change gameplay numbers: vision range, FOV, speeds, suspicion timings or damage.
- Keep the ink-on-parchment look. Use only the existing palette: ink `#111E33`, crimson `#F85A5A` and parchment `#F7F3E8`.
- Draw new indicators with Canvas code in the entity's `draw()` method. Do not use image files for them.
- `npm run qc` must pass after each phase, with no new browser console errors.
- Test in a real browser by playing the game, not only by reading the code. Take a screenshot for each check listed below.

---

## Phase A — Facing marker and "?" search mark (no new art)

### A1. Guard facing marker

**Goal:** the player can read a guard's real facing angle at a glance, even when the cone is faint or off screen.

**Where:** in `Mercenary.draw()` in `src/entities/mercenary.js`, after the ground shadow ellipse (around line 444) and before the sprite is drawn, so the marker sits under the guard's feet.

**What to draw:**
- A small hand-drawn ink chevron (arrowhead) on the ground ellipse, pointing along `this.facingAngle`.
- Position it about 26 px from `(this.centerX, this.y + this.height - 4)` along `facingAngle`. Squash its Y offset by 0.4 so it lies flat on the ground, matching the oblique view.
- Size: about 10 px long and 8 px wide, with a line width of 2.
- Colour: ink `#111E33` at 0.75 alpha in `PATROL`, and crimson `#F85A5A` in `SUSPICIOUS` and `ALERT`.
- Hide the marker when `this.dead` is true.

**Checks:**
1. Stand near a patrol guard and wait until it turns to face up, down, left and right. Take a screenshot of each. The chevron must point the same way as the vision cone each time.
2. When the guard turns, the chevron rotates smoothly with `facingAngle`, with no snapping.
3. A dead guard shows no chevron.

### A2. "?" search mark

**Goal:** the player can tell a guard that is searching (`SUSPICIOUS`) from one that has gone back to calm patrol.

**Current behaviour:** the suspicion eye (`_drawInkSuspicionEye`, `mercenary.js:399`) only shows while `suspicionMeter > 0.04`, and `ALERT` shows a red "!" (`mercenary.js:505`). After `ALERT` ends, the guard enters `SUSPICIOUS` and searches for 3 s (`mercenary.js:309-313`), but nothing clearly says it is searching.

**What to draw:**
- While `this.state === 'SUSPICIOUS'`, draw an ink "?" at `(this.centerX, this.y - 20)`. Use the same font style as the "!" (`900 22px "Georgia", serif`), in ink `#111E33`.
- If the suspicion eye is also showing, draw the "?" 18 px to the right of the eye so the two do not overlap.
- Order of priority: "!" (ALERT), then "?" (SUSPICIOUS), then nothing (PATROL).

**Checks:**
1. Let a guard spot you until "!" shows, then break line of sight. Take screenshots showing "!", then "?" while it searches, then no mark once it returns to patrol.
2. The "?" and the eye never overlap.

---

## Phase B — Up and down sprite sheets (optional, needs new art)

Do Phase B only if the owner approves the new art. Phase A is enough to fix readability.

### B1. Art to generate

All sheets must match the existing sheets exactly, or the character will change size between directions.

| Spec | Value |
|---|---|
| Sheet size | 1376 × 768 px PNG |
| Grid | 4 columns × 2 rows, 8 frames, each cell 344 × 384 px |
| Grid lines | Thin dark navy lines between cells, the same as the current sheets |
| Background | Flat cream parchment, close to `#F7F3E8`, with no texture inside the cells. The animator removes the background by flood-filling bright cream from the edges (`src/engine/animator.js:9`), so the background must stay light and even. |
| Character scale | The same height as the current side-view frames: the helmet top is about 45 px from the cell top, the boots are about 360 px from the cell top, and the figure is centred horizontally |
| Shadow | The same small hatched ink ground shadow under the feet |
| Frame order | Left to right, top row first, as one smooth walk cycle that loops from frame 8 back to frame 1 |

Reference sheets to attach to every prompt: `assets/sprites/merc_patrol_8f.png` (mercenary) and `assets/sprites/kancil_walk_8f.png` (player).

**Shared style block** (paste this at the start of every prompt):

> Vintage dip-pen ink etching on flat cream parchment paper (#F7F3E8). Dense cross-hatching and stipple shading in dark Prussian-blue navy ink (#111E33), with only a small crimson (#F85A5A) accent where noted. No colour fill, no gradients, no paper texture inside the cells. Sprite sheet: 1376×768 px, a 4-column × 2-row grid of 8 equal cells (344×384 px each) separated by thin dark navy lines. One full-body character per cell, centred, the same size in every cell, feet near the bottom of the cell, with a small hatched ink shadow under the boots. The 8 frames form one smooth looping walk cycle, read left to right, top row first. Match the attached reference sheet exactly in line weight, shading density, proportions and character height.

**Required sheets (mercenary):**

1. `merc_patrol_up_8f.png`
   > [Shared style block] Subject: an Ironclad mercenary soldier walking AWAY from the viewer, seen from behind at a slight high 3/4 angle. Visible: the back of the combat helmet, a tactical backpack, the back of the plate carrier, the rifle barrel showing past the right shoulder, knee pads, and boots. The face is not visible. An 8-frame patrol walk cycle with alternating legs and a slight shoulder sway. A small crimson accent on the rifle optic only. Same uniform and gear as the attached merc_patrol_8f.png reference.

2. `merc_patrol_down_8f.png`
   > [Shared style block] Subject: the same Ironclad mercenary soldier walking TOWARD the viewer, seen from the front at a slight high 3/4 angle. Visible: helmet, dark goggles, face, plate carrier with pouches, and the assault rifle held low across the chest pointing down-left. An 8-frame patrol walk cycle with alternating legs. A small crimson accent on the rifle optic only. Same uniform and gear as the attached merc_patrol_8f.png reference.

3. `merc_fire_up_8f.png`
   > [Shared style block] Subject: the same mercenary seen from behind, standing braced and firing a 3-round burst AWAY from the viewer, with the rifle raised to the shoulder. Frames 1–2 raise the weapon, frames 3–6 show three recoil kicks with a small ink-hatched muzzle flash past the head (crimson tint only on the flash), and frames 7–8 recover. Same gear as the merc_fire_8f.png reference.

4. `merc_fire_down_8f.png`
   > [Shared style block] Subject: the same mercenary facing the viewer, braced and firing a 3-round burst TOWARD the viewer, with the rifle at the shoulder pointing slightly down-forward. Frames 1–2 raise the weapon, frames 3–6 show three recoil kicks with a small ink-hatched muzzle flash at the barrel (crimson tint only on the flash), and frames 7–8 recover. Same gear as the merc_fire_8f.png reference.

**Optional sheets (player, Operator Kancil).** Make these only if the player should also turn. Do `PLAYER_ART_ANIMATION_TASKS.md` first. Use `kancil_walk_8f.png` as the identity reference for every player sheet. The current `kancil_stealth_8f.png` and `kancil_parang_8f.png` show a bare head and must not be used as references. Follow the "Canonical character look" section in `PLAYER_ART_ANIMATION_TASKS.md`: helmet and rucksack in every frame. For sheets 7 and 8 (stealth), draw a crouch-walk, not a kneel.

5. `kancil_walk_up_8f.png`
   > [Shared style block] Subject: Operator Kancil, a lone tactical operator with a large rucksack and a steel parang machete held low in the right hand, walking AWAY from the viewer, seen from behind at a slight high 3/4 angle. An 8-frame walk cycle. No crimson. Same gear as the attached kancil_walk_8f.png reference.

6. `kancil_walk_down_8f.png`
   > [Shared style block] Subject: Operator Kancil walking TOWARD the viewer, seen from the front at a slight high 3/4 angle, with the helmet, face, chest rig and parang held low in the right hand visible. An 8-frame walk cycle. No crimson. Same gear as the kancil_walk_8f.png reference.

7. `kancil_stealth_up_8f.png`
   > [Shared style block] Subject: Operator Kancil in a low crouch-stalk, seen from behind and moving AWAY from the viewer, with knees deeply bent, back hunched and the parang held ready. An 8-frame slow sneaking cycle. Same gear as the kancil_stealth_8f.png reference.

8. `kancil_stealth_down_8f.png`
   > [Shared style block] Subject: Operator Kancil in a low crouch-stalk, moving TOWARD the viewer, seen from the front, with knees deeply bent, eyes forward and the parang held ready. An 8-frame slow sneaking cycle. Same gear as the kancil_stealth_8f.png reference.

9. `kancil_parang_up_8f.png`
   > [Shared style block] Subject: Operator Kancil seen from behind, performing one overhead-to-forward parang slash AWAY from the viewer. Frames 1–2 wind up, frames 3–5 slash with ink speed lines, and frames 6–8 follow through and recover. Same gear as the kancil_parang_8f.png reference.

10. `kancil_parang_down_8f.png`
    > [Shared style block] Subject: Operator Kancil facing the viewer, performing one parang slash TOWARD the viewer. Frames 1–2 wind up, frames 3–5 slash diagonally downward with ink speed lines, and frames 6–8 follow through and recover. Same gear as the kancil_parang_8f.png reference.

### B2. Art quality gate (check before any code)

Reject a sheet and generate it again if any of these fail:
- The size is not 1376 × 768, or the grid is not 4 × 2.
- The character height differs from the side-view sheet by more than 5% (compare frame 1 of each).
- The character is facing the wrong direction, or the face is visible on an "up" sheet.
- The background inside the cells is textured, dark or not cream, which breaks background removal.
- The frames do not form a smooth loop, for example a jump in leg position between frame 8 and frame 1.
- The gear does not match the side view, such as a different helmet, weapon or backpack.

### B3. Code changes

1. Put the new sheets in `assets/sprites/`. Slice each one into frames:
   `python3 tools/slice_sprites.py assets/sprites/merc_patrol_up_8f.png assets/sprites/frames merc_patrol_up 3`
   This writes `assets/sprites/frames/merc_patrol_up_0.png` … `_7.png`, the same pattern as the existing frames.
2. In `src/entities/mercenary.js`, next to `animPatrol` and `animFire` (line 96), add `animPatrolUp`, `animPatrolDown`, `animFireUp` and `animFireDown`. Use the same `fps` values with the new `framePrefix` names.
3. Choose the sheet from `facingAngle` (canvas Y points down):
   - `sin(facingAngle) < -0.6`: use the "up" sheet (facing up the screen).
   - `sin(facingAngle) > 0.6`: use the "down" sheet.
   - Otherwise: use the side sheet, flipped by `facingRight` as now.
   - Add hysteresis so the sheet does not flicker at the boundary: switch into up or down at |sin| > 0.65 and back to side at |sin| < 0.55. Keep the current sheet between those values.
4. If an up or down animator is not ready because frames failed to load, fall back to the side sheet. The game must never draw nothing.
5. Keep `drawW`, `drawH`, `drawX` and `drawY` the same for all directions, so the guard does not change size or slide when it turns.
6. Keep the Phase A chevron. It still shows the exact angle between the 4 sprite directions.
7. If the player sheets (5–10) were made, apply the same logic in `src/entities/player.js` (lines 82–84 and 339–343), using the aim angle that `facingRight` is built from at line 211.
8. Add the new sheet files and frame files to the required-file list in `tools/qc_validator.js`.

### B4. Checks

1. Watch a guard turn through a full circle. Record a strip of frames, or take 8 screenshots. The body uses the up sheet when the cone points up, the down sheet when it points down, and the side sheet otherwise.
2. At the switch point, the guard's feet stay in the same place and the height does not jump.
3. Watch a guard walk straight up and straight down the screen. The legs animate and the feet do not slide.
4. Watch a guard fire while facing up and while facing down. The fire sheet for that direction plays.
5. Temporarily rename one frame folder or prefix. The guard falls back to the side sheet with no console error. Then undo the rename.

---

## Phase C — Diagonal look for paths and the riverbank (visual only, no new art)

**Goal:** break up the all-straight layout so the jungle feels more natural, like a diagonal road crossing the screen. Collision stays the same.

**Current state:** every zone in `src/world/level_act1.js:58-68` is an axis-aligned rectangle, for example the path bands at y=585, 550, 570 and 490. Terrain is drawn by code in `Renderer25D._drawTerrain` (`src/engine/renderer.js`), with no image files.

**What to do:**
1. In `_drawTerrain`, draw each path band as a polygon whose top and bottom edges are wavy and slanted. Use small seeded offsets so the shape is the same every frame. Join each band to the next at a diagonal, so the route reads as one winding trail.
2. Draw the river edge (`riverZone`, x 0–135) as an irregular hand-inked bank line instead of a straight vertical line.
3. Do not change any collision box, zone rectangle used for gameplay, waypoint or spawn point. This is a drawing-only change.
4. Keep the ink-hatch style: a 1.5–2.5 px ink edge line with light hatching along the edge.

**Checks:**
1. Take a screenshot of each sector (x ≈ 0, 1050, 2150 and 3200). Paths read as a connected, winding trail.
2. Walk the player along the full path. Nothing blocks movement that did not block it before, and nothing new can be walked through.
3. The shapes do not shimmer or change between frames (they use a fixed seed).
4. The frame rate does not drop. Pre-render the terrain to an offscreen canvas if needed.

---

## Final report from the implementing agent

For each phase, report:
- The files changed.
- The screenshots taken for each check.
- The `npm run qc` result.
- Any check that did not pass, with the reason.
