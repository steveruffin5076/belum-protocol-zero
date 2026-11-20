# Belum: Protocol Zero — Expansion Fix Tasks

Task file for the implementing agent. These fixes come from a review of commit `b26d42a` (`ACT1_EXPANSION_MODERN_TASKS.md` Tasks 10, 9, 4, 7 and 6). Do them in order, before the remaining expansion tasks (1, 2, 3, 5 and 8).

## Rules

- Run the game with `npm start` (<http://localhost:3000>). After each fix, run `npm run qc`, `npm run test:ai`, `node tools/act1_flow_check.js` and `node tools/needs_check.js`. All must pass.
- Test with **real input**: hold and press keys through Playwright (`page.keyboard.down/up/press`) and let the game move the player. Teleporting the player and calling internal functions is allowed only to **set up** a test, never to prove that something works. The review found the gate bypass only by walking.
- Do not change gameplay numbers except where a fix says so.
- Line numbers refer to commit `b26d42a` on `main`. Search by the quoted code if lines have moved.

---

## Fix 1 — Every sector gate can be walked around (High)

**Problem:** each sector gate (`level_act1.js:98`, `:107` and `:122`) blocks only part of the boundary between sectors. In a walking test, holding D from 90 px left of each boundary crossed it at these heights:

| Boundary | Gate | Crossed at |
|---|---|---|
| Sector 1 → 2 (x = 1065) | `outpost_fence_gate`, y 540–760 | y = 300, 1000, 1150 |
| Sector 2 → 3 (x = 2135) | `outpost_east_gate`, y 540–760 | y = 1000 |
| Sector 3 → 4 (x = 3090) | `ravine_east_gate`, y 500–800 | y = 215, 1065, 1250 |

So the bolt cutters, Drive 01 and the pump station are not actually required.

**Required change:**
1. Close each boundary **from y = 0 to y = 1320**, leaving only the gate. Use solid fence or wall obstacles that fit the scene: outpost fence for Sector 1 → 2, a log-and-wire barricade or dense bamboo for Sector 2 → 3, and the perimeter fence plus the existing bunker walls for Sector 3 → 4.
2. Close any gap narrower than 40 px between obstacles along a boundary too. The player's collision radius is 16 px, so a 30 px gap must still be closed.
3. Keep the culvert as the only other way into Sector 4, and only once it is unlocked, as the expansion file describes. If the culvert opening crosses the x = 3090 line, it must stay solid until `culvertUnlocked`.
4. Guards and boars must stay inside their own sector unless a gate is open.
5. Make the new barriers look intentional: no invisible walls. Use the existing fence and bamboo drawing, or ink placeholders with a `TODO` comment naming the art.

**Check:** Appendix A (`tools/gate_geometry_check.js`). With the gates closed, every boundary must block at **every** test height. After a gate opens, the player must be able to cross at the gate's height.

---

## Fix 2 — The act is still far shorter than 10–15 minutes (High)

**Problem:** with every required step (bolt cutters, Drive 01, decrypting at a basha, the lab safe, the pump station, the gate terminal), the shortest walking route is about **6,000 px, roughly 37 s**, plus the 15 s gate hold. The report's "11–14 min" was an estimate, not a timed run.

**Required change:**
1. **Write `tools/route_length_check.js`:**
   - Build a walkable grid from `level.obstacles` with 10 px cells, padding every solid obstacle by the player radius (16 px), with all gates closed.
   - Run A* through the **required** objectives in order, from `act1_flow.js`, opening each gate only after its requirement is met.
   - Print the walking distance and the time at walk speed (162 px/s) per sector and in total. Exit 1 if the total is under the target below.
2. **Target:** the required route must take at least **150 s of pure walking**, with at least 30 s in each sector. Careful stealth play is usually 4–6 times longer than pure walking, which gives about 10–15 minutes.
3. Reach the target with design, not long empty walks:
   - Place each required objective inside or behind an active patrol, so it cannot be reached without passing a guard's cone.
   - Add short **detours that need something**: for example, Drive 01 is in the field lab's back room, reached through the diesel shed, which needs the generator turned off first. The pump station needs a fuse from the guard tower.
   - Add **one more patrolling guard per sector** on the required route. Sector 1 keeps its single teaching guard near the start, and the new guard goes near the fence.
   - Use vertical space: required objectives near the top and bottom edges of each sector, so the route zig-zags instead of running straight across.
4. Do not pad the route with empty corridors, and do not slow the player down.
5. **Report honestly:** the route check gives pure walking time only. Do **not** claim a total play time you did not measure. In the final report, state the route check output and ask the owner to time one careful real playthrough.

**Check:** `node tools/route_length_check.js` exits 0 and prints at least 150 s in total and at least 30 s per sector. `node tools/act1_flow_check.js` still passes.

---

## Fix 3 — A leech attaches at the start position (Medium)

**Problem:** leeches use `p.centerX < 210` in Sector 1 (`main.js`, around line 2380), but the player spawns at centre x = 209. Standing still for 5 s at the start gave 1 leech.

**Required change:**
1. Use the real river area instead of a hard-coded x: the player's centre is inside `level.riverZone` (x 0–135). Do the same for the flooded culvert, as it is now.
2. Check that no spawn point (`SECTOR_SPAWNS` and `level.spawn`) is inside a leech zone.

**Check, with real input:**
1. Start a new game and do not touch the keys for 10 s. There are 0 leeches.
2. Hold A until the player stands inside the river (centre x < 135) and wait 4.5 s. There is 1 leech.

---

## Fix 4 — Floor labels and "hidden" basha sites are visible from far away (Medium)

**Problem:** the start of Sector 1 shows many floor items, each with a large badge and a name label you can read from across the screen (Crossbow, Steel Parang, Rainwater Catch, Empty Can & Pebbles, VBS Courier Body Camera, Diesel Fuel & Cloth and more). The basha site shows a "BASHA SITE (S1)" label from far away, although the design says basha sites are hidden. The labels are drawn by `renderer.js` around lines 1011, 1044 and 1061.

**Required change (until Task 5 replaces floor items with containers):**
1. Draw an item's badge and label only when the player's centre is within **120 px**. Beyond that, draw only a small ink sparkle, and only within 220 px.
2. Basha sites have no label and no marker until **discovered**, which means the player came within 150 px. After discovery, show a small tarp-shelter icon with no text, from any distance.
3. Objective markers (the bolt cutters, the fence, the safe and so on) follow the same 120 px rule. The objective list is the guide.

**Check:** take a screenshot at the start of a new game. No item label or basha label is visible, apart from items within 120 px. Walk to the Sector 1 basha with real input: its icon appears after you come within 150 px and stays after you leave.

---

## Fix 5 — The objective list gives away the safe code (Low)

**Problem:** the safe code **4719** appears before Drive 01 is decrypted:
- `main.js:1044`: `'Get Tier-1 Keycard (Lab Safe 4719 or Cmdr Ward)'`
- `hud.js:180`: the mission log text, `"... (Lab Safe 4719 or Commander Ward) ..."`

**Required change:**
1. Before `inventory.hasSafeCode`, the objective reads **"Get Tier-1 Keycard (Lab Safe or Cmdr Ward)"**. After decrypting Drive 01, it reads **"Get Tier-1 Keycard (Lab Safe code 4719 or Cmdr Ward)"**.
2. Remove the code from the mission log text. Show it only in the decrypted Drive 01 entry.

**Check:** `grep -rn "4719" src index.html` shows the code only in the decrypted-drive text and in the conditional objective string. In a new game, the code is not visible in the objective list or the mission log until Drive 01 is decrypted.

---

## Fix 6 — The flow check does not test real geometry (Medium)

**Problem:** `tools/act1_flow_check.js` checks the objective graph only, so it passed while every gate could be walked around.

**Required change:**
1. Keep `act1_flow_check.js` for the graph.
2. Add `tools/gate_geometry_check.js` (Appendix A) and `tools/route_length_check.js` (Fix 2).
3. Add an `npm run test:level` script that runs all three, and add it to the final report from now on.

**Check:** temporarily delete one new barrier segment and run `npm run test:level`. It must fail. Then restore the segment.

---

## Appendix A — `tools/gate_geometry_check.js`

With `npm start` running, run `node tools/gate_geometry_check.js`. It uses real key input to walk right from 90 px left of each boundary, at every height from 40 to 1280 in steps of 40. Enemies are frozen and damage is off **inside the test only**.

```js
const { chromium } = require('playwright');
const BOUNDARIES = [
  { name: 'S1->S2', x: 1065, gateId: 'outpost_fence_gate', gateY: 650 },
  { name: 'S2->S3', x: 2135, gateId: 'outpost_east_gate', gateY: 650 },
  { name: 'S3->S4', x: 3090, gateId: 'ravine_east_gate', gateY: 650 }
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:3000/');
  await p.waitForTimeout(900);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(900);
  await p.click('#btn-prologue-skip');
  await p.waitForTimeout(200);
  await p.click('text=BEGIN OPERATION');
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const g = window.belumGameInstance;
    g.player.takeDamage = () => 0;
    for (const m of g.mercenaries) m.update = () => {};
    for (const bo of g.boars) bo.update = () => {};
    for (const d of (g.drones || [])) d.update = () => {};
  });
  const place = (x, y) => p.evaluate(([x, y]) => {
    const g = window.belumGameInstance;
    g.player.x = x - g.player.width / 2;
    g.player.y = y - g.player.height * 0.72;
    g.camera.snapTo(x, y);
  }, [x, y]);
  const walkRight = async (ms) => { await p.keyboard.down('KeyD'); await p.waitForTimeout(ms); await p.keyboard.up('KeyD'); };
  let failures = 0;
  for (const bd of BOUNDARIES) {
    const crossed = [];
    for (let y = 40; y <= 1280; y += 40) {
      await place(bd.x - 90, y);
      await walkRight(1400);
      const cx = await p.evaluate(() => window.belumGameInstance.player.centerX);
      if (cx > bd.x + 30) crossed.push(y);
    }
    if (crossed.length) { failures++; console.log(`[FAIL] ${bd.name} closed but crossed at y = ${crossed.join(', ')}`); }
    else console.log(`[PASS] ${bd.name} closed at every height`);
    // Open the gate the same way the game does, then it must be passable at the gate
    await p.evaluate((id) => { const o = window.belumGameInstance.level.obstacles.find(x => x.id === id); if (o) { o.unlocked = true; o.solid = false; } }, bd.gateId);
    await place(bd.x - 90, bd.gateY);
    await walkRight(1400);
    const cxOpen = await p.evaluate(() => window.belumGameInstance.player.centerX);
    if (cxOpen > bd.x + 30) console.log(`[PASS] ${bd.name} passable when open`);
    else { failures++; console.log(`[FAIL] ${bd.name} still blocked when open (x=${cxOpen | 0})`); }
  }
  await b.close();
  process.exit(failures ? 1 : 0);
})();
```

On commit `b26d42a`, this script crossed every boundary at many heights (exit code 1). Some of those heights are inside the gate's own y range, so check that the gate's collision box lines up with the player's feet as well:
- S1→S2: y = 40–280, 400, 440, 560, 600, 800, 960–1280
- S2→S3: y = 40–200, 360–600, 800–1000, 1120–1280
- S3→S4: y = 40–120, 240–320, 520–600, 800–880, 1080, 1240, 1280

All three gates were passable once open.

---

## Final report from the implementing agent

For each fix, report:
- The files changed.
- The output of `npm run qc`, `npm run test:ai`, `npm run test:level` (flow, gate geometry and route length) and `node tools/needs_check.js`.
- Screenshots: the start of Sector 1 (Fix 4), each new barrier (Fix 1) and the objective list before and after decrypting (Fix 5).
- The route length per sector and in total, from `route_length_check.js`.
- Any check that did not pass, with the reason.
- No claimed play time unless you actually timed a full playthrough.
