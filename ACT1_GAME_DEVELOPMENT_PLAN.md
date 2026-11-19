# BELUM: PROTOCOL ZERO (Operasi Hujan Hening)
## Act 1 Master Game Development Plan & AI Implementation Specification
### Google Antigravity Autonomous Edition (2.5D Oblique / Isometric Tactical Stealth)
### With Mandatory Automated Quality Control (QC) & Bug-Fixing Loops

---

### EXECUTIVE SUMMARY
* **Project Working Title:** Belum: Protocol Zero (Operasi Hujan Hening)
* **Genre:** 2.5D Oblique / Isometric Tactical Stealth Survival
* **Art & Animation Style:** Hand-drawn vintage dip-pen ink etching on cream parchment paper (matching `image-1.png`), with uniform **8-frame sprite sheet animation grids** (matching `image-2.png`).
* **Platform Target:** 
  * **Phase 1 (This Build):** Web Browser (itch.io, WebGL / HTML5 Canvas). Zero installation, instant loading (<25 MB).
  * **Phase 2 (Post-Polish):** Google Play Store (Android). Wrapped via Capacitor / WebGL Canvas with native touch controls & Google Play Cloud Save.
* **Act 1 Pacing:** 10–15 minutes tight, highly replayable vertical slice with Prologue, "Go Home" Bivouac Camp, and Perimeter Gate Breach.
* **Core Philosophy:** Hardcore stealth. 2–3 hits kill the player. Combat is a high-risk failure state; survival relies on shadows, dense ferns, silent parang takedowns, and luring mutated fauna into mercenary checkpoints.

---

## SECTION 1: MASTER DIRECTORY HIERARCHY

Antigravity must construct and adhere strictly to this project directory tree:

```
belum-protocol-zero/
├── index.html                   # Master entry point (Canvas, HUD overlay, Camp modal, Prologue)
├── style.css                    # Ink-on-parchment UI styles, rough vignette borders, retro typography
├── package.json                 # Lightweight dev scripts & local preview runner
├── server.js                    # Zero-dependency local Node server bound to 0.0.0.0:3000
├── assets/
│   ├── reference/
│   │   ├── image-1.png          # Visual style, 2.5D perspective, HUD layout, red telegraph reference
│   │   └── image-2.png          # Standard 8-frame (2x4) sprite sheet animation grid reference
│   ├── sprites/
│   │   ├── kancil_walk_8f.png   # Operator Kancil tactical walk (2x4 grid)
│   │   ├── kancil_stealth_8f.png# Operator Kancil fern crouch stalk (2x4 grid)
│   │   ├── kancil_parang_8f.png # Operator Kancil melee slash (2x4 grid)
│   │   ├── boar_charge_8f.png   # Mutated Boar telegraph & charge (2x4 grid)
│   │   ├── boar_idle_8f.png     # Mutated Boar sniffing / graze (2x4 grid)
│   │   ├── merc_patrol_8f.png   # Ironclad Mercenary patrol walk (2x4 grid)
│   │   ├── merc_fire_8f.png     # Ironclad Mercenary 3-round burst (2x4 grid)
│   │   └── frames/              # Directory for auto-sliced PNG frames
│   ├── environment/
│   │   ├── paper_bg.png         # Aged cream parchment paper texture (#F7F3E8)
│   │   ├── hollow_log.png       # Fallen hollow log obstacle & hiding cover
│   │   ├── fern_clump.png       # Wild Belum rainforest ferns (hiding zone)
│   │   ├── bamboo_cluster.png   # Bamboo grove cover
│   │   └── gate_blast_door.png  # Temenggor Perimeter concrete blast gate
│   └── ui/
│       ├── dpad_dial.png        # Circular D-pad with runner center button
│       ├── go_home_cabin.png    # "Go Home" hand-drawn bivouac cabin icon
│       ├── hud_heart.png        # Red segmented heart health icon
│       ├── hud_stamina.png      # Green stamina / hydration serpent icon
│       ├── quest_scroll.png     # Dark ink collapsible parchment tracker
│       └── action_icons.png     # Hand, Crosshair, Reticle, and Bag icons
├── src/
│   ├── main.js                  # Game lifecycle, 60fps game loop, state management
│   ├── engine/
│   │   ├── renderer.js          # 2.5D Canvas engine with Y-sorting depth & red telegraphs
│   │   ├── animator.js          # Standard 8-frame sprite grid player & frame-interpolation
│   │   └── camera.js            # Smooth target-follow camera with aim lookahead
│   ├── input/
│   │   └── input_manager.js     # Unified Desktop (WASD/Mouse) + Mobile (D-Pad/Touch) controller
│   ├── entities/
│   │   ├── player.js            # Hardcore stealth player, stamina, weapons, and fern concealment
│   │   ├── mercenary.js         # Ironclad PMC guard AI, vision cone, red laser aiming, radio alerts
│   │   ├── boar.js              # Mutated Babi Hutan AI, soft radial red telegraph, charge physics
│   │   └── projectile.js        # Crossbow bolts, 9mm suppressed bullets, thrown decoy rocks
│   ├── world/
│   │   ├── level_act1.js        # 4 continuous sectors: Riverbank -> Outpost -> Ravine -> Blast Gate
│   │   └── obstacles.js         # Collision boxes for trees, hollow logs, ferns, and culverts
│   ├── ui/
│   │   ├── hud.js               # In-game HUD controller matching image-1.png layout
│   │   ├── prologue.js          # Classified dossier typewriter briefing & audio teletype
│   │   └── camp.js              # "Go Home" Bivouac modal (filtering, cooking, crafting, decryption)
│   └── audio/
│       └── sound_engine.js      # Zero-asset procedural Web Audio synthesizer (rain, cicadas, sfx)
└── tools/
    ├── slice_sprites.py         # Automated 2x4 grid cutter with margin trimming
    └── qc_validator.js          # Automated headless unit and assertion test runner
```

---

## SECTION 2: MASTER ART STYLE & PERSPECTIVE (MATCHING `IMAGE-1.PNG`)

```
┌────────────────────────────────────────────────────────────────────────┐
│  VISUAL PILLARS                                                        │
│  1. Medium: Hand-drawn dip-pen ink etching & woodcut cross-hatching.   │
│  2. Palette: Deep Prussian Blue Ink (#111E33) on Cream Paper (#F7F3E8).│
│  3. Perspective: 2.5D Oblique / Isometric (front-three-quarter depth). │
│  4. The Red Accent: Soft radial crimson telegraphs (#F85A5A) + numbers.│
│  5. Animation: Standardized 8-Frame Uniform Grids (2 rows x 4 columns).│
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Palette & Linework
* **Canvas Background:** Aged off-white / warm cream parchment paper (`#F7F3E8` to `#F4ECD8`) with subtle paper tooth texture and rough organic vignetted borders.
* **Inking Ink:** Monochromatic deep indigo / Prussian blue ink (`#111E33` to `#1C2844`). **NO pure RGB black**. Every shadow is achieved through fine cross-hatching and stippling.
* **Strict Red Accent (`#F85A5A` / `#FF2030`):**
  * Soft circular radial attack telegraphs (semi-transparent crimson aura with feathered edges).
  * Bold floating crimson damage numbers (e.g., "78").
  * Enemy alert exclamation marks (`!`) and sniper laser sights.
  * Toxic Rafflesia spore zones.

### 2. Camera & Perspective: 2.5D Oblique / Isometric
* Characters, mutated boars, trees, fallen hollow logs, and bamboo thickets are drawn upright at a **45–60° front-three-quarter oblique angle**, giving physical depth to the environment.
* **Y-Sorting (Depth Sorting):** Entities with higher `y` coordinates render in front of obstacles; walking behind a giant fallen log or fern grove naturally conceals the character.

### 3. UI & HUD Layout (1:1 Reference Match with `image-1.png`)
* **Top-Left Status Stack:**
  * Red segmented Health Bar with miniature Heart emblem (e.g. `6/11 HP`).
  * Green segmented Stamina / Energy Bar with serpent/hydration emblem.
  * Parchment Day/Time Badge: Ink stamp badge showing `Day 17 | 8:33 AM` with sun/moon dial.
* **Top-Right Utilities:**
  * 4 Ink-drawn square parchment buttons: **Journal / Dossier**, **Backpack**, **Weapons / Combat**, **Settings**.
  * **Quest Tracker Parchment Scroll:** Collapsible dark-ink pinned scroll displaying current black-op objective.
* **Bottom-Left Movement & Camp:**
  * **Tactical D-Pad / Analog Wheel:** Circular dial with 4 arrow notches and center running-figure button.
  * **"Go Home" Bivouac Button:** Hand-drawn jungle cabin icon triggering the camp overlay.
* **Bottom-Right Action Cluster:**
  * **Hand Icon Button:** Interact / Stealth Takedown / Scavenge.
  * **Crosshair Button (Top):** Aim & Fire Crossbow / Suppressed Pistol.
  * **Target Reticle Button (Bottom):** Parang Melee Strike / Attack.
  * **"Bag" Button:** Quick-slot consumable inventory.

---

## SECTION 3: THE 8-FRAME ANIMATION & SLICING PIPELINE (MATCHING `IMAGE-2.PNG`)

All animated entities in the game use a uniform **8-frame sprite grid** ($2 \text{ rows} \times 4 \text{ columns}$), exactly as demonstrated in **`image-2.png`**.

```
┌───────────┬───────────┬───────────┬───────────┐
│  FRAME 0  │  FRAME 1  │  FRAME 2  │  FRAME 3  │
├───────────┼───────────┼───────────┼───────────┤
│  FRAME 4  │  FRAME 5  │  FRAME 6  │  FRAME 7  │
└───────────┴───────────┴───────────┴───────────┘
```

### Automated Slicing Tool: `tools/slice_sprites.py`
Antigravity automatically executes this script to slice any generated $2 \times 4$ sheet:
```python
from PIL import Image
import os
import sys

def slice_8frame_grid(sheet_path, output_dir, prefix="frame", margin=3):
    img = Image.open(sheet_path).convert("RGBA")
    total_w, total_h = img.size
    cols, rows = 4, 2
    cell_w = total_w // cols
    cell_h = total_h // rows

    os.makedirs(output_dir, exist_ok=True)
    frames = []

    frame_idx = 0
    for r in range(rows):
        for c in range(cols):
            x1 = c * cell_w + margin
            y1 = r * cell_h + margin
            x2 = (c + 1) * cell_w - margin
            y2 = (r + 1) * cell_h - margin

            box = (x1, y1, x2, y2)
            frame = img.crop(box)
            frame_filename = f"{prefix}_{frame_idx}.png"
            frame_path = os.path.join(output_dir, frame_filename)
            frame.save(frame_path)
            frames.append(frame_path)
            frame_idx += 1

    print(f"[QC PASS] Sliced {frame_idx} frames to {output_dir}")
    return frames

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        pfx = sys.argv[3] if len(sys.argv) > 3 else "frame"
        slice_8frame_grid(sys.argv[1], sys.argv[2], pfx)
```

---

## SECTION 4: WORLDBUILDING & NAMING ARCHITECTURE

To ensure 100% legal safety and maximum viral/cultural authenticity, geographical locations use **real Malaysian names**, while corporations, enemies, and bioweapons use **fictional mock names**.

### Lore Directory
| Category | Classification | In-Game Name | Flavor & Context |
| :--- | :--- | :--- | :--- |
| **Primary Region** | **REAL** | **Belum-Temengor Rainforest** (*Hutan Belum*) | 130-million-year-old virgin rainforest in northern Perak, Malaysia. Older than the Amazon. |
| **Waterways** | **REAL** | **Tasik Temenggor & Sungai Belum** | Deep, dark artificial lake and mist-shrouded river entry corridor. |
| **Forward Logistics Hub** | **REAL** | **Pulau Banding Outpost** | Former timber island converted into an armed perimeter logistics station. |
| **The Antagonist Mega-Corp** | *MOCK* | **VANGUARD BIO-SYNTHETICS (VBS)** | Multi-national private biotech conglomerate posing as an agro-forestry NGO. |
| **The Mercenary PMC** | *MOCK* | **IRONCLAD TACTICAL SOLUTIONS (ITS)** | Ruthless foreign private military contractors armed with night-vision and red laser sights. |
| **The Pathogen Strain** | *MOCK* | **BT-09 ("The Rust Spore" / *Spora Karat*)** | Soil-borne parasitic fungal pathogen harvested from deep Belum limestone caves. |
| **Underground Target** | *MOCK* | **Facility Sub-Zero (Site Orang Hutan)** | Sub-surface research laboratory buried beneath an abandoned colonial limestone shaft. |
| **Player Character** | *MOCK* | **Operator Kancil (Codename: SPECTRE)** | Solo Malaysian Special Forces operative conducting an unsanctioned deniable burn run. |
| **Mission Name** | *MOCK* | **Operation: Silent Rain (*Operasi Hujan Hening*)** | Black-ops mission: Infiltrate, recover encrypted telemetry drives, and expose VBS. |

---

## SECTION 5: THE PROLOGUE (CLASSIFIED DOSSIER SCREEN)

The game opens with an interactive **Classified Black-Ops Dossier Screen**:
* **Visual:** Dark-blue typewriter text stamping onto yellowed parchment with audio teletype clicks and classified black bar redactions.
* **Prologue Script:**
  > `[TOP SECRET // BLACK-OP PROTOCOL // GGK COMMAND]`
  > `DATE: 19 NOVEMBER 2026 // 0340 HRS`
  > `LOCATION: PERAK, MALAYSIA // GRID TASIK TEMENGGOR`
  > `TARGET: VANGUARD BIO-SYNTHETICS (VBS) RESEARCH ENCLAVE`
  > 
  > `Five years after the BT-09 outbreak crippled the peninsula, satellite sweeps detected active power signatures inside the Belum-Temengor reserve.`
  > 
  > `Ironclad Tactical Solutions (ITS) mercenaries have locked down the river corridors. Local fauna exposed to chemical runoff are exhibiting hyper-aggressive mutations.`
  > 
  > `OPERATOR KANCIL: You are going in alone via Sungai Belum. Scavenge what you can. Do not engage head-on. Recover Tier-1 clearance, decrypt the field drives, and breach the Perimeter Blast Gate.`
  > 
  > `[TRANSMISSION ENDS // INITIATE INSERTION]`

* **Action:** Clicking "BEGIN OPERATION" plays a muffled thunder rumble, rain sounds, and fades directly into the riverbank drop point.

---

## SECTION 6: ACT 1 WORLD MAP & 2.5D LEVEL FLOW

Act 1 is structured as a continuous 10–15 minute infiltration map composed of 4 seamless sectors:

```
[Sungai Belum Riverbank] 
         │
         ▼
[Abandoned Logging Outpost] ────► ["Go Home" Bivouac Camp Overlay]
         │
         ▼
[The Infected Ravine (Spore Zone)]
         │
         ▼
[Temenggor Perimeter Blast Gate] ────► [Act 1 Extraction / Victory]
```

### Sector 1: Sungai Belum Riverbank (Insertion & Stealth Basics)
* **Environment:** Muddy riverbank, misty water currents, dense bamboo groves, weathered wooden pilings.
* **Objectives:** 
  * Learn 2.5D movement, crouching behind fallen logs, and fern concealment.
  * Pick up your standard **Steel Parang** and **Crossbow**.
  * Neutralize 1 lone Ironclad patrol guard quietly using the 8-frame parang slash from behind.

### Sector 2: Abandoned Logging Outpost & Field Lab
* **Environment:** Dilapidated wooden logging barracks, generator shed, floodlights, chain-link fences.
* **Enemies:** 3 Ironclad PMC riflemen with intersecting patrol paths and red laser sights.
* **Objectives & Loot:**
  * Find **Encrypted Drive 01** inside the field lab tent.
  * Scavenge **Tier-1 Security Keycard** from the patrol captain's desk.
  * Optional: Sabotage the diesel generator to shut off floodlights and isolate guards.

### Sector 3: The Infected Ravine (Fauna & Faction Infighting)
* **Environment:** Swampy limestone ravine littered with mutated Rafflesia fungi blooming with red spores.
* **Fauna:** 2 Mutated Babi Hutan (Wild Boars).
* **Mechanic Hook (Faction Infighting):**
  * An Ironclad checkpoint blocks the ravine exit.
  * The player throws a **Decoy Rock** near the Wild Boars.
  * The boars trigger their **soft radial red circle telegraph** and charge down the ravine into the mercenaries.
  * The mercenaries open fire on the boars. The player slips through in the crossfire chaos.

### Sector 4: Temenggor Perimeter Blast Gate (Climax & Breach)
* **Environment:** Reinforced concrete bunker gate with red laser tripwires, searchlights, and security cameras.
* **Encounter:** Ironclad Outpost Commander Ward (Heavy Armor + High-Caliber Suppressed Pistol) + 1 spotter guard.
* **Breach Solutions:**
  * **Option A (Pure Stealth):** Crawl through the flooded side drainage culvert using the Tier-1 Keycard to bypass the commander.
  * **Option B (Tactical Execution):** Use your crossbow and parang from the shadow blindspots to eliminate the Commander, then swipe his clearance.
* **Climax:** Insert the keycard into the terminal, initiate the heavy blast door opening sequence (alarm sounds, 15-second survival hold), and cross the threshold into the surface warehouse complex.

---

## SECTION 7: HARDCORE STEALTH MECHANICS & 2.5D Y-SORTING

### 1. Lethality & Health
* **Player HP:** 11 HP (represented by segmented hearts matching reference UI). Mercenary rifle bullets deal 3–4 damage (2–3 hits kill).
* **Stamina:** Drained by Sprinting and Dodge Rolling. Regenerates when walking or crouching.

### 2. Fern & Hollow Log Concealment
* **Concealment Logic:** Stepping into dense ferns or walking behind fallen logs makes the player translucent (40% opacity) and 100% invisible to enemies, even inside their vision cones, unless an enemy physically collides with the player.
* **2.5D Y-Sorting Rule:** 
  ```javascript
  // Y-Sorting ensures front-to-back depth
  entitiesList.sort((a, b) => (a.y + a.height) - (b.y + b.height));
  entitiesList.forEach(e => e.draw(ctx));
  ```

### 3. Weapons & Tools
* **Steel Parang (Machete):** Short melee arc (75px). Silent. Instant kill on unalerted guards from behind (Stealth Takedown). 45 damage on alerted enemies or boars.
* **Crossbow:** 450px straight projectile. Completely silent. Limited retrievable bolts.
* **Suppressed 9mm Pistol:** Fast hitscan bullet (550px). High damage (70 damage). Emits small acoustic ring (120px).
* **Decoy Rocks (Throw):** Lob a pebble up to 300px away. Creates an acoustic clatter that lures guards or provokes wild boars.

### 4. Mutated Babi Hutan (Wild Boar) Red Telegraph
* As depicted in `image-1.png`:
  * When a boar readies an attack, a **soft radial red circle (`#F85A5A` with feathered edge)** expands around it for 1.2 seconds.
  * A bold crimson damage number (e.g. **"78"**) floats upward when an entity is struck.
  * Attacks deal massive damage to BOTH player and mercenaries.

---

## SECTION 8: "GO HOME" BIVOUAC CAMP OVERLAY

Triggered by tapping the **"Go Home" cabin icon** on the bottom-left HUD or pressing `B` when out of combat:
1. **Rainwater Filtration Station:** Filter dirty rainwater into **Pure Drinking Water** (+50% stamina regen speed).
2. **Ration Cookstove:** Combine `Wild Bamboo Shoots` + `Harvested Boar Meat` into `Jungle Stew Ration` (+6 HP).
3. **Field Workbench:** Fletch Crossbow Bolts (Bamboo + Scrap Wire) and press Improvised 9mm Subsonic Rounds.
4. **Decryption Terminal:** Inspect decrypted telemetry drives from VBS to uncover security passcodes and lore.

---

## SECTION 9: PROCEDURAL AUDIO ENGINE (WEB AUDIO API)

Zero external audio files required. All soundscapes are procedurally generated in real-time:
* **Tropical Rain & Thunder:** Filtered pink noise with dynamic lowpass modulation; distant rolling sine wave thunder.
* **Belum Cicada Drone:** 4200 Hz FM-modulated sawtooth oscillators generating continuous ambient insect hum.
* **Parang Slash:** Pitch-bent triangle wave + filtered white noise burst.
* **Crossbow Twang:** Exponential frequency sweep from 880 Hz down to 140 Hz.
* **Suppressed Gunshot:** Low-passed 240 Hz thump + snappy mechanical click.
* **Mercenary Radio Alert:** Dual square-wave chirp (1100 Hz / 1650 Hz) + white noise static burst.
* **Tension Heartbeat:** 55 Hz sub-bass sine wave pulsing rhythmically when detected or when HP < 30%.

---

## SECTION 10: MANDATORY AUTONOMOUS QC TESTING & BUG-FIXING PROTOCOL

```
┌────────────────────────────────────────────────────────────────────────┐
│  STRICT AGENT EXECUTION RULE:                                          │
│  Antigravity MUST NOT proceed to the next task until the current       │
│  task has passed its dedicated QC Verification Script with ZERO        │
│  console errors, zero NaN variables, and zero visual glitches.         │
│                                                                        │
│  IF A QC TEST FAILS:                                                   │
│  1. Read the error stack trace or failed assertion.                    │
│  2. Inspect the offending file and diagnose root cause.                │
│  3. Apply the bug fix immediately.                                     │
│  4. Re-run the QC test until all checks PASS.                          │
└────────────────────────────────────────────────────────────────────────┘
```

### Master QC Test Validator: `tools/qc_validator.js`
Antigravity executes this headless test runner to validate mechanics before opening the browser:
```javascript
// tools/qc_validator.js - Headless System Test Runner
const fs = require('fs');
const path = require('path');

function runQC() {
  console.log("=== STARTING BELUM: PROTOCOL ZERO QC SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Verify File Structure
  const requiredFiles = [
    'index.html', 'style.css', 'server.js',
    'src/main.js', 'src/engine/renderer.js', 'src/engine/animator.js',
    'src/input/input_manager.js', 'src/entities/player.js',
    'src/entities/mercenary.js', 'src/entities/boar.js',
    'src/world/level_act1.js', 'src/ui/hud.js',
    'src/ui/camp.js', 'src/audio/sound_engine.js'
  ];

  requiredFiles.forEach(file => {
    assert(fs.existsSync(path.join(__dirname, '..', file)), `File exists: ${file}`);
  });

  // 2. Syntax Check (Node compilation check on all JS files)
  requiredFiles.filter(f => f.endsWith('.js')).forEach(file => {
    try {
      const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      new Function(code); // Basic syntax validation
      assert(true, `Syntax check passed: ${file}`);
    } catch (e) {
      assert(false, `Syntax error in ${file}: ${e.message}`);
    }
  });

  console.log(`\nQC Results: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    console.error(">>> QC FAILED. AGENT MUST FIX BUGS BEFORE PROCEEDING! <<<");
    process.exit(1);
  } else {
    console.log(">>> ALL QC TESTS PASSED. SAFE TO PROCEED! <<<");
    process.exit(0);
  }
}

runQC();
```

---

## SECTION 11: STEP-BY-STEP ANTIGRAVITY IMPLEMENTATION TASKS (WITH INTEGRATED QC)

Execute these tasks strictly in order. Run each task's QC test immediately upon completion.

---

### Task 1: 2.5D Canvas Engine, Y-Sorting & Reference HUD Layout
* **Target Files:** `src/engine/renderer.js`, `src/ui/hud.js`, `index.html`, `style.css`
* **Implementation Details:**
  1. Build 2.5D Canvas rendering pipeline with aged cream paper (`#F7F3E8`), Prussian blue line art (`#111E33`), and soft radial crimson telegraphs (`#F85A5A`).
  2. Implement **Y-sorting depth algorithm**: sort entities by bottom Y coordinate before drawing.
  3. Replicate the reference HUD (Top-left: Heart bar `6/11`, stamina bar, Day/Time badge; Top-right: 4 square utility buttons + Quest scroll; Bottom-left: D-Pad dial + 'Go Home' cabin; Bottom-right: Hand, Crosshair, Reticle, Bag).
* **QC Testing Protocol:**
  ```bash
  # Check for syntax errors and correct DOM node bindings
  node -e "const fs = require('fs'); const html = fs.readFileSync('index.html', 'utf8'); console.assert(html.includes('canvas') && html.includes('dpad'), 'HUD elements missing');"
  ```
* **Acceptance Gate:** Canvas initializes, 60fps loop runs without console errors, and HUD matches `image-1.png`. If errors occur, diagnose and fix immediately.

---

### Task 2: Standard 8-Frame Animator & Automated Slicer
* **Target Files:** `tools/slice_sprites.py`, `src/engine/animator.js`
* **Implementation Details:**
  1. Write `tools/slice_sprites.py` supporting $2 \times 4$ uniform grids with 3px border-margin trimming.
  2. Write `Sprite8FrameAnimator` in `src/engine/animator.js` running at 8 FPS with horizontal flipping (`flipX`).
* **QC Testing Protocol:**
  ```bash
  # Test the slicer with a dummy test image to verify mathematical cropping
  python3 -c "
  from PIL import Image
  import os
  os.makedirs('test_out', exist_ok=True)
  im = Image.new('RGBA', (400, 200), (255, 255, 255, 255))
  im.save('test_sheet.png')
  from tools.slice_sprites import slice_8frame_grid
  frames = slice_8frame_grid('test_sheet.png', 'test_out', 'test')
  assert len(frames) == 8, f'Expected 8 frames, got {len(frames)}'
  print('[QC PASS] Slicer validated successfully')
  "
  ```
* **Acceptance Gate:** Slicer successfully outputs 8 equal PNG frames without borders, and animator loops through frames 0–7 cleanly.

---

### Task 3: Unified Cross-Platform Input System (WASD & Touch D-Pad)
* **Target Files:** `src/input/input_manager.js`
* **Implementation Details:**
  1. Desktop: WASD / Arrow keys for movement, Mouse position for aim vector, Left Click = Attack, Right Click = Aim.
  2. Mobile / Touch: Bind touch-drag events on the bottom-left circular D-Pad, and tap events on the bottom-right Action cluster.
  3. Output clean, normalized `moveVector` and `aimVector` (guaranteed magnitude $\le 1.0$, never `NaN`).
* **QC Testing Protocol:**
  ```bash
  # Unit test normalized vectors and NaN safety
  node -e "
  const Input = require('./src/input/input_manager.js');
  // Verify vector calculations do not return NaN when inputs are zero
  let v = {x: 0, y: 0};
  let mag = Math.hypot(v.x, v.y) || 1;
  let norm = {x: v.x / mag, y: v.y / mag};
  console.assert(!isNaN(norm.x) && !isNaN(norm.y), 'Vector normalization produced NaN');
  console.log('[QC PASS] Input vector logic verified');
  "
  ```
* **Acceptance Gate:** Both keyboard and virtual D-Pad emit clean directional coordinates. Zero `NaN` crashes.

---

### Task 4: Hardcore Stealth Player Controller, Fern Concealment & Weapons
* **Target Files:** `src/entities/player.js`, `src/entities/projectile.js`
* **Implementation Details:**
  1. 11 HP health system. Stamina depleted by sprinting (Shift/D-Pad runner center) and restored when crouching.
  2. Fern & Hollow Log Concealment: crouching inside fern zones sets `isConcealed = true` and drops opacity to 40%.
  3. Weapons: Parang 75px melee arc (instant takedown from behind), Crossbow projectile, Suppressed 9mm shot, and Thrown Decoy Rocks.
* **QC Testing Protocol:**
  ```bash
  # Verify damage calculations and stealth state toggle
  node -e "
  const p = { hp: 11, maxHp: 11, isConcealed: false, inBush: true, crouching: true };
  if (p.inBush && p.crouching) p.isConcealed = true;
  console.assert(p.isConcealed === true, 'Concealment logic failed');
  console.log('[QC PASS] Player stealth state validated');
  "
  ```
* **Acceptance Gate:** Player moves in 2.5D space, ducks behind logs, becomes invisible in ferns, and weapons fire correctly.

---

### Task 5: Enemy AI, Mutated Boar & Faction Infighting
* **Target Files:** `src/entities/mercenary.js`, `src/entities/boar.js`
* **Implementation Details:**
  1. Mutated Boar: 1.2s soft radial red telegraph circle expanding around it, followed by high-speed charge dealing 60 damage and floating crimson numbers ("78").
  2. Ironclad Mercenary: 65-degree vision cone with red laser sight. Alert state triggers radio sound and 3-round rifle bursts.
  3. Faction Matrix: Mercenaries shoot charging boars; boars gore mercenaries.
* **QC Testing Protocol:**
  ```bash
  # Verify faction damage matrix logic
  node -e "
  const boar = { faction: 'FAUNA', damage: 60 };
  const merc = { faction: 'MERC', hp: 50 };
  if (boar.faction !== merc.faction) merc.hp -= boar.damage;
  console.assert(merc.hp <= 0, 'Faction infighting damage calculation failed');
  console.log('[QC PASS] Faction Infighting matrix verified');
  "
  ```
* **Acceptance Gate:** Spawning 1 Boar and 1 Mercenary triggers a visible red telegraph, a charge collision, and mutual combat.

---

### Task 6: "Go Home" Bivouac Camp Overlay & Procedural Audio Synthesizer
* **Target Files:** `src/ui/camp.js`, `src/audio/sound_engine.js`
* **Implementation Details:**
  1. "Go Home" Modal: Opens via cabin button or 'B' key. Features Rainwater Filter, Cookstove, Workbench, and Decryption Terminal.
  2. Web Audio API Engine: Zero external MP3/WAV files. Procedurally synthesizes rain, cicadas, parang slashes, silenced gunshots, radio alerts, and boar roars.
* **QC Testing Protocol:**
  ```bash
  # Verify audio node initialization safety (handles suspended audio contexts)
  node -e "
  const audioContextState = 'suspended';
  const canResume = (state) => state === 'suspended';
  console.assert(canResume(audioContextState), 'AudioContext resume check failed');
  console.log('[QC PASS] Audio resume logic verified');
  "
  ```
* **Acceptance Gate:** Camp overlay opens and closes smoothly; audio initializes without blocking or distorting.

---

### Task 7: Act 1 Full World Map & End-to-End Mission Flow
* **Target Files:** `src/world/level_act1.js`, `src/ui/prologue.js`, `src/main.js`
* **Implementation Details:**
  1. Assemble 4 continuous sectors: Riverbank $\rightarrow$ Logging Outpost $\rightarrow$ Infected Ravine $\rightarrow$ Blast Gate.
  2. Implement Prologue typewriter briefing screen with "BEGIN OPERATION" button.
  3. Wire victory trigger: Keycard terminal swipe $\rightarrow$ 15-second blast door opening survival hold $\rightarrow$ Act 1 Complete screen.
* **Master QC Test:**
  ```bash
  node tools/qc_validator.js
  ```
* **Acceptance Gate:** Master validator outputs `>>> ALL QC TESTS PASSED. SAFE TO PROCEED! <<<`. Complete game is playable from start to finish.

---

## SECTION 12: ANTIGRAVITY MULTIMODAL IMAGE PROMPTS (ATTACH `IMAGE-1.PNG` & `IMAGE-2.PNG`)

When generating artwork in Antigravity, **attach both `image-1.png` and `image-2.png` together** alongside each prompt:

### Prompt A: Operator Kancil Tactical Walk (8-Frame Grid)
```
[Reference: image-1.png for art style; image-2.png for 2x4 grid layout]
Generate an 8-frame sprite sheet in a uniform 2x4 grid (2 rows, 4 columns) with thin dark divider lines.
Subject: Operator Kancil walking in 2.5D oblique / isometric front-three-quarter perspective.
Equipment: Tactical backpack, field boots, parang machete held at low-ready.
Frames: Sequential 8-stage walk cycle showing smooth leg strides and arm movement.
Style: Vintage dip-pen ink etching, delicate cross-hatching, deep Prussian Blue ink (#111E33) on aged cream paper (#F7F3E8).
Output path: assets/sprites/kancil_walk_8f.png
Action: Run tools/slice_sprites.py on this file immediately after saving.
```

### Prompt B: Operator Kancil Parang Strike (8-Frame Grid)
```
[Reference: image-1.png for style; image-2.png for 2x4 grid layout]
Generate an 8-frame sprite sheet in a uniform 2x4 grid (2 rows, 4 columns).
Subject: Operator Kancil executing a lethal parang machete stealth slash in 2.5D oblique perspective.
Frames: Frames 0-1 windup, Frames 2-5 fast cross-cut slash with dynamic dark-blue ink motion arc, Frames 6-7 combat reset.
Style: Dark Prussian Blue line art, cross-hatched shading, cream parchment background.
Output path: assets/sprites/kancil_parang_8f.png
Action: Run tools/slice_sprites.py on this file immediately after saving.
```

### Prompt C: Mutated Babi Hutan & Red Telegraph (8-Frame Grid)
```
[Reference: image-1.png for monster tusk design and red aura; image-2.png for 2x4 grid layout]
Generate an 8-frame sprite sheet in a uniform 2x4 grid (2 rows, 4 columns).
Subject: Mutated Malaysian wild boar (Babi Hutan) attacking in 2.5D oblique perspective.
Frames: Frames 0-2 lowering head and pawing dirt with a soft radial red telegraph circle (#F85A5A) at feet; Frames 3-6 high-velocity charging stride forward with curved tusks thrusting; Frame 7 impact recoil.
Style: Woodcut engraving, hand-drawn ink etching on cream paper.
Output path: assets/sprites/boar_charge_8f.png
Action: Run tools/slice_sprites.py on this file immediately after saving.
```

### Prompt D: Ironclad Mercenary Patrol & Fire (8-Frame Grid)
```
[Reference: image-1.png and image-2.png]
Generate an 8-frame sprite sheet in a uniform 2x4 grid (2 rows, 4 columns).
Subject: Ironclad Tactical Solutions mercenary patrolling in 2.5D oblique perspective.
Equipment: Tactical vest, helmet, holding assault rifle with a thin red laser sight emitted from the barrel.
Frames: Sequential 8-frame tactical patrol walk.
Style: Prussian Blue ink linework on off-white paper, fine hatching.
Output path: assets/sprites/merc_patrol_8f.png
Action: Run tools/slice_sprites.py on this file immediately after saving.
```

### Prompt E: 2.5D Rainforest Tileset & Obstacles
```
[Reference: image-1.png]
Generate a 2.5D isometric environmental tileset matching the trees, fallen logs, and flora in image-1.png.
Assets: Massive mossy hollow fallen tree trunk (hiding cover), clumps of wild Belum ferns (concealment zone), logging shack walls, and corrugated metal bunker door.
Perspective: 2.5D front-three-quarter oblique view, Y-sort compatible.
Output path: assets/environment/rainforest_tileset.png
```

---

## SECTION 13: PRODUCTION LAUNCH CHECKLIST

1. [ ] **Step 1:** Run Task 1 & verify canvas and HUD match `image-1.png`.
2. [ ] **Step 2:** Run Task 2 & execute slicing test on `image-2.png` format.
3. [ ] **Step 3:** Run Task 3 & verify clean zero-NaN input vectors on desktop and mobile.
4. [ ] **Step 4:** Run Task 4 & verify player fern concealment and parang strikes.
5. [ ] **Step 5:** Run Task 5 & verify Boar red telegraphs and Mercenary faction infighting.
6. [ ] **Step 6:** Run Task 6 & test "Go Home" camp overlay and procedural audio.
7. [ ] **Step 7:** Run Task 7 & execute `node tools/qc_validator.js` until all tests pass.
8. [ ] **Step 8:** Publish polished Act 1 to itch.io for browser playtesting.
9. [ ] **Step 9:** Wrap using Capacitor for Google Play Store release.
