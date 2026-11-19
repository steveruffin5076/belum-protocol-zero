// tools/qc_validator.js - Headless System Test Runner (Section 10 Master QC Suite)
'use strict';

const fs = require('fs');
const path = require('path');

function runQC() {
  console.log('=== STARTING BELUM: PROTOCOL ZERO QC SUITE ===');
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

  const rootDir = path.join(__dirname, '..');

  // 1. Verify File Structure (Section 1 & Section 10)
  const requiredFiles = [
    'index.html', 'style.css', 'server.js', 'package.json',
    'src/main.js', 'src/engine/renderer.js', 'src/engine/animator.js', 'src/engine/camera.js',
    'src/input/input_manager.js', 'src/entities/player.js', 'src/entities/projectile.js',
    'src/entities/mercenary.js', 'src/entities/boar.js',
    'src/world/level_act1.js', 'src/world/obstacles.js',
    'src/ui/hud.js', 'src/ui/prologue.js', 'src/ui/camp.js',
    'src/audio/sound_engine.js',
    'tools/slice_sprites.py',
    'assets/reference/image-1.png', 'assets/reference/image-2.png',
    'assets/sprites/kancil_walk_8f.png', 'assets/sprites/kancil_stealth_8f.png',
    'assets/sprites/kancil_parang_8f.png', 'assets/sprites/boar_charge_8f.png',
    'assets/sprites/boar_idle_8f.png', 'assets/sprites/merc_patrol_8f.png',
    'assets/sprites/merc_fire_8f.png',
    'assets/environment/rainforest_tileset.png', 'assets/environment/paper_bg.png',
    'assets/environment/hollow_log.png', 'assets/environment/fern_clump.png',
    'assets/environment/bamboo_cluster.png', 'assets/environment/gate_blast_door.png'
  ];

  requiredFiles.forEach((file) => {
    assert(fs.existsSync(path.join(rootDir, file)), `File exists: ${file}`);
  });

  // 2. Syntax Check (Node compilation check on all JS files)
  requiredFiles.filter((f) => f.endsWith('.js')).forEach((file) => {
    try {
      const code = fs.readFileSync(path.join(rootDir, file), 'utf8');
      new Function(code);
      assert(true, `Syntax check passed: ${file}`);
    } catch (e) {
      assert(false, `Syntax error in ${file}: ${e.message}`);
    }
  });

  // 3. Palette Rule Check: ZERO pure RGB black in CSS or JS rendering code
  const pureBlackRegex = /#000000|#000(?![0-9a-fA-F])|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/;
  const styleTargets = ['style.css', 'src/engine/renderer.js', 'src/world/obstacles.js'];
  styleTargets.forEach((file) => {
    const text = fs.readFileSync(path.join(rootDir, file), 'utf8');
    assert(!pureBlackRegex.test(text), `No pure RGB black in ${file}`);
  });

  // 4. Verify 8 sliced frames exist for every 2x4 sprite sheet
  const prefixes = ['kancil_walk', 'kancil_stealth', 'kancil_parang', 'boar_charge', 'boar_idle', 'merc_patrol', 'merc_fire'];
  prefixes.forEach((pfx) => {
    let allEight = true;
    for (let i = 0; i < 8; i++) {
      if (!fs.existsSync(path.join(rootDir, 'assets/sprites/frames', `${pfx}_${i}.png`))) {
        allEight = false;
      }
    }
    assert(allEight, `8 sliced frames exist for ${pfx}`);
  });

  // 5. End-to-End Headless Level & Mechanics Integrity Check
  try {
    const { createAct1Level } = require(path.join(rootDir, 'src/world/level_act1.js'));
    const level = createAct1Level();
    assert(level.sectors.length === 4, 'Act 1 has 4 continuous sectors');
    assert(level.mercenaries.length >= 7, 'Act 1 spawns mercenaries across sectors including Commander Ward');
    assert(level.boars.length === 2, 'Act 1 Sector 3 spawns 2 Mutated Boars');
    assert(level.blastGateTimer === 15.0, 'Sector 4 Blast Gate survival hold timer is 15.0s');
  } catch (e) {
    assert(false, `Level initialization error: ${e.message}`);
  }

  console.log(`\nQC Results: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    console.error('>>> QC FAILED. AGENT MUST FIX BUGS BEFORE PROCEEDING! <<<');
    process.exit(1);
  } else {
    console.log('>>> ALL QC TESTS PASSED. SAFE TO PROCEED! <<<');
    process.exit(0);
  }
}

runQC();
