# BELUM: PROTOCOL ZERO (Operasi Hujan Hening)
## Triple-A Indie Polish, Game Juice & Quality Control Specification
### Autonomous Implementation Plan for Google Antigravity

> **Status: COMPLETED** (`e6c41cb`) — All Tasks 1–4 (autoplay audio unlock, inertia/hit-stop/ink puddles/trauma, suspicion eye/footprints/foliage rustle/boar wall-stun, sector checkpoints & standalone bundle) implemented, verified, and merged on `main`.

---

### EXECUTIVE DIRECTIVE: ELEVATING TO "TRIPLE-A INDIE" QUALITY
A standard prototype feels "cheap" because of:
1. Instant linear movement with zero inertia or acceleration damping.
2. Flat, robotic combat with no hit-stop, impact pause, or dynamic screenshake.
3. Binary AI that snaps instantly between "blind" and "laser-accurate aimbot".
4. Dead, static environments where plants don't rustle and walking leaves no trace.
5. Dry audio with no dynamic tension ducking or low-pass filtering.

This document provides the exact code architectures, mathematical algorithms, and autonomous tasks for **Google Antigravity** to upgrade **`index.html`** into an acclaimed, prestige indie title (in the league of *Darkwood*, *Katana Zero*, *Signalis*, and *Cult of the Lamb*).

---

## SECTION 1: THE CORE BUGS & PLAYTEST FIXES (IMMEDIATE GATES)

### 1. Foolproof Audio Unlock (Browser Autoplay Compliance)
* **Problem:** Browsers block Web Audio until user interaction. If the user starts the game, ambient rain and sound effects can stay muted.
* **Fix in `src/audio/sound_engine.js` & `src/ui/prologue.js`:**
  * Add automatic `resume()` triggers on:
    1. The "BEGIN OPERATION" prologue button click.
    2. Any canvas pointerdown / keydown event.
  * In the HUD top bar, add a persistent ink-stamped speaker icon that pulses softly if audio is muted or suspended, showing: `[AUDIO: ACTIVE]` or `[TAP TO UNMUTE]`.

### 2. Mobile Action Hitbox Expansion (+20% Touch Tolerance)
* **Problem:** On phones <6.2 inches, the Hand, Crosshair, and Reticle buttons can cause misclicks during high-stress encounters.
* **Fix in `style.css` & `src/input/input_manager.js`:**
  * Keep the visual icon at 52px, but expand the invisible touch hitbox to **66px** using negative margins or an outer touch-target wrapper (`padding: 12px`).
  * Add multi-touch separation so pressing the D-pad with the left thumb never cancels an attack tap on the right thumb.

### 3. Native Mobile Haptic Feedback (`navigator.vibrate`)
* **Implementation:**
  * Parang Light Slash: `navigator.vibrate(15)`
  * Stealth Execution: `navigator.vibrate([25, 40, 25])`
  * Boar Charge Impact: `navigator.vibrate([40, 60, 80])`
  * Enemy Spotted / Alert: `navigator.vibrate([30, 50])`

---

## SECTION 2: THE "GAME JUICE" & COMBAT IMPACT ARCHITECTURE

### 1. Combat Hit-Stop (Micro-Freeze Frame)
When a melee parang slash or boar charge connects, **freeze the game logic for 45 milliseconds** while maintaining visual effects.
* **Why it feels Triple-A:** Games like *Hollow Knight* and *Katana Zero* use hit-stop to make every strike feel like it cuts through bone.
* **Algorithm in `src/main.js`:**
```javascript
triggerHitStop(durationMs = 45) {
  this.hitStopTimer = durationMs / 1000.0;
}

// In the update loop:
if (this.hitStopTimer > 0) {
  this.hitStopTimer -= dt;
  // Skip entity position updates, but continue rendering camera shake and particle fx
  this.renderer.render(this);
  return;
}
```

### 2. Organic "Fountain Pen Ink-Bleed" Death Puddles
When a mercenary or wild boar is slain:
* Do not just leave a static body.
* Procedurally generate an organic, pooling **Prussian Blue Ink Puddle (`#111E33`)** beneath the body that slowly expands and bleeds into the parchment grain over 2.4 seconds.
* Use 3 overlapping organic ellipses with rough, feathered edges to simulate real ink seeping into wet paper.

### 3. Cinematic Spring Camera & Aim Lookahead
* **Current Camera:** Linear lerp.
* **Triple-A Spring Camera (`src/engine/camera.js`):**
  * **Dynamic Framing:** When sneaking in ferns, zoom the camera in by 8% (intimate tension). When sprinting, zoom out by 6% (tactical awareness).
  * **Aim Lookahead:** Offset the camera 75px in the direction of the player's aim vector so players can scout ahead before moving.
  * **Directional Screenshake Impulse:** Instead of random noise, shake the camera *away* from the impact origin with exponential decay:
    $$\text{offset} = \text{recoilDir} \times \text{trauma}^2 \times \sin(\text{time} \times \text{frequency})$$

### 4. Dynamic Audio Ducking & Heartbeat Tension
* When an Ironclad guard enters the `ALERT` state or player HP drops $\le 3$:
  * Apply a low-pass filter (cutoff 450 Hz) to the ambient rain and cicadas, making the outside world sound muffled and distant.
  * Swell a rhythmic **55 Hz sub-bass heartbeat** oscillator that accelerates as guards close in.

---

## SECTION 3: ADVANCED TACTICAL AI (ELIMINATING "DUMB AI")

### 1. Gradual Suspicion Meter (The Inking Eye)
* **Problem:** Instant binary detection ("I didn't see you $\rightarrow$ Now I'm shooting you") feels cheap.
* **Triple-A Solution:**
  * When a player steps into a mercenary's peripheral vision cone, display a hand-drawn **Ink Eye / Question Mark** above the guard's head that gradually fills with dark ink over **0.85 seconds**.
  * If the player dives behind a log or into ferns before the meter fills 100%, the guard pauses, walks to where they saw movement, sweeps their red laser in a 45° arc, and mumbles into their radio before returning to patrol.

### 2. Mutated Boar "Wall Crash" Concussion (The Matador Mechanic)
* **Mechanic:**
  * If the player bait-dodges a charging wild boar and it slams into a solid concrete bunker wall or heavy limestone rock:
    1. Boar stops instantly, screen violently shakes (`trauma = 0.8`), and a deep wooden thud echoes.
    2. Boar enters `STUNNED` state for **2.6 seconds**.
    3. Three hand-drawn ink stars orbit above the boar's head.
    4. Grants the player a prime window to deliver a parang slash or slip past through the ravine.

### 3. Mercenary Turn Inertia & Flashlight Sweep Lag
* Guards should not snap 180° instantaneously.
* Limit their angular rotation to $4.2 \text{ rad/s}$ ($240^\circ/\text{s}$). 
* When turning, their red laser sight sweeps smoothly across the bamboo, creating suspenseful near-misses.

---

## SECTION 4: LIVING ENVIRONMENTAL REACTIVITY

### 1. Foliage Rustle & Plant Physics
* When the player or an enemy walks through a fern patch or bamboo grove:
  * Apply a temporary positional shear ($\pm 6\text{px}$) that oscillates for 0.4 seconds like parting leaves.
  * Spawn 2–3 tiny ink-drawn leaf specks that flutter upward.
  * Emit a soft procedural leaf-rustle sound (`playLeafRustle()`).

### 2. Wet Mud Footprints
* Walking along the **Sungai Belum Riverbank** or marshy ravine leaves faint, fading dark-ink footprints.
* Footprints persist for **4.5 seconds** before dissolving into the parchment paper.
* *Triple-A Stealth Detail:* If a mercenary crosses fresh footprints, their suspicion meter bumps +20% and they turn to inspect the direction of the tracks.

### 3. Dynamic Fog-of-War Blueprint Hatching
* Areas occluded behind solid concrete bunker walls and thick bamboo are not just blacked out; they are rendered in dense, diagonal **blueprint hatching lines** in deep blue ink. 
* Entering a building or bunker smoothly reveals the interior while hatching the exterior.

---

## SECTION 5: QUALITY OF LIFE & ACCESSIBILITY

### 1. Diegetic Calligraphy Action Badges
Display contextual hand-drawn calligraphic button prompts floating above interactables when within range (75px):
* Unalerted guard from behind: `[E / TAP] SILENT TAKEDOWN`
* Slain wild boar: `[E / TAP] HARVEST BOAR MEAT`
* Diesel generator: `[E / TAP] SABOTAGE GENERATOR`
* Blast terminal: `[E / TAP] SWIPE TIER-1 KEYCARD`

### 2. Sector Checkpoint Auto-Save (`localStorage`)
* Record checkpoint data whenever the player enters a new sector:
  * `sector_1`: Riverbank Drop
  * `sector_2`: Logging Outpost
  * `sector_3`: Infected Ravine
  * `sector_4`: Blast Gate
* On the Game Over screen, provide two distinct options:
  * **[RETRY CURRENT SECTOR]** (Respawn at sector threshold with recovered health and saved loot).
  * **[RESTART FULL INFILTRATION]** (For hardcore purists).

---

## SECTION 6: AUTONOMOUS ANTIGRAVITY IMPLEMENTATION TASKS

Antigravity must execute these tasks directly against `index.html` (or the modular `src/` codebase):

---

### Task 1: Implement Combat Hit-Stop, Ink-Bleed Puddles & Screen Trauma
```markdown
[Target: Antigravity Code Agent]
Implement AAA Game Juice in `index.html`:
1. Add `hitStopTimer` (0.045s) triggered on all lethal parang takedowns and boar impacts.
2. Add `InkPuddle` system: On entity death, render an organic expanding Prussian Blue ink pool (#111E33) that grows over 2.4s and stains the parchment.
3. Upgrade camera shake to use directional trauma spring physics:
   - Recoil impulse away from impact point with quadratic decay.
4. Add native `navigator.vibrate` calls for light attack (15ms), takedown ([25, 40, 25]ms), and damage ([40, 60]ms).
```

---

### Task 2: Implement Suspicion Meter & Boar Wall-Stun Concussion
```markdown
[Target: Antigravity Code Agent]
Upgrade Tactical AI in `index.html`:
1. Mercenary Suspicion:
   - Add `suspicionMeter` (0.0 to 1.0). Fills over 0.85s when player is in peripheral vision.
   - Draw an ink-etched eye icon above the guard that fills as suspicion rises. Full meter triggers ALERT.
   - Limit guard turning speed to 4.2 rad/s (no instant 180 snaps).
2. Boar Wall-Stun:
   - In `_hitsSolid()` during charge state: If boar hits a solid bunker wall or rock, enter `STUNNED` state for 2.6s.
   - Trigger camera shake (trauma 0.8), sound.playBoarImpact(), and render 3 swirling ink stars above boar head.
```

---

### Task 3: Environmental Reactivity (Foliage Rustle & Mud Footprints)
```markdown
[Target: Antigravity Code Agent]
Implement Environmental Physics in `index.html`:
1. Fern Sway: When an entity overlaps a fern obstacle, add an oscillation offset to fern drawing (frequency 8Hz, damping over 0.4s).
2. Footprints: Spawn fading footstep marks in mud/river zones (Sector 1 & 3) that fade out after 4.5 seconds.
3. Inked Action Badges: Render floating calligraphic badges ('[E] SILENT TAKEDOWN', '[E] SABOTAGE') when player is within 75px of interactables.
```

---

### Task 4: Audio Unlock Safety & Sector Checkpoint Persistence
```markdown
[Target: Antigravity Code Agent]
Implement QoL & Systems in `index.html`:
1. Audio Unlock:
   - Auto-resume AudioContext on 'BEGIN OPERATION' click or first user tap.
   - Add pulsating audio indicator in top HUD: '[AUDIO ACTIVE]' / '[TAP TO UNMUTE]'.
2. LocalStorage Checkpoints:
   - Save sector index, player inventory, and weapon states to `localStorage.getItem('belum_checkpoint')` upon entering Sectors 2, 3, and 4.
   - Update Game Over modal with 'RETRY CURRENT SECTOR' button that restores player at sector spawn.
```

---

## SECTION 7: QC VALIDATION & ACCEPTANCE CRITERIA

Before considering the upgrade complete, Antigravity must verify:
1. [ ] **Hit-Stop Feel:** Parang takedown produces a noticeable, crisp 45ms freeze frame without breaking the game timer or animation loops.
2. [ ] **Ink Puddles:** Slain enemies leave beautiful, permanent ink stains on the parchment floor that sort correctly in Y-depth.
3. [ ] **Boar Matador Stun:** Luring a wild boar into a concrete bunker wall stuns it for 2.6s with visible swirling ink stars.
4. [ ] **Suspicion Meter:** Walking briefly through the edge of an enemy vision cone shows an eye meter filling, giving players time to dive into ferns.
5. [ ] **Zero Console Errors:** The browser console remains 100% clean of unhandled promises, AudioContext warnings, or NaN vector coordinates.
