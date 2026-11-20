# Belum: Protocol Zero — Act 1 Expansion (Modern Setting)

Task file for the implementing agent. It turns Act 1 from a 1-minute route into a 10–15 minute modern survival-stealth mission. It adds a main menu, a prologue scene, an ending, search-and-salvage containers, modern jungle survival, field cache sites, operator proficiency, and balance changes.

## Before you start

- Finish `AUDIT_FIX_TASKS.md` first. This file builds on its input, checkpoint and settings fixes.
- `PLAYER_ART_ANIMATION_TASKS.md` and `ENEMY_ART_ANIMATION_TASKS.md` can be done before or after this file, but new art here must follow the same sheet rules.
- Run the game with `npm start` (<http://localhost:3000>). Run the QC suite with `npm run qc` after every task.
- Test in a real browser by playing the game, not only by reading the code. Every task ends with checks. Take screenshots and look at them.
- Line numbers refer to commit `ed622fb` on `main`.

## Setting and tone (applies to everything in this file)

**Modern day, November 2026: the Royal Belum and Temenggor rainforest in Perak, Malaysia.** A lone special-operations operator works against a private military company (PMC) guarding a bio-lab. Everything must feel like a modern military survival thriller. Nothing should feel medieval or fantasy.

| Do not use (fantasy or medieval) | Use instead (modern) |
|---|---|
| XP, level up, skill tree, perks | Operator proficiency, training, service record, field experience |
| Quest, quest log | Objective, mission log, secondary objective |
| Loot, chest, treasure | Search, salvage, footlocker, ammo can, cache |
| Key and door | Keycard, RFID badge, keypad code, safe combination, laptop hack |
| Forge, smith, enchant | Workbench, field modification, attachment |
| Fletch bolts, craft arrows | Recover or salvage carbon bolts |
| Stew, cook, potion, elixir | Field ration (MRE), energy gel, medical kit, auto-injector |
| Throwing rocks | Noisemaker (a pebble-filled can, a phone alarm) |
| Campfire, inn, village | Basha site (hammock and tarp), field cache, radio check-in |
| Gold, coins, merchant | None. There is no currency in this act. |
| Quest-giver NPC | Radio handler (GGK Command), a captured VBS scientist |

**Keep:** the parang (a real Malaysian jungle tool), the suppressed 9mm, the modern compound crossbow (with carbon bolts), keycards, drives as intel, floodlights, tripwires and the blast gate.

**Local people:** if a local guide character is ever added (for example an Orang Asli tracker), it must be written respectfully and reviewed by someone from the community. For this act, use a radio voice only.

## Art rules (all new art in this file)

All art matches the existing style: **vintage dip-pen ink etching on cream parchment**, Prussian-blue ink `#111E33`, crimson `#F85A5A` accents only where noted, and no other colour.

| Asset type | Format | Existing example to attach as a style reference |
|---|---|---|
| World prop | 688 × 384 PNG, one prop, centred, in the same high 3/4 view as the existing props, flat cream background | `assets/environment/gate_blast_door.png`, `hollow_log.png` |
| Item icon sheet | 1376 × 768 PNG, a 4 × 2 grid of 8 icons, flat cream background, sliced to 64 × 64 icons in `assets/ui/items/` | `assets/ui/items/survival_items_sheet.png` |
| Scene panel (menu, prologue, ending) | 1920 × 1080 PNG, full illustration, parchment texture allowed at the edges only | the style of `assets/reference/image-1.png` |

**Shared style block** (paste at the start of every prompt below):

> Vintage dip-pen ink etching on cream parchment paper (#F7F3E8). Dense cross-hatching and stipple shading in dark Prussian-blue navy ink (#111E33). The only other colour is a small crimson (#F85A5A) accent where stated. No other colours, no gradients, no photographic texture. Modern-day setting, November 2026, Malaysian rainforest. Contemporary military and scientific equipment only. Nothing medieval or fantasy. Match the attached reference in line weight and shading density.

---

## Task 1 — Main menu

**Goal:** the game opens on a main menu, not straight into the briefing.

**Design:**
- The background is a **scene panel of a field laptop** open on a waterproof case, beside a folded topographic map of Temenggor Lake, a compass and a radio. The menu items are drawn by code as a classified terminal UI over the laptop screen area.
- Menu items:
  - **New Operation**
  - **Continue**: shown only when a valid checkpoint exists (see `AUDIT_FIX_TASKS.md` Fix 4).
  - **Difficulty**: *Recruit*, *Operator* (default) or *Black Op*. See Task 9.
  - **Settings**: audio, screen shake and reduce flashing (from `AUDIT_FIX_TASKS.md` Fix 6), and controls help.
  - **Credits**
- Add a `MENU` mode. The game starts in `MENU`, and nothing in the level updates while in it. **New Operation** goes to the prologue scene (Task 2). **Continue** loads the checkpoint.
- Keyboard navigation (arrow keys, Enter, Esc), mouse and touch must all work. The game has no gamepad support yet, so do not add it here.

**Art prompt — `assets/ui/menu_background.png` (scene panel, 1920 × 1080):**
> [Shared style block] Subject: a close top-down still life on a dark jungle-floor tarp. A rugged military field laptop, open, with its screen left as a clean blank cream rectangle (the game draws the menu there). Around it: a folded topographic map of Temenggor Lake with hand-drawn route marks, a lensatic compass, a handheld tactical radio with an antenna, a suppressed 9mm pistol, a parang in a sheath, and a few raindrops on the tarp. One small crimson accent: a red map pin on the outpost location. Leave the left third calm and uncluttered for the title text.

**Checks:**
1. Opening the page shows the menu. The level and HUD are not visible or running behind it.
2. **Continue** is hidden with no checkpoint and visible with one. It loads the right sector.
3. Every menu item works with the keyboard, mouse and touch.

---

## Task 2 — Prologue scene: night insertion

**Goal:** replace the text-only briefing with a short illustrated scene, 45–60 s and skippable, that ends with the player in control on the riverbank.

**Design:**
- Show **4 panels** in order. Each slowly pans or zooms (Ken Burns style, drawn on the canvas), with rain particles over them, subtitles at the bottom, and the radio handler's lines typed out with the existing teletype sound.
- Hold "Skip" (Esc, or tap and hold) for 1 s to skip.
- After panel 4, fade into gameplay at the Sector 1 spawn.
- Keep the existing dossier text, but move it into the mission log (J) as "Briefing".

| Panel | File | Handler subtitle (edit freely) |
|---|---|---|
| 1 | `assets/scenes/prologue_01_lake.png` | "Kancil, GGK Command. Satellite confirms power at the VBS enclave. You go in alone." |
| 2 | `assets/scenes/prologue_02_drone.png` | "Ironclad has the river corridor locked. Floodlights, patrols, tripwires." |
| 3 | `assets/scenes/prologue_03_boat.png` | "The wildlife is wrong out there. Stay off the ravine floor." |
| 4 | `assets/scenes/prologue_04_landing.png` | "Recover their drives. Find a way through the blast gate. Command out." |

**Art prompts (scene panels, 1920 × 1080):**

`prologue_01_lake.png`:
> [Shared style block] Subject: a wide view of Temenggor Lake at night in heavy rain. A small black inflatable boat with an outboard motor cuts a thin wake across dark water, very small in the frame. Dense rainforest-covered hills rise behind, half-drowned dead tree trunks stick out of the lake, and low clouds hang over the ridges. Rain is drawn as fine diagonal ink strokes. No crimson.

`prologue_02_drone.png`:
> [Shared style block] Subject: a top-down drone or thermal-camera view of a jungle logging outpost at night, drawn as an ink illustration with a thin viewfinder frame and corner brackets. Barracks roofs, a field-lab tent, a diesel generator shed, two floodlight towers casting cones, and three small soldier figures on patrol paths. Small crimson accents: two crimson target brackets around patrolling guards.

`prologue_03_boat.png`:
> [Shared style block] Subject: a close view of Operator Kancil sitting in the inflatable boat at night in the rain. He wears a rounded combat helmet, a plate carrier, gloves and a large tactical rucksack, with a sheathed parang. He checks a suppressed 9mm pistol in his hands. A waterproof radio is clipped to his shoulder. His face is calm and focused, with rain running off the helmet. He must match the attached `kancil_walk_8f.png` character. No crimson.

`prologue_04_landing.png`:
> [Shared style block] Subject: a muddy riverbank at the jungle edge at night. The deflated boat is pulled into tall ferns, and Kancil crouches at the waterline looking toward faint floodlight glow through the trees in the distance. Bamboo, buttress roots and hanging vines surround him. A small crimson accent: a distant red warning light on a fence post.

Attach `assets/sprites/kancil_walk_8f.png` as the character reference for panels 3 and 4.

**Checks:**
1. **New Operation** plays all 4 panels in order with subtitles, then hands control to the player at the spawn.
2. Holding Skip for 1 s jumps straight to gameplay. A single tap does not skip.
3. The rain and the camera moves run smoothly with no console errors.

---

## Task 3 — Ending scene: exfil

**Goal:** replace the instant stats card with a short ending.

- Show **2 panels**, then the existing stats card restyled as a **debrief report** with "Operator proficiency gained" (Task 7) and "Secondary objectives" lines, then "Act 2 — Coming soon".

`assets/scenes/ending_01_exfil.png`:
> [Shared style block] Subject: night, rain. A military utility helicopter hovers low over a jungle clearing just beyond an open concrete blast gate, with its rotor wash flattening the ferns. Kancil runs toward its open side door with the parang on his back, and a crew member reaches out a hand. Searchlight beams cut through the rain. A small crimson accent: the helicopter's red anti-collision light.

`assets/scenes/ending_02_debrief.png`:
> [Shared style block] Subject: a top-down still life of a debrief table: a manila folder stamped "TOP SECRET // GGK", two rugged USB drives, a Tier-1 keycard, photos of the bio-lab clipped to the folder, a radio, and a cup of coffee. Leave a calm area on the right for the debrief text. A small crimson accent: the classified stamp.

**Check:** reaching extraction plays both panels, then the debrief, then returns to the main menu.

---

## Task 4 — Act structure and length

**Goal:** a 10–15 minute act on the **Operator** difficulty, with gated progress, one optional area per sector, and no 1-minute shortcut.

**Required changes:**
1. **Keycard:** remove the floor keycard pickup (`level_act1.js`, `pickup_keycard`). The Tier-1 keycard now comes from **either**:
   - Commander Ward's body (search it), **or**
   - the **lab safe** in the VBS Field Lab tent (Sector 2). Its 4-digit code is in **Drive 01**, which you decrypt at a field cache (Task 6).
2. **Sector gates:**

| Sector | Required objective to open the next sector | Secondary objective (optional) | Side area to add |
|---|---|---|---|
| 1 Riverbank | Reach the outpost fence after finding the **bolt cutters** in a fisherman's abandoned boat locker, then cut the fence | Recover the body camera from a dead VBS courier | A flooded fishing hut with a footlocker |
| 2 Logging Outpost | Recover **Drive 01** from the field lab | Photograph the lab samples (stand at a marked spot, press E, hold 2 s) | The diesel shed's back room, with an ammo can and a medical case |
| 3 Infected Ravine | Restore power to the **pump station** to drain the culvert, which opens the culvert route | Free the captured VBS scientist (gives intel on Sector 4 patrols) | A spore-filled sinkhole with a lab cold-storage unit (needs the filter mask) |
| 4 Blast Gate | Get the keycard (Ward or the lab safe), swipe the terminal and hold for 15 s | Plant a GPS tracker on Ward's radio truck | A guard tower with the radio jammer parts |

3. **Data files:** write the room graph and beat list as data next to the level (`src/world/act1_flow.js`), as the `level-design` skill describes. Add a check (`tools/act1_flow_check.js`) that proves the extraction is reachable with gates in order and that no required item sits behind its own gate.
4. Add **one more threat type** in Sector 3 or 4: a **PMC surveillance drone** that patrols a loop, has a downward vision cone and calls nearby guards. Use code-drawn art (a small ink quadcopter shape) or one 688 × 384 prop.

**Checks:**
1. `node tools/act1_flow_check.js` passes. Removing the bolt cutters or the safe code makes it fail.
2. A careful first playthrough on Operator takes 10–15 minutes. Report your own run time and the time per sector.
3. The old route (grab the keycard from the floor, run to the gate) no longer works.

---

## Task 5 — Search and salvage (replaces floor pickups)

**Goal:** items are found by searching modern containers and bodies, not picked up from glowing floor badges.

**Required changes:**
1. Remove the floating name labels and red highlight badges from loose items. Only **environmental** sources stay in the world: rain-catch puddles (water) and wild bamboo shoots (food). They show a small ink sparkle only when the player is within 120 px.
2. Add **containers** as world props with a search action: hold **E** to search, which makes a small noise ring. Each type has a loot table in `src/world/loot_tables.js`:

| Container | Search time | Noise radius | Possible contents |
|---|---|---|---|
| PMC footlocker | 1.5 s | 80 px | 9mm magazine, field ration, bandage, intel note |
| Ammo can | 1.0 s | 100 px | 9mm magazine, carbon bolts ×2 |
| Medical case | 1.2 s | 60 px | bandage, tourniquet, auto-injector |
| Lab cold-storage unit | 2.0 s | 60 px | spore auto-injector, filter cartridge, sample vial (intel) |
| Field laptop | 3.0 s (hack) | 40 px | safe code, patrol routes, drone frequency |
| Guard body | 1.0 s | 40 px | 9mm magazine (50%), field ration (30%), radio codes (commander: keycard) |

3. A container can be searched once. Show its open or empty state with the open-art variant.
4. Searching can be interrupted. Moving or being spotted cancels the search, and the progress is lost.
5. Store the search state in the checkpoint as world state (see `AUDIT_FIX_TASKS.md` Fix 4).

**Art prompts — world props (688 × 384 each, attach `gate_blast_door.png` as the style reference):**

| File | Prompt subject (after the shared style block) |
|---|---|
| `assets/environment/footlocker_closed.png` | A rugged olive-drab military footlocker with steel corners, latches and stencilled lettering "ITS", sitting on jungle ground. Closed. |
| `assets/environment/footlocker_open.png` | The same footlocker with the lid open and the inside empty, with a crumpled cloth inside. |
| `assets/environment/ammo_can_closed.png` | Two stacked steel ammunition cans with carry handles and stencilled markings. Closed. |
| `assets/environment/ammo_can_open.png` | The same cans, with the top one open and empty. |
| `assets/environment/medical_case.png` | A hard-shell medical case with a cross symbol (crimson cross only) on a wooden pallet, with the lid closed. Make an `_open` variant with the lid up and the case empty. |
| `assets/environment/lab_cold_storage.png` | A portable lab cold-storage unit with a small display panel and biohazard markings, on a field-lab table, with frost on the edges. Make an `_open` variant with the door open and the racks empty. |
| `assets/environment/field_laptop_crate.png` | A rugged military laptop open on a wooden supply crate, with a satellite antenna and cables trailing to a small generator. |
| `assets/environment/fishing_boat_locker.png` | A small abandoned wooden fishing boat pulled up on the bank, with a metal locker box under the seat. |

**Art prompt — item icons sheet, `assets/ui/items/salvage_items_sheet.png` (1376 × 768, 4 × 2), attach `survival_items_sheet.png` as the style reference:**
> [Shared style block] Eight separate item icons on flat cream, one per cell, centred, each drawn large and clear: (1) a curved 9mm pistol magazine; (2) two carbon crossbow bolts with modern plastic vanes; (3) a military field ration pouch (MRE) with a tear notch; (4) a rolled pressure bandage; (5) a combat tourniquet with a windlass rod; (6) a spring auto-injector pen with a crimson cap; (7) a half-face respirator filter mask; (8) a small noisemaker made from an empty drink can with pebbles inside and a wire loop.

**Checks:**
1. No loose item shows a floating label or badge from across the screen.
2. Searching each container type gives items from its table, takes the stated time, and makes the stated noise ring.
3. Moving during a search cancels it. A searched container shows its open or empty art and cannot be searched again, including after a checkpoint retry.

---

## Task 6 — Modern jungle survival and field caches

**Goal:** survival pressure that fits a modern jungle operation. It warns before it hurts, and it never kills instantly.

### 6a. Needs (attrition with warnings)

| Need | Full to warning (walking, Operator) | Full to empty | At empty | Restored by |
|---|---|---|---|---|
| **Hydration** | 6 min (sprinting drains it 2× faster) | 8 min | Stamina regen −50%, then 1 HP lost every 20 s | Purified water (+60%), canteen refill at a rain-catch with purification tablets |
| **Energy** | 9 min | 12 min | Max stamina −40% | Field ration (+50%), energy gel (+25%), bamboo shoots (+15%) |

Show both as small ink gauges next to stamina. They pulse at 25%.

### 6b. Injuries

| Condition | Cause | Effect | Treatment |
|---|---|---|---|
| **Bleeding** | Any bullet hit (chance 60%) or boar tusk hit (100%) | 1 HP lost every 6 s, plus a drip trail that guards can follow | Bandage (stops it). Tourniquet (stops it instantly, but −20% move speed until a field cache). |
| **Spore exposure** | Time in spore zones (Sector 3) | A meter fills. At full: blurred vision and 1 HP lost every 4 s | Filter mask (blocks it while worn, with a 90 s cartridge). Spore auto-injector (clears it). |
| **Leeches** | Wading in deep water or mud for more than 4 s | −10% max stamina each, stacking up to 3 | Remove them at a field cache (takes 3 s). |

### 6c. Field caches (replace the "Go Home" menu anywhere)

1. Pressing **B** anywhere no longer opens camp.
2. Place **one hidden basha site per sector**. Each is unlocked when the player first finds it, and some sit in the side areas.
3. At a basha site, hold E to use it. It is only usable when no guard is `ALERT`. It offers:
   - **Rest**: restores stamina, removes leeches, and tops up 2 HP once per visit. It is also the **checkpoint save**.
   - **Purify**: dirty water plus a purification tablet makes purified water.
   - **Field workbench**: attach found mods and make field improvisations (6d).
   - **Radio**: decrypt drives (intel and codes) and get handler hints for the next objective.
4. Remove "COOK STEW", "FLETCH +3 BOLTS" and "PRESS 9mm ROUNDS" from the game.

### 6d. Field improvisation (atomic, as in the `steve-game-survival-crafting` skill, Pattern 1)

Define recipes as data in `src/world/recipes.js`. Show a recipe once the player has picked up one of its ingredients.

| Output | Inputs | Use |
|---|---|---|
| Noisemaker can (replaces decoy rocks) | Empty can + pebbles | Throw to lure guards or boars |
| Tripwire flare | Scrap wire + flare | Place on a path. It alerts you, blinds guards for 3 s and provokes boars. |
| Diesel smoke rag | Rag + diesel (from the generator shed) | Throw for a 6 s smoke screen that blocks vision cones |
| Radio jammer | Radio parts ×2 + battery | Placed, it stops guards calling allies for 20 s |

### Art prompts

`assets/environment/basha_site.png` (world prop, 688 × 384):
> [Shared style block] Subject: a hidden jungle basha site: a camouflaged hammock with a mosquito net strung between two trees under a sloped tarp shelter, a small folding hexamine stove, a canteen, a rucksack leaning against a tree, a waterproof radio on a log, and a small workbench made from a plank on two ammo cans. Tucked among ferns and buttress roots. No campfire flames. A small crimson accent: the radio's power LED.

`assets/ui/items/field_survival_sheet.png` (icon sheet, 1376 × 768, 4 × 2):
> [Shared style block] Eight separate item icons on flat cream: (1) a strip of water purification tablets in foil; (2) a military canteen with a cup; (3) an energy gel sachet; (4) a hexamine fuel tablet pack; (5) a road-flare with a crimson cap; (6) a coil of scrap wire with an empty drink can; (7) a diesel-stained rag in a plastic bag; (8) a small battery pack and radio circuit board.

`assets/ui/status_icons_sheet.png` (icon sheet, 1376 × 768, 4 × 2):
> [Shared style block] Eight small status icons on flat cream, simple and readable at 32 px: (1) a water droplet (hydration); (2) a ration pouch (energy); (3) a blood drop in crimson (bleeding); (4) a tourniquet (restricted); (5) a spore cloud with a respirator outline (spore exposure); (6) a leech; (7) a heart with a plus sign (healing); (8) a tent-like tarp shelter (field cache found).

**Checks:**
1. A simulated test (`tools/needs_check.js`) prints the minutes from full to warning to empty for hydration and energy, at walking and at sprinting. The numbers match the table above within 10%.
2. Bleeding drips, the trail can be followed by a guard, and a bandage stops it.
3. The filter mask blocks spore exposure until its cartridge runs out.
4. Basha sites work only when no guard is alerted, and they save the checkpoint.
5. Each recipe consumes its inputs and gives its output in one step. With a missing input, nothing changes.

---

## Task 7 — Operator proficiency (replaces any XP or level idea)

**Goal:** the player improves by **doing**, shown as a service record, not as levels.

| Proficiency | Raised by | Rank 1 (5 actions) | Rank 2 (12 actions) |
|---|---|---|---|
| Close Quarters | Stealth takedowns | Takedown 0.6 s → 0.45 s | Silent body drag |
| Fieldcraft | Sections crossed unseen, searches done without alerting anyone | Footsteps 15% quieter | Searches 25% faster |
| Marksmanship | Headshot-zone hits with the pistol or crossbow | Sway reduced | Bolts recovered automatically when within 60 px |
| Field Medic | Treatments used | Bandage 2 s → 1.2 s | +1 max HP |

- When a rank goes up, show a short toast: "Fieldcraft — Rank 1: footsteps quieter."
- Show the full record in the mission log (J) under **Service Record**.
- Save the proficiency data in the checkpoint.

**Check:** do each action the stated number of times. The rank goes up, the effect works, and the effect survives a checkpoint retry.

---

## Task 8 — Attachments (replaces crafting ammo)

- Add a **field workbench** at basha sites, with **attachments found by searching**: a suppressor upgrade (pistol noise −40%), a red-dot sight (crossbow aim cone −30%), an extended magazine (9mm 8 → 12) and a night-vision monocular (shows guard outlines through foliage within 200 px for 10 s, with a 60 s battery).
- Each attachment appears once in the act, in a side area or a secondary objective reward.

**Art prompt — `assets/ui/items/attachments_sheet.png` (icon sheet, 1376 × 768, 4 × 2):**
> [Shared style block] Eight separate item icons on flat cream: (1) a pistol suppressor tube; (2) a compact red-dot sight with a crimson dot; (3) an extended 9mm magazine; (4) a night-vision monocular with a head mount; (5) a GPS tracker puck with an antenna; (6) a body camera with a clip; (7) heavy bolt cutters; (8) a small digital camera for photographing evidence.

**Check:** fitting each attachment changes only its stated value. Each appears exactly once in the act.

---

## Task 9 — Balance and difficulty

Exact new values (Operator difficulty):

| Item | Now | New | Why |
|---|---|---|---|
| Suppressed 9mm damage | 70 (kills a 60 HP rifleman in one shot) | **55** (2 shots, or 1 headshot-zone hit) | It is the strongest option today, by far |
| 9mm noise radius | 120 px | **220 px** | "Suppressed" is not silent |
| 9mm starting rounds | 8, plus 4 for each scrap wire | **8**, plus magazines found only by searching | Stop making ammo from wire |
| Crossbow damage | 55 | **60** (kills a rifleman in one shot from stealth range) | Gives the silent weapon a clear role |
| Takedown rear arc | Behind the guard's facing by more than 99°, a 162° rear cone (`mercenary.js`, `isBehindMe`, `diff > Math.PI * 0.55`) | **120° rear cone** (`diff > Math.PI * 0.667`) | Too forgiving |
| Takedown | Instant | **Hold E for 0.6 s.** Releasing early fails, and the guard turns. | Adds tension |
| Concealment in ferns | Seen only within 24 px | **24 px while still, 48 px while moving** | Hiding is almost perfect today |
| Field ration heal | +6 HP (stew) | **+2 HP** plus energy. Medical kit: **+4 HP**. | Healing was too generous |

Difficulty settings:

| Setting | Recruit | Operator | Black Op |
|---|---|---|---|
| Player max HP | 14 | 11 | 9 |
| Guard bullet damage | ×0.7 | ×1.0 | ×1.25 |
| Suspicion fill time | ×1.4 | ×1.0 | ×0.75 |
| Needs drain | ×0.6 | ×1.0 | ×1.3 |
| Containers with medical items | +1 per sector | as listed | −1 per sector |

**Check:** run the `steve-donchitos-game-studios-balance-check` skill on the new numbers. Report the time to kill each enemy with each weapon on each difficulty, and confirm that no single weapon wins on both damage and ammo.

---

## Task 10 — Rename old-fashioned text

| Now (where) | New |
|---|---|
| "Jungle Stew Ration", "COOK STEW" (`index.html:284-286`, toasts in `main.js`) | "Field Ration (MRE)". Remove cooking. Boar meat is grilled at a basha site with the hexamine stove: "Grilled boar strips". |
| "Fletch silent Crossbow Bolts", "FLETCH +3 BOLTS" (`index.html:292-295`, `main.js:719`) | Remove. Toast: "OUT OF BOLTS — RECOVER OR SALVAGE CARBON BOLTS". |
| "Decoy Rocks", "ROCK" (`index.html:181`, `main.js:763`, `:898`) | "Noisemaker", "NOISE" |
| "Pressed +4 Improvised 9mm" (`camp.js`) | Remove |
| "Go Home" button and `go_home_cabin.png` | "Field Cache" with a tarp-shelter icon (from `status_icons_sheet.png`, icon 8) |
| "quest" in the UI (`quest_scroll.png`, element ids, CSS) | "Mission log" or "Objectives". Rename the visible text. Internal ids can stay. |
| "HARVESTED BOAR MEAT — COOK JUNGLE STEW AT CAMP [B]" | "BOAR MEAT TAKEN — GRILL AT A FIELD CACHE" |

**Check:** search the game for `stew`, `fletch`, `rock`, `quest`, `loot` and `go home`. No player-facing text uses them.

---

## Art quality gate (all assets in this file)

Reject an image and generate it again if any of these fail:
- It shows anything medieval or fantasy: swords other than the parang, bows instead of the compound crossbow, torches, campfires, wooden chests, potions, coins, castles, robes or armour plates that are not modern.
- It uses colours other than ink navy, cream and the stated crimson accent.
- The size or grid does not match the format table.
- Kancil (in scene panels) does not match the walk-sheet character: rounded helmet, plate carrier, rucksack, parang.
- An icon is not readable when scaled to 32 px.
- A prop's camera angle differs from the existing props.

## Final report from the implementing agent

For each task, report:
- The files changed.
- Screenshots for each check.
- Your playthrough time per sector.
- The output of `npm run qc` and of each new check script.
- Any check that did not pass, with the reason.
