# BELUM: PROTOCOL ZERO (Operasi Hujan Hening)
## Master Triple-A Art, Environment, Architecture, Tools & Audio Foley Specification
### Autonomous Asset & Sound Pipeline for Google Antigravity

---

### EXECUTIVE AESTHETIC DIRECTIVE
To achieve a "Triple-A Indie" standard (matching titles like *Darkwood*, *Signalis*, and *Cult of the Lamb*), all visual assets and audio foley must possess **physical weight, material texture, and tactile depth**:
1. **Art Style:** Strictly adheres to **`image-1.png`** (hand-drawn vintage dip-pen ink etching on aged cream parchment paper `#F7F3E8`, deep Prussian Blue ink `#111E33`, and soft radial crimson telegraphs `#F85A5A`).
2. **Animation Standard:** Standardized **8-frame uniform grids ($2 \times 4$)** matching **`image-2.png`**.
3. **Perspective:** 2.5D Oblique / Isometric front-three-quarter perspective with strict Y-sorting.
4. **Audio Standard:** 100% procedural Web Audio API with multi-layered foley (surface-dependent footsteps, mechanical weapon clicks, organic rain textures, and dynamic tension ducking).

---

## SECTION 1: ENVIRONMENTAL BIOME ASSETS (BELUM-TEMENGOR VIRGIN RAINFOREST)

All environment assets must be drawn with fine cross-hatching, contour shading, and organic rough ink borders to look like a living historical naturalist field journal.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ BELUM RAINFOREST ASSET CATALOG (2.5D OBLIQUE VIEW)                           │
├──────────────────────┬─────────────┬──────────────┬──────────────────────────┤
│ Asset Name           │ Dimensions  │ Depth / Type │ Visual Characteristics   │
├──────────────────────┼─────────────┼──────────────┼──────────────────────────┤
│ ancient_canopy_tree  │ 160 x 240px │ Obstacle     │ Towering strangler fig,  │
│                      │             │ (Y-Sorted)   │ aerial roots, mossy bark │
├──────────────────────┼─────────────┼──────────────┼──────────────────────────┤
│ hollow_fallen_log    │ 165 x 84px  │ Cover / Hide │ Giant rotting Shorea log,│
│                      │             │ (Pass-behind)│ exposed rings, hollow core│
├──────────────────────┼─────────────┼──────────────┼──────────────────────────┤
│ wild_belum_ferns     │ 120 x 86px  │ Conceal Zone │ Dense fronds, parts when │
│                      │             │ (Translucent)│ player crouches inside   │
├──────────────────────┼─────────────┼──────────────┼──────────────────────────┤
│ giant_bamboo_cluster │ 135 x 130px │ Solid Wall   │ Thick Buluh Betung stalks│
│                      │             │ (Hatched)    │ blocks line-of-sight     │
├──────────────────────┼─────────────┼──────────────┼──────────────────────────┤
│ riverbank_mud_rocks  │ 140 x 70px  │ Low Obstacle │ Water-smoothed limestone │
│                      │             │              │ river stones with moss   │
├──────────────────────┼─────────────┼──────────────┼──────────────────────────┤
│ mutated_rafflesia    │ 110 x 95px  │ Hazard       │ Fleshy parasitic petals, │
│                      │             │ (Spore Ring) │ glowing red spore haze   │
└──────────────────────┴─────────────┴──────────────┴──────────────────────────┘
```

### Multimodal Art Prompt: Environment Master Pack
* **Antigravity Input:** Attach `image-1.png` + Text:
```
[Reference: image-1.png for ink linework, cross-hatching, and paper background]
Generate a 2.5D isometric environmental asset sheet on aged cream parchment paper (#F7F3E8).
Assets included in sheet:
1. Ancient rainforest strangler fig tree with creeping aerial roots and hatched canopy.
2. Massive mossy hollow fallen log (large enough for a tactical character to duck behind).
3. Cluster of wild Belum jungle ferns with delicate feathering fronds.
4. Dense giant Malaysian bamboo thicket (Buluh Betung) with vertical ink hatching.
5. Mutated giant Rafflesia spore bulb with curled fleshy petals and fine cross-hatching.
Style: Vintage dip-pen ink etching, deep Prussian Blue ink (#111E33), zero RGB black, high contrast, transparent PNG export.
Output directory: assets/environment/
```

---

## SECTION 2: ARCHITECTURAL & BUNKER STRUCTURES

Act 1 transitions from the raw rainforest into militarized industrial terrain. Buildings must showcase three distinct historical layers:

```
[Layer 1: British Colonial / Timber Era] ──► Weathered timber, corrugated zinc roofs
[Layer 2: Ironclad PMC Checkpoints]     ──► Sandbag barricades, razor wire, floodlight rigs
[Layer 3: Vanguard Bio-Synthetics (VBS)] ──► Reinforced brutalist concrete blast bunkers
```

### 1. Abandoned Logging Barracks & Generator Shed (Sector 2)
* **Barracks Structure (280 x 150px):** Slanted corrugated iron roof with cross-hatched rust streaks, rotting timber planks, broken louvre windows, and a raised stilt foundation.
* **Diesel Generator Shed (230 x 135px):** Enclosed shed with an industrial diesel generator inside, exhaust pipe puffing faint ink smoke circles, vibrating pulley belt, and an interactive red circuit breaker box (`[E] SABOTAGE GENERATOR`).
* **Perimeter Chain-Link & Sandbag Fence (26 x 180px):** Cross-hatched diamond wire mesh topped with looped razor wire and sandbags at the base.

### 2. Temenggor Perimeter Blast Gate Bunker (Sector 4 Climax)
* **Concrete Blast Bunker (3825 x 530px, door opening 95 x 255px):**
  * Massive brutalist reinforced concrete wall with visible formwork lines and drainage stains.
  * Heavy double-locking hydraulic blast doors with diagonal hazard stripes drawn in Prussian Blue.
  * Overhanging security gantry with a swiveling red searchlight tower.
  * **Biometric Terminal Pedestal:** Sturdy steel podium with an illuminated red card-swipe slot (`[E] SWIPE TIER-1 KEYCARD`).
* **Flooded Drainage Culvert Grate (3560 x 985px, 32 x 100px):**
  * Rust-eaten iron storm grate draining chemical runoff into the river. Provides the stealth infiltration bypass path.

### Multimodal Art Prompt: Architecture & Military Bunker
* **Antigravity Input:** Attach `image-1.png` + Text:
```
[Reference: image-1.png]
Generate a 2.5D isometric architectural asset kit in vintage dip-pen ink on cream paper:
1. Dilapidated Malaysian rainforest logging barracks with raised wooden stilts and corrugated tin roof.
2. Diesel generator shed with vibrating belt, exhaust pipe, and breaker box.
3. Heavy brutalist concrete blast bunker entrance with thick hydraulic blast doors, reinforced steel bolts, and warning stencils.
4. Interactive security card-swipe pedestal with a thin red scanner line.
5. Rust-encrusted iron drainage culvert grate half-submerged in swamp water.
Style: Fine woodcut cross-hatching, deep Prussian Blue ink (#111E33) on parchment (#F7F3E8).
Output directory: assets/buildings/
```

---

## SECTION 3: TOOLS, WEAPONS & DIEGETIC SURVIVAL GEAR

Every pickup, tool, and weapon must look like authentic, field-worn military or bushcraft gear:

```
┌───────────────────┬──────────────┬───────────────────────────────────────────┐
│ Item Name         │ HUD Tag / ID │ Visual & Tactical Characteristics         │
├───────────────────┼──────────────┼───────────────────────────────────────────┤
│ Steel Parang      │ [PRG]        │ Traditional Malaysian machete with Duri   │
│                   │              │ bamboo handle, convex belly, razor edge   │
├───────────────────┼──────────────┼───────────────────────────────────────────┤
│ Silent Crossbow   │ [BOW]        │ Tactical carbon-limb recurve crossbow,    │
│                   │              │ wire fletched bolts, zero mechanical noise│
├───────────────────┼──────────────┼───────────────────────────────────────────┤
│ Suppressed 9mm    │ [9MM]        │ Special forces sidearm with cylindrical   │
│                   │              │ subsonic suppressor and matte stippled grip│
├───────────────────┼──────────────┼───────────────────────────────────────────┤
│ Decoy Pebbles     │ [RCK]        │ Smooth river stones gathered from Belum   │
│                   │              │ riverbank; thrown to trigger noise rings  │
├───────────────────┼──────────────┼───────────────────────────────────────────┤
│ Rainwater Canteen │ [H2O]        │ Military aluminum canteen with canvas     │
│                   │              │ strap; dirty river water needs filtering  │
├───────────────────┼──────────────┼───────────────────────────────────────────┤
│ VBS Keycard Lanyard│ [KEY]       │ White polymer card stamped with red VBS   │
│                   │              │ biometric insignia and 'TIER-1 CLEARANCE' │
├───────────────────┼──────────────┼───────────────────────────────────────────┤
│ Encrypted USB Drive│ [DRV]       │ Ruggedized military flash drive with red  │
│                   │              │ blinking telemetry LED; contains lore logs │
└───────────────────┴──────────────┴───────────────────────────────────────────┘
```

### Multimodal Art Prompt: Weapons & Survival Inventory Icons
* **Antigravity Input:** Attach `image-1.png` + Text:
```
[Reference: image-1.png for UI icons and button framing]
Generate a set of 8 modular 2.5D game inventory icons in dark Prussian Blue ink line art:
1. Steel Parang (Malaysian bush machete with wrapped bamboo grip).
2. Silent tactical crossbow with loaded arrow.
3. Suppressed 9mm pistol with threaded suppressor.
4. Pouch of smooth river stones.
5. Military aluminum water canteen.
6. Bamboo shoot ration bundle.
7. Tier-1 security keycard on a lanyard with red chip accent (#F85A5A).
8. Military encrypted USB drive with rugged casing.
Style: Hand-drawn engraving, clean transparent background, fits in 64x64px HUD slot.
Output directory: assets/ui/items/
```

---

## SECTION 4: MASTER FOLEY SOUND DESIGN SUITE (TRIPLE-A PROCEDURAL AUDIO)

A game feels "cheap" when sound is repetitive, dry, and detached from the surface. In this Triple-A foley suite, every footstep, weapon cock, and creature grunt is procedurally synthesized with real-time acoustic physics:

```
┌────────────────────────────────────────────────────────────────────────┐
│ PROCEDURAL SOUND ARCHITECTURE (ZERO EXTERNAL MP3s NEEDED)              │
├─────────────────────────┬──────────────────────────────────────────────┤
│ Surface-Aware Footsteps │ Squelching mud, dry leaves, wooden planks    │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Visceral Combat Hits    │ Melee whoosh, bone crunch, suppressed "pfft" │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Environmental Ambience  │ Tropical rain, cicada drone, rolling thunder │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Diegetic Machinery      │ Generator sputter, klaxon alarm, blast door  │
└─────────────────────────┴──────────────────────────────────────────────┘
```

### 1. Surface-Dependent Footstep Synthesizer
* **Mud / Riverbank (`footstep_mud`):** Low-pass filtered noise burst (320 Hz) with an immediate wet pitch drop (140 Hz $\rightarrow$ 60 Hz) and soft squelch.
* **Foliage / Ferns (`footstep_ferns`):** High-frequency bandpass noise (2400 Hz) with gentle exponential decay, simulating brushing dry banana and fern leaves.
* **Wooden Barracks Planks (`footstep_wood`):** Resonant square wave thump (110 Hz) with a hollow body resonance filter (Q = 4.2).

### 2. Visceral Weapon Foley
* **Parang Lethal Strike (`parang_slice`):**
  * Layer 1: High-velocity blade whoosh (triangle wave sweeping 650 Hz $\rightarrow$ 180 Hz in 80ms).
  * Layer 2: Meaty cartilage slice (pink noise burst through 1200 Hz bandpass with exponential envelope).
  * Layer 3: Blood ink spatter (three micro-clicks at 0ms, 40ms, 80ms).
* **Suppressed 9mm Pistol Shot (`suppressed_shot`):**
  * Layer 1: Pneumatic gas release (subsonic low-pass pop at 220 Hz with fast 45ms decay).
  * Layer 2: Mechanical bolt cycle (crisp sawtooth click at 1400 Hz followed by slide reset click at 40ms).
  * Layer 3: Shell casing clink on ground (two high metallic sine pings at 2800 Hz and 2400 Hz after 0.35s).
* **Crossbow Bolt Fire & Impact (`crossbow_fire` & `bolt_thud`):**
  * Release: Rapid pitch-drop sine wave (880 Hz $\rightarrow$ 110 Hz in 60ms) with a subtle string buzz.
  * Impact: Heavy dull wooden thud (triangle wave at 95 Hz) + arrow vibration twang.

### 3. Creature & Tactical Foley
* **Mutated Boar Squeal & Charge (`boar_roar`):**
  * Heavy distorted sawtooth wave (85 Hz $\rightarrow$ 55 Hz) modulated by a 14 Hz vibrato LFO, layered with rumbling pink noise.
* **Boar Concrete Wall Concussion (`boar_wall_crash`):**
  * Sub-bass impact thud (45 Hz punch at 0.9 gain) + cracking concrete noise burst + high ringing ear-tinnitus tone (3500 Hz fading over 2.0s).
* **Ironclad Radio Alert Chirp (`radio_alert`):**
  * High-pitched digital dual-tone (1200 Hz and 1650 Hz) + 80ms burst of bandpassed radio static.
* **Perimeter Blast Door Opening (`blast_gate_open`):**
  * Layer 1: High-pressure pneumatic hydraulic hiss (filtered white noise fading over 1.8s).
  * Layer 2: Deep iron gear grinding (low saw wave 38 Hz grinding through resonance filter).
  * Layer 3: Emergency warning klaxon (pulsing alternating two-tone 580 Hz / 440 Hz every 0.8s).

---

## SECTION 5: SOUND ENGINE CODE SPECIFICATION (`src/audio/sound_engine.js`)

Antigravity must implement these exact procedural synthesizer methods:

```javascript
// src/audio/sound_engine.js - Triple-A Foley Synthesizer
export class BelumTripleAAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.ambientGain = null;
    this.lowpassDucking = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    // Master bus
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Dynamic tension low-pass filter (for combat ducking)
    this.lowpassDucking = this.ctx.createBiquadFilter();
    this.lowpassDucking.type = 'lowpass';
    this.lowpassDucking.frequency.setValueAtTime(20000, this.ctx.currentTime);
    this.lowpassDucking.connect(this.masterGain);

    // Sub-busses
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
    this.sfxGain.connect(this.lowpassDucking);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.45, this.ctx.currentTime);
    this.ambientGain.connect(this.lowpassDucking);

    this.startRainAndCicadas();
    this.initialized = true;
  }

  // Tension Ducking: Muffles ambient sound when in mortal danger
  setCombatTension(isAlerted) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (isAlerted) {
      this.lowpassDucking.frequency.linearRampToValueAtTime(450, now + 0.35);
      this.ambientGain.gain.linearRampToValueAtTime(0.18, now + 0.35);
    } else {
      this.lowpassDucking.frequency.linearRampToValueAtTime(20000, now + 0.8);
      this.ambientGain.gain.linearRampToValueAtTime(0.45, now + 0.8);
    }
  }

  // Surface-Aware Footstep
  playFootstep(surface = 'mud') {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (surface === 'mud') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    } else if (surface === 'wood') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.06);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Visceral Parang Slash with Meat Crunch
  playParangSlash() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Whoosh
    const whoosh = this.ctx.createOscillator();
    const whooshGain = this.ctx.createGain();
    whoosh.type = 'triangle';
    whoosh.frequency.setValueAtTime(580, now);
    whoosh.frequency.exponentialRampToValueAtTime(140, now + 0.12);
    whooshGain.gain.setValueAtTime(0.35, now);
    whooshGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    whoosh.connect(whooshGain);
    whooshGain.connect(this.sfxGain);
    whoosh.start(now);
    whoosh.stop(now + 0.13);

    // Cartilage slice noise
    const bufSize = this.ctx.sampleRate * 0.1;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, now);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.42, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);
  }

  // Boar Concrete Wall Crash (Matador Concussion)
  playBoarWallCrash() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Sub-bass impact
    const punch = this.ctx.createOscillator();
    const punchGain = this.ctx.createGain();
    punch.type = 'triangle';
    punch.frequency.setValueAtTime(75, now);
    punch.frequency.exponentialRampToValueAtTime(25, now + 0.35);
    punchGain.gain.setValueAtTime(0.9, now);
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    punch.connect(punchGain);
    punchGain.connect(this.sfxGain);
    punch.start(now);
    punch.stop(now + 0.42);

    // Ear-ringing tinnitus
    const ring = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(3200, now);
    ringGain.gain.setValueAtTime(0.12, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    ring.connect(ringGain);
    ringGain.connect(this.sfxGain);
    ring.start(now);
    ring.stop(now + 1.85);
  }
}
```

---

## SECTION 6: AUTONOMOUS ANTIGRAVITY WORKFLOW TASKS

Instruct Antigravity to execute these asset & sound tasks:

### Task A: Generate All Environmental & Architectural Assets
```markdown
[Target: Antigravity Image Agent]
Using Section 1 and Section 2 prompts with `image-1.png` attached:
1. Generate `assets/environment/rainforest_tileset.png` (Trees, logs, bamboo, ferns).
2. Generate `assets/buildings/military_bunker_kit.png` (Barracks, generator shed, blast bunker door, keycard pedestal, drainage culvert).
3. Verify that all exported assets use Prussian Blue ink (#111E33) on transparent backgrounds with clean Y-sorting footings.
```

### Task B: Generate Weapons & Survival Inventory Icons
```markdown
[Target: Antigravity Image Agent]
Using Section 3 prompt with `image-1.png` attached:
1. Generate the 8 modular items (Parang, Crossbow, Suppressed 9mm, Decoy Rocks, Canteen, Bamboo Shoots, Keycard, Encrypted Drive) to `assets/ui/items/`.
2. Format as 64x64px transparent PNGs matching the reference HUD.
```

### Task C: Integrate Surface-Aware Foley & Audio Ducking
```markdown
[Target: Antigravity Code Agent]
Implement the Section 5 `BelumTripleAAudioEngine` in `src/audio/sound_engine.js`:
1. Integrate `setCombatTension(isAlerted)` ducking filter.
2. Bind surface-aware footsteps (`playFootstep('mud')` and `playFootstep('wood')`) to player movement.
3. Bind `playBoarWallCrash()` to the boar wall-stun collision.
4. Verify audio context auto-resumes cleanly on the first player click.
```
