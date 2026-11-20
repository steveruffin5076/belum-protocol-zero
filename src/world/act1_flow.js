// src/world/act1_flow.js - Act 1 Room Graph, Progression Gates & Narrative Beat List (Task 4)
(function (global) {
  'use strict';

  const ACT1_FLOW = {
    version: 1,
    startNode: 's1_riverbank',
    goalNode: 's4_extraction',
    nodes: [
      { id: 's1_riverbank', sector: 1, name: 'Sungai Belum Riverbank', sideArea: false },
      { id: 's1_fishing_hut', sector: 1, name: 'Flooded Fishing Hut & Boat Locker', sideArea: true },
      { id: 's2_outpost_yard', sector: 2, name: 'Logging Outpost Yard', sideArea: false },
      { id: 's2_field_lab', sector: 2, name: 'VBS Field Lab Tent', sideArea: false },
      { id: 's2_diesel_backroom', sector: 2, name: 'Diesel Shed Back Room', sideArea: true },
      { id: 's3_infected_ravine', sector: 3, name: 'Infected Limestone Ravine', sideArea: false },
      { id: 's3_spore_sinkhole', sector: 3, name: 'Spore-Filled Sinkhole', sideArea: true },
      { id: 's3_pump_station', sector: 3, name: 'Ravine Pump Station', sideArea: false },
      { id: 's4_bunker_yard', sector: 4, name: 'Temenggor Perimeter Yard', sideArea: false },
      { id: 's4_guard_tower', sector: 4, name: 'Perimeter Guard Tower', sideArea: true },
      { id: 's4_culvert_bypass', sector: 4, name: 'Drained Drainage Culvert', sideArea: true },
      { id: 's4_extraction', sector: 4, name: 'Facility Sub-Zero Extraction Zone', sideArea: false }
    ],
    edges: [
      { from: 's1_riverbank', to: 's1_fishing_hut', requires: [] },
      { from: 's1_fishing_hut', to: 's1_riverbank', requires: [] },
      { from: 's1_riverbank', to: 's2_outpost_yard', requires: ['bolt_cutters'], gateId: 'outpost_fence_gate' },
      { from: 's2_outpost_yard', to: 's2_field_lab', requires: [] },
      { from: 's2_outpost_yard', to: 's2_diesel_backroom', requires: [] },
      { from: 's2_outpost_yard', to: 's3_infected_ravine', requires: ['drive_01'], gateId: 'outpost_east_gate' },
      { from: 's3_infected_ravine', to: 's3_spore_sinkhole', requires: [] },
      { from: 's3_infected_ravine', to: 's3_pump_station', requires: [] },
      { from: 's3_infected_ravine', to: 's4_bunker_yard', requires: ['pump_powered'], gateId: 'ravine_east_gate' },
      { from: 's3_pump_station', to: 's4_culvert_bypass', requires: ['pump_powered'], gateId: 'culvert_grate' },
      { from: 's4_culvert_bypass', to: 's4_bunker_yard', requires: [] },
      { from: 's4_bunker_yard', to: 's4_guard_tower', requires: [] },
      { from: 's4_bunker_yard', to: 's4_extraction', requires: ['tier1_keycard'], gateId: 'blast_gate' }
    ],
    items: [
      { id: 'bolt_cutters', node: 's1_fishing_hut', interactableId: 'pickup_bolt_cutters', required: true },
      { id: 's1_body_cam', node: 's1_riverbank', interactableId: 'sec_body_cam', required: false },
      { id: 'drive_01', node: 's2_field_lab', interactableId: 'pickup_drive_01', required: true },
      { id: 'safe_code', node: 's2_field_lab', derivedFrom: ['drive_01'], required: true },
      { id: 'tier1_keycard_safe', grants: 'tier1_keycard', node: 's2_field_lab', interactableId: 'obj_lab_safe', requires: ['safe_code'], required: true },
      { id: 'tier1_keycard_ward', grants: 'tier1_keycard', node: 's4_bunker_yard', source: 'commander_ward_body', requires: [], required: false },
      { id: 's2_sample_photos', node: 's2_field_lab', interactableId: 'sec_photo_samples', required: false },
      { id: 'pump_powered', node: 's3_pump_station', interactableId: 'obj_pump_station', required: true },
      { id: 's3_scientist_intel', node: 's3_infected_ravine', interactableId: 'sec_free_scientist', required: false },
      { id: 's4_gps_planted', node: 's4_bunker_yard', interactableId: 'sec_gps_truck', required: false },
      { id: 's4_jammer_parts', node: 's4_guard_tower', interactableId: 'cache_s4_tower', required: false }
    ],
    beats: [
      { sector: 1, title: 'Riverbank Insertion', pacing: 'Low tension — learn cover, salvage bolt cutters in flooded fishing hut, cut outpost fence.' },
      { sector: 2, title: 'Logging Outpost & Field Lab', pacing: 'Rising tension — floodlights & patrols; recover Drive 01, decrypt at Field Cache for lab safe code (4719).' },
      { sector: 3, title: 'Infected Ravine', pacing: 'Spike — mutated boars, spore sinkhole & surveillance drone; power pump station to drain culvert.' },
      { sector: 4, title: 'Temenggor Blast Gate', pacing: 'Climax — acquire Tier-1 Keycard (safe or Ward), evade drone/tripwires, swipe terminal & survive 15 s hold.' }
    ]
  };

  /**
   * Fixed-point BFS reachability validator.
   * Proves goalNode is reachable from startNode without any item sitting behind its own gate.
   * Optional opts.excludeItems (Set or Array of item/token ids) allows failure-mode testing.
   */
  function validateFlow(flow, opts) {
    const f = flow || ACT1_FLOW;
    const excluded = new Set((opts && opts.excludeItems) || []);
    const reachable = new Set([f.startNode]);
    const tokens = new Set();
    const acquiredItems = new Set();
    const trace = [];

    let changed = true;
    let guard = 0;
    while (changed && guard < 64) {
      changed = false;
      guard++;

      // 1. Collect any item/flag attainable in currently reachable nodes
      for (let i = 0; i < f.items.length; i++) {
        const it = f.items[i];
        if (excluded.has(it.id)) continue;
        if (acquiredItems.has(it.id)) continue;
        const tokenName = it.grants || it.id;
        if (excluded.has(tokenName)) continue;
        if (!reachable.has(it.node)) continue;
        const reqs = (it.requires || []).concat(it.derivedFrom || []);
        if (reqs.every((r) => tokens.has(r))) {
          acquiredItems.add(it.id);
          tokens.add(tokenName);
          trace.push(`acquire:${it.id}@${it.node}`);
          changed = true;
        }
      }

      // 2. Traverse edges whose gate requirements are satisfied
      for (let i = 0; i < f.edges.length; i++) {
        const e = f.edges[i];
        if (!reachable.has(e.from) || reachable.has(e.to)) continue;
        const reqs = e.requires || [];
        if (reqs.every((r) => tokens.has(r))) {
          reachable.add(e.to);
          trace.push(`enter:${e.to}`);
          changed = true;
        }
      }
    }

    const goalReached = reachable.has(f.goalNode);
    const missingRequired = f.items
      .filter((it) => it.required && !acquiredItems.has(it.id))
      .map((it) => it.id);

    return {
      ok: goalReached && missingRequired.length === 0,
      goalReached,
      reachableNodes: Array.from(reachable),
      acquiredTokens: Array.from(tokens),
      missingRequired,
      trace
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ACT1_FLOW, validateFlow };
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.ACT1_FLOW = ACT1_FLOW;
  global.BelumGame.validateAct1Flow = validateFlow;
})(typeof window !== 'undefined' ? window : globalThis);
