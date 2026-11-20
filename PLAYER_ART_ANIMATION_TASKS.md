# Belum: Protocol Zero — Player Art and Animation Fix Tasks

Task file for the implementing agent. It fixes the problems found in an audit of Operator Kancil's sprites and animation. Part A needs only code. Part B needs new art. Do Part A first: it is useful on its own, and Part B depends on its slicing tool.

## Rules

- Run the game with `npm start`, which opens <http://localhost:3000>. Run the QC suite with `npm run qc`.
- Do not change gameplay numbers (speeds, damage, cooldowns, hit ranges). These fixes change only how the player looks.
- `npm run qc` must pass after each task, with no new browser console errors.
- Test in a real browser by playing the game, not only by reading the code. For each task, capture a frame strip with Appendix B and **look at it**. Check the size, the foot line, the frame order, and anything that should not be there.
- Line numbers refer to commit `bba08cf` on `main`. Search by the quoted code if lines have moved.

## Canonical character look (applies to every sheet)

Every player sheet must match `assets/sprites/kancil_walk_8f.png` (the walk sheet). This rule also applies to the player sheets in `VIEW_READABILITY_TASKS.md` Phase B.

- A rounded combat helmet, worn in **every** frame. No bare head.
- A large tactical rucksack on the back, in **every** frame.
- A plate carrier with chest pouches, gloves, knee pads and combat boots.
- A steel parang (machete) held in the right hand.
- Facing **right** in all sheets. The game mirrors the sprite to face left.

## Audit summary (what is wrong today)

| # | Problem | Fixed in |
|---|---|---|
| 1 | The crouch ("stealth") sheet is a kneeling pose that barely changes, so the player slides while kneeling when moving crouched. | B1 |
| 2 | Crouch and slash sheets show a bare head instead of the helmet, and slash frames 1–2 have no rucksack. | B1, B2 |
| 3 | The slash animation (8 frames at 16 fps = 0.5 s) is shown for only 0.36 s, so the follow-through frames never appear. | A1 |
| 4 | Dark grid lines are left inside some frames: `kancil_stealth` frames 1, 2, 5 and 6 at x = 6–7 or 324–326, and `kancil_walk` frames 0, 3, 4 and 7 at the edge. The line is visible next to the player while crouching. | A4 |
| 5 | Fern clumps are drawn inside the crouch frames and pop in and out under the player. | B1 |
| 6 | The crouched figure is almost as tall as the standing one (68–84 px against 77–84 px on screen). The slash figure is about 10–15% smaller than the walk figure. | A5, B |
| 7 | Every frame is drawn into a square 84 × 84 box, so all sprites are 12–14% too wide. Guards have the same problem. | A2 |
| 8 | The walk cycle always plays at 8 fps, so the feet slide when walking (an estimated 2.3×) and more when sprinting (an estimated 3.5×). | A3 |
| 9 | There is no idle pose. The walk animation freezes mid-step when the player stops. | B3 |
| 10 | The walk sheet is sliced to 292 × 332 frames and the other sheets to 332 × 372, so the same character is scaled differently in each animation. | A4 |

---

## Part A — Code fixes (no new art)

### A1. Play the full slash animation

**Where:** `_performParangSlash()` in `src/main.js:633` sets `p.parangAnimTimer = 0.36`.

**Change:** set `p.parangAnimTimer = 0.5`, which is 8 frames at 16 fps. `parangAnimTimer` is used only for drawing (`player.js:201`, `:270` and `:338`), so this does not change combat timing. Leave `attackCooldown = 0.42` as it is. A new slash after 0.42 s restarts the animation, which is correct.

**Check:** capture the slash with Appendix B, with frames 60 ms apart. All 8 slash frames appear, including the final follow-through frames, before the walk pose returns.

### A2. Draw frames at their real aspect ratio

**Where:** `Sprite8FrameAnimator.draw()` in `src/engine/animator.js:163-174`, which calls `ctx.drawImage(frame, -drawW*0.5, -drawH*0.5, drawW, drawH)`.

**Change:** keep `drawH` as the height and compute `const w = drawH * frame.width / frame.height`. Draw the frame `w` wide, centred on the same x, with its bottom edge in the same place as now: `y + drawH`. The feet must not move up or down. Callers stay the same. This fixes the player, guards and boars together.

**Check:** take a screenshot of the player, a guard and a boar. None of them looks stretched sideways. The feet sit on the shadow ellipse as before.

### A3. Match animation speed to movement speed

**Where:** `player.js:270-276`, where `animWalk.update(safeDt, this.moving)` and `animStealth.update(...)` run.

**Change:** compute the player's actual speed this frame in px/s. Before each walk or crouch `update`, set the animator's `fps` to `clamp(8 * speed / 162, 4, 16)` for walking and sprinting, and `clamp(8 * speed / 96, 4, 12)` for crouch-walking. At normal walking speed (162 px/s), the walk still plays at 8 fps. Tune the base numbers by eye: in a frame strip, the planted foot should stay in place while the body moves.

**Check:** capture walk and sprint strips. The sprint cycle plays clearly faster than the walk cycle, and planted feet do not slide forward more than a few pixels between frames.

### A4. Re-slice all sheets: remove grid lines and use one frame size

**Where:** `tools/slice_sprites.py`, which currently uses a fixed cell size and a 3 px margin.

**Change:**
1. Find the grid lines automatically: any column or row where more than 80% of the pixels are dark (luma below 120) is a grid line. Cut each cell 4 px inside its surrounding grid lines.
2. Put every frame of every sheet on the **same canvas size, 332 × 372**. Place the cell contents centred horizontally, with the lowest ink pixel (the boot soles) on a fixed baseline at y = 356. Fill the rest with transparent pixels, or with flat `#F7F3E8` if the animator's background removal needs it.
3. Re-slice every sheet in `assets/sprites/` (player, guard and boar) into `assets/sprites/frames/` with the same names as now.

**Check:** run Appendix A. It must report **0** full-height grid lines in every frame, the same frame size for every frame, and a boot baseline that differs by no more than 3 px across frames.

### A5. One character scale across animations

**Problem:** each sheet fills its cells differently. On screen, the slash figure is about 10–15% smaller than the walk figure.

**Change:** add an optional `scale` value to the `Sprite8FrameAnimator` options (default 1), and multiply `drawH` by it in `draw()`. Using Appendix A, measure the median standing-figure ink height in each sheet. Set each standing animation's `scale` so its figure is the same height on screen as the walk figure, within 5%. Do this for the slash now. New sheets from Part B should not need it if they follow the size rules.

**Check:** in a strip that switches from walk to slash and back, the head height does not jump by more than about 4 px on screen.

---

## Part B — New art

Generate each sheet, check it against the quality gate in B5, and only then add it to the game. Attach `assets/sprites/kancil_walk_8f.png` to **every** prompt as the identity reference.

### Sheet format (all new sheets)

| Spec | Value |
|---|---|
| Size | 1376 × 768 px PNG |
| Grid | 4 columns × 2 rows, 8 cells of 344 × 384 px, separated by thin dark navy lines |
| Background | Flat cream `#F7F3E8` inside the cells. No texture, no plants, no ground objects. The game removes the background by flood-filling bright cream from the edges, so it must be light and even. |
| Standing height | Helmet top at about y = 40 and boot soles at about y = 350 in each cell (about 310 px tall), centred horizontally |
| Baseline | The boot soles sit on the same line (y ≈ 350) in **every** frame and **every** sheet |
| Shadow | Only a small hatched ink shadow under the boots |
| Facing | Right |
| Frame order | Left to right, top row first, as one smooth loop (frame 8 leads back into frame 1) unless the prompt says otherwise |

### Shared style block (paste at the start of every prompt)

> Vintage dip-pen ink etching on flat cream parchment paper (#F7F3E8). Dense cross-hatching and stipple shading in dark Prussian-blue navy ink (#111E33). No colour fill, no gradients, no paper texture inside the cells, and no plants, rocks or scenery: only the character and a small hatched ink shadow under the boots. Sprite sheet: 1376×768 px, a 4-column × 2-row grid of 8 equal cells (344×384 px each) separated by thin dark navy lines. One full-body character per cell, centred, facing right, with the boot soles on the same baseline near the bottom of every cell. Character: Operator Kancil, exactly as in the attached reference sheet: a rounded combat helmet worn in every frame, a large tactical rucksack on the back in every frame, a plate carrier with chest pouches, gloves, knee pads, combat boots, and a steel parang machete in the right hand. Match the reference exactly in line weight, shading density, proportions and gear.

### B1. Crouch-walk (replaces `kancil_stealth_8f.png`)

File: `assets/sprites/kancil_crouchwalk_8f.png`

> [Shared style block] Subject: Operator Kancil sneaking forward in a low crouch-walk, moving to the right. Knees deeply bent, torso leaning forward and low, head down and alert, parang held low and ready in the right hand. A real walking cycle: the feet take alternating small careful steps across the 8 frames, with each foot lifting and planting in turn. NOT kneeling and NOT still. The top of the helmet is at about 70% of the standing height (about y = 135 in the cell), and the boot soles are on the same baseline as the walk sheet. Helmet and rucksack visible in every frame.

### B2. Parang slash (replaces `kancil_parang_8f.png`)

File: `assets/sprites/kancil_parang_8f.png`. Also attach the current `kancil_parang_8f.png` as the **pose** reference.

> [Shared style block] Subject: Operator Kancil performing one powerful parang slash to the right, keeping the same poses as the attached slash reference but with the helmet and rucksack in every frame. Frames 1–2: wind-up, with the parang raised back over the shoulder. Frames 3–5: the slash, with sweeping ink speed-line arcs following the blade, and a thin crimson (#F85A5A) edge on the speed lines only. Frames 6–8: follow-through and recovery back to a ready stance. This sheet plays once and does not loop. Keep all speed lines inside each cell, at least 16 px from the cell edges. The figure stands the same height as in the walk reference.

### B3. Idle (new)

File: `assets/sprites/kancil_idle_8f.png`

> [Shared style block] Subject: Operator Kancil standing still on alert, facing right, with the parang held low in the right hand. Very small motion across the 8 frames: slow breathing (the chest and rucksack rise and fall by a few pixels) and a slight head turn as if scanning the jungle, then back. The feet stay planted and do not move. It loops smoothly. The same height and baseline as the walk reference.

### B4. Sprint (optional, new)

File: `assets/sprites/kancil_sprint_8f.png`. Make this only if A3 alone does not look good enough when sprinting.

> [Shared style block] Subject: Operator Kancil running fast to the right: body leaning forward, long strides, arms pumping, parang held low and back in the right hand, rucksack bouncing slightly. An 8-frame running cycle with both feet off the ground in two of the frames. The same height and baseline as the walk reference.

### B5. Art quality gate (check before any code)

Reject a sheet and generate it again if any of these fail:
- The size is not 1376 × 768, or the grid is not 4 × 2.
- **The helmet or rucksack is missing in any frame.**
- There are plants, rocks or scenery in any cell, or the background inside a cell is textured or not cream.
- Speed lines or body parts touch a cell edge or cross a grid line.
- The standing height differs from the walk sheet by more than 5% (compare with Appendix A after slicing). For B1, the crouch height is not about 65–75% of the standing height.
- The boot baseline varies by more than 3 px between frames (Appendix A).
- The crouch-walk shows kneeling or the same pose in all frames, instead of a stepping cycle.
- The loop jumps between frame 8 and frame 1 (not required for B2).

### B6. Add the new sheets to the game

1. Slice each sheet with the A4 slicer, for example:
   `python3 tools/slice_sprites.py assets/sprites/kancil_crouchwalk_8f.png assets/sprites/frames kancil_crouchwalk`
2. In `src/entities/player.js:82-84`:
   - Change `animStealth` to use `framePrefix: 'kancil_crouchwalk'`.
   - Add `this.animIdle = new Animator({ fps: 6, framePrefix: 'kancil_idle' })`.
   - If B4 was made, add `this.animSprint = new Animator({ fps: 12, framePrefix: 'kancil_sprint' })`.
3. In `update()` (`player.js:270-276`) and `draw()` (`player.js:338-344`), choose the animation in this order:
   1. Slash, while `parangAnimTimer > 0`.
   2. Crouch-walk, while crouching. When crouched but not moving, hold crouch-walk frame 0 instead of a mid-step frame.
   3. Sprint, while sprinting and moving, if B4 exists.
   4. Walk, while moving.
   5. Idle, while not moving.
4. Each animator falls back to the walk animator if its frames have not loaded. The player must never be drawn as nothing.
5. Keep the old `kancil_stealth_8f.png` file until the new crouch is approved, then delete it and its frames.
6. Add the new sheet and frame files to the required-file list in `tools/qc_validator.js`.

### B7. Checks after Part B

Capture strips with Appendix B and look at them:
1. **Same look:** the helmet and rucksack appear in every frame of idle, walk, crouch, slash and sprint.
2. **Same size:** standing head height is the same across idle, walk, slash and sprint (within about 4 px on screen). Crouched head height is about 65–75% of standing.
3. **Feet on the line:** the boot soles stay on the blue baseline in every frame.
4. **No pop-in:** no plants or lines appear or disappear around the player.
5. **No sliding:** in the crouch-walk strip, the planted foot stays in place while the body moves forward.
6. **Idle:** standing still shows the breathing idle, not a frozen step.
7. **Slash:** all 8 frames play once, then the game returns to idle or walk.

---

## Appendix A — Frame scan (grid lines, size, baseline, ink height)

Save as `tools/scan_frames.py`. Run `python3 tools/scan_frames.py kancil_walk kancil_crouchwalk kancil_parang kancil_idle`.

```python
import sys
from PIL import Image

def is_ink(p):
    r, g, b, a = p
    return a > 20 and 0.299 * r + 0.587 * g + 0.114 * b < 120

problems = 0
for prefix in sys.argv[1:]:
    sizes, bottoms, heights = set(), [], []
    for i in range(8):
        im = Image.open(f'assets/sprites/frames/{prefix}_{i}.png').convert('RGBA')
        w, h = im.size
        px = im.load()
        sizes.add((w, h))
        lines = [x for x in range(w) if sum(is_ink(px[x, y]) for y in range(h)) > 0.8 * h]
        lines += [y for y in range(h) if sum(is_ink(px[x, y]) for x in range(w)) > 0.8 * w]
        if lines:
            print(f'[FAIL] {prefix}_{i}: grid line at {lines}')
            problems += 1
        ys = [y for y in range(h) for x in range(w) if is_ink(px[x, y])]
        bottoms.append(max(ys))
        heights.append(max(ys) - min(ys))
    print(f'{prefix}: frame sizes {sizes}, baseline spread {max(bottoms) - min(bottoms)} px, '
          f'ink height min/median/max {min(heights)}/{sorted(heights)[4]}/{max(heights)}')
    if len(sizes) != 1:
        print(f'[FAIL] {prefix}: frames have different sizes')
        problems += 1
    if max(bottoms) - min(bottoms) > 3:
        print(f'[FAIL] {prefix}: baseline varies by more than 3 px')
        problems += 1
sys.exit(1 if problems else 0)
```

Before the fixes, this found grid lines in `kancil_walk` frames 0, 3, 4 and 7 and `kancil_stealth` frames 1, 2, 5 and 6, and two different frame sizes (292 × 332 and 332 × 372).

## Appendix B — In-game frame strip capture

Save as `tools/capture_player_strip.js`. With `npm start` running, run `node tools/capture_player_strip.js <output-folder>`. It plays the game and saves 140 × 140 crops around the player for idle, walk right, walk left, sprint, crouch and slash. Put them side by side in one image and look at it.

```js
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:3000/');
  await p.waitForTimeout(1200);
  await p.click('#btn-prologue-skip');
  await p.waitForTimeout(200);
  await p.click('text=BEGIN OPERATION');
  await p.waitForTimeout(1500);
  const clip = () => p.evaluate(() => {
    const g = window.belumGameInstance, pl = g.player, c = g.camera.getRenderOffset(), z = c.zoom || 1;
    const W = innerWidth, H = innerHeight;
    const sx = (pl.centerX - c.x - W / 2) * z + W / 2;
    const sy = (pl.y + pl.height - c.y - H / 2) * z + H / 2;
    return { x: Math.round(sx - 70), y: Math.round(sy - 120), width: 140, height: 140 };
  });
  const shots = async (tag, n, gap) => {
    for (let i = 0; i < n; i++) {
      await p.screenshot({ path: `${out}/${tag}_${i}.png`, clip: await clip() });
      await p.waitForTimeout(gap);
    }
  };
  await shots('idle', 4, 160);
  await p.keyboard.down('KeyD'); await p.waitForTimeout(300); await shots('walkR', 8, 125); await p.keyboard.up('KeyD');
  await p.keyboard.down('KeyA'); await p.waitForTimeout(300); await shots('walkL', 4, 125); await p.keyboard.up('KeyA');
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyD'); await p.waitForTimeout(300);
  await shots('sprint', 8, 80);
  await p.keyboard.up('KeyD'); await p.keyboard.up('ShiftLeft');
  await p.keyboard.press('KeyC'); await p.waitForTimeout(300);
  await p.keyboard.down('KeyS'); await p.waitForTimeout(300); await shots('crouch', 8, 125); await p.keyboard.up('KeyS');
  await p.keyboard.press('KeyC'); await p.waitForTimeout(300);
  await p.keyboard.press('Space'); await shots('slash', 10, 55);
  await b.close();
})();
```

---

## Final report from the implementing agent

For each task, report:
- The files changed.
- The Appendix A output and the Appendix B strip image.
- The `npm run qc` result.
- Any check that did not pass, with the reason.
