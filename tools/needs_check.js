#!/usr/bin/env node
// tools/needs_check.js - Task 6a survival needs simulation check (Hydration & Energy)
'use strict';

const Player = require('../src/entities/player.js');

function simulateNeed({ isSprinting, drainMult = 1.0 }) {
  const dt = 0.5;
  const res = {
    hydWarnMin: null,
    hydEmptyMin: null,
    engWarnMin: null,
    engEmptyMin: null,
    dehydrationDmgTimeSec: null,
    effMaxStaminaAtEmpty: null
  };

  // Pass 1: Hydration full -> warning (25%) -> empty (0%) -> first HP tick (20s)
  const pHyd = new Player(190, 660);
  let t = 0;
  let emptyAt = null;
  const startHp = pHyd.hp;
  while (t < 1000) {
    t += dt;
    const out = pHyd.updateNeeds(dt, { isMoving: true, isSprinting, drainMult });
    if (res.hydWarnMin === null && pHyd.hydration <= 25) res.hydWarnMin = +(t / 60).toFixed(2);
    if (res.hydEmptyMin === null && pHyd.hydration <= 0) {
      res.hydEmptyMin = +(t / 60).toFixed(2);
      emptyAt = t;
    }
    if (emptyAt !== null && res.dehydrationDmgTimeSec === null && (out.dehydratedTick || pHyd.hp < startHp)) {
      res.dehydrationDmgTimeSec = +(t - emptyAt).toFixed(2);
      break;
    }
  }

  // Pass 2: Energy full -> warning (25%) -> empty (0%) (keep hydration topped up so player survives to 12 min)
  const pEng = new Player(190, 660);
  t = 0;
  while (t < 1000) {
    t += dt;
    pEng.hydration = 100;
    pEng.updateNeeds(dt, { isMoving: true, isSprinting, drainMult });
    if (res.engWarnMin === null && pEng.energy <= 25) res.engWarnMin = +(t / 60).toFixed(2);
    if (res.engEmptyMin === null && pEng.energy <= 0) {
      res.engEmptyMin = +(t / 60).toFixed(2);
      res.effMaxStaminaAtEmpty = pEng.getEffectiveMaxStamina();
      break;
    }
  }
  return res;
}

function within10Pct(actual, expected) {
  return actual !== null && Math.abs(actual - expected) <= expected * 0.10;
}

let failures = 0;
function check(label, pass, detail) {
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${label}: ${detail}`);
  if (!pass) failures++;
}

const walk = simulateNeed({ isSprinting: false, drainMult: 1.0 });
const sprint = simulateNeed({ isSprinting: true, drainMult: 1.0 });

console.log('=== BELUM: PROTOCOL ZERO — SURVIVAL NEEDS SIMULATION (OPERATOR) ===');
console.log(`Walking  | Hydration: full->warning ${walk.hydWarnMin} min, full->empty ${walk.hydEmptyMin} min | Energy: full->warning ${walk.engWarnMin} min, full->empty ${walk.engEmptyMin} min`);
console.log(`Sprinting| Hydration: full->warning ${sprint.hydWarnMin} min, full->empty ${sprint.hydEmptyMin} min | Energy: full->warning ${sprint.engWarnMin} min, full->empty ${sprint.engEmptyMin} min`);

check('Hydration walking -> warning (25%)', within10Pct(walk.hydWarnMin, 6.0), `${walk.hydWarnMin} min (target 6.0 min ±10%)`);
check('Hydration walking -> empty (0%)', within10Pct(walk.hydEmptyMin, 8.0), `${walk.hydEmptyMin} min (target 8.0 min ±10%)`);
check('Hydration sprinting -> warning (25%) [2x drain]', within10Pct(sprint.hydWarnMin, 3.0), `${sprint.hydWarnMin} min (target 3.0 min ±10%)`);
check('Hydration sprinting -> empty (0%) [2x drain]', within10Pct(sprint.hydEmptyMin, 4.0), `${sprint.hydEmptyMin} min (target 4.0 min ±10%)`);
check('Energy walking -> warning (25%)', within10Pct(walk.engWarnMin, 9.0), `${walk.engWarnMin} min (target 9.0 min ±10%)`);
check('Energy walking -> empty (0%)', within10Pct(walk.engEmptyMin, 12.0), `${walk.engEmptyMin} min (target 12.0 min ±10%)`);
check('Energy sprinting -> warning (25%)', within10Pct(sprint.engWarnMin, 9.0), `${sprint.engWarnMin} min (target 9.0 min ±10%)`);
check('Energy sprinting -> empty (0%)', within10Pct(sprint.engEmptyMin, 12.0), `${sprint.engEmptyMin} min (target 12.0 min ±10%)`);
check('At empty hydration: 1 HP lost every 20s', within10Pct(walk.dehydrationDmgTimeSec, 20.0), `${walk.dehydrationDmgTimeSec}s (target 20.0s ±10%)`);
check('At empty energy: max stamina -40%', Math.abs(walk.effMaxStaminaAtEmpty - 60) < 0.01, `${walk.effMaxStaminaAtEmpty} (target 60)`);

if (failures > 0) {
  console.error(`\n>>> ${failures} NEEDS CHECK(S) FAILED <<<`);
  process.exit(1);
}
console.log('\n>>> ALL SURVIVAL NEEDS CHECKS PASSED <<<');
process.exit(0);
