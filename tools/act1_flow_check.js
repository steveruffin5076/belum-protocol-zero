#!/usr/bin/env node
// tools/act1_flow_check.js - Progression graph & reachability verifier for ACT1_EXPANSION_MODERN_TASKS Task 4
'use strict';

const { ACT1_FLOW, validateFlow } = require('../src/world/act1_flow.js');
const { createAct1Level } = require('../src/world/level_act1.js');

let failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`[PASS] ${msg}`);
  } else {
    console.error(`[FAIL] ${msg}`);
    failed++;
  }
}

// 1. Default flow reaches extraction with all required items/gates in order
const base = validateFlow(ACT1_FLOW);
assert(base.ok && base.goalReached, `Normal flow reaches extraction (${base.reachableNodes.length}/${ACT1_FLOW.nodes.length} nodes, tokens: ${base.acquiredTokens.join(', ')})`);

// 2. Removing bolt_cutters MUST fail (cannot pass Sector 1 -> Sector 2 fence gate)
const noCutters = validateFlow(ACT1_FLOW, { excludeItems: ['bolt_cutters'] });
assert(!noCutters.ok && !noCutters.goalReached, 'Removing bolt_cutters makes extraction unreachable');

// 3. Removing safe_code MUST fail the safe-keycard path (and removing both keycard sources makes extraction unreachable)
const noSafeCode = validateFlow(ACT1_FLOW, { excludeItems: ['safe_code'] });
assert(!noSafeCode.ok, 'Removing safe_code fails required safe-code flow validation');
const noKeycardAtAll = validateFlow(ACT1_FLOW, { excludeItems: ['safe_code', 'tier1_keycard_ward'] });
assert(!noKeycardAtAll.goalReached, 'Removing safe_code and Ward body keycard makes extraction unreachable');

// 4. Removing pump_powered MUST block Sector 4
const noPump = validateFlow(ACT1_FLOW, { excludeItems: ['pump_powered'] });
assert(!noPump.ok && !noPump.goalReached, 'Removing pump_powered makes Sector 4 & extraction unreachable');

// 5. Verify live level_act1.js matches flow requirements
const level = createAct1Level();
const hasOldFloorKeycard = level.interactables.some((it) => it.id === 'pickup_keycard');
assert(!hasOldFloorKeycard, 'Old floor pickup_keycard has been removed from level_act1.js');

const requiredInteractables = [
  'pickup_bolt_cutters',
  'obj_cut_fence',
  'pickup_drive_01',
  'obj_lab_safe',
  'obj_outpost_gate',
  'obj_pump_station',
  'obj_terminal'
];
for (const id of requiredInteractables) {
  assert(level.interactables.some((it) => it.id === id), `Level contains required interactable: ${id}`);
}
assert(Array.isArray(level.drones) && level.drones.length >= 1, `Level spawns PMC surveillance drone(s): ${level.drones ? level.drones.length : 0}`);

if (failed > 0) {
  console.error(`\nact1_flow_check FAILED (${failed} failure(s))`);
  process.exit(1);
}
console.log('\n>>> ALL ACT 1 FLOW CHECKS PASSED <<<');
process.exit(0);
