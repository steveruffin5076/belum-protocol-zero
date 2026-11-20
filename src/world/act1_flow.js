// src/world/act1_flow.js - Act 1 Room Graph, Progression Gates, Required Route & Narrative Beats (Task 4 + Fix 2)
(function (global) {
  'use strict';

  const ACT1_FLOW = {
    version: 2,
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
      { from: 's1_riverbank', to: 's2_outpost_yard', requires: ['bolt_cutters', 's1_breaker_north', 's1_breaker_south'], gateId: 'outpost_fence_gate' },
      { from: 's2_outpost_yard', to: 's2_field_lab', requires: [] },
      { from: 's2_outpost_yard', to: 's2_diesel_backroom', requires: [] },
      { from: 's2_outpost_yard', to: 's3_infected_ravine', requires: ['drive_01'], gateId: 'outpost_east_gate' },
      { from: 's3_infected_ravine', to: 's3_spore_sinkhole', requires: [] },
      { from: 's3_infected_ravine', to: 's3_pump_station', requires: [] },
      { from: 's3_infected_ravine', to: 's4_bunker_yard', requires: ['pump_powered', 's3_gate_ctrl'], gateId: 'ravine_east_gate' },
      { from: 's3_pump_station', to: 's4_culvert_bypass', requires: ['pump_powered'], gateId: 'culvert_grate' },
      { from: 's4_culvert_bypass', to: 's4_bunker_yard', requires: [] },
      { from: 's4_bunker_yard', to: 's4_guard_tower', requires: [] },
      { from: 's4_bunker_yard', to: 's4_extraction', requires: ['tier1_keycard', 's4_relay_off', 's4_hydraulic_a', 's4_override_token', 's4_hydraulic_b', 's4_purge_valve'], gateId: 'blast_gate' }
    ],
    items: [
      // Sector 1 required detour chain
      { id: 'locker_key', node: 's1_riverbank', interactableId: 'pickup_locker_key', required: true },
      { id: 'bolt_cutters', node: 's1_fishing_hut', interactableId: 'pickup_bolt_cutters', requires: ['locker_key'], required: true },
      { id: 's1_breaker_north', node: 's1_riverbank', interactableId: 'obj_s1_breaker_north', requires: ['bolt_cutters'], required: true },
      { id: 's1_breaker_south', node: 's1_riverbank', interactableId: 'obj_s1_breaker_south', requires: ['bolt_cutters'], required: true },
      { id: 's1_body_cam', node: 's1_riverbank', interactableId: 'sec_body_cam', required: false },

      // Sector 2 required detour chain (generator shutoff -> Field Lab Drive 01 -> Basha decrypt -> Lab Safe)
      { id: 'shed_key', node: 's2_outpost_yard', interactableId: 'pickup_shed_key', required: true },
      { id: 'generator_off', node: 's2_diesel_backroom', interactableId: 'obj_generator', requires: ['shed_key'], required: true },
      { id: 'drive_01', node: 's2_field_lab', interactableId: 'pickup_drive_01', requires: ['generator_off'], required: true },
      { id: 'safe_code', node: 's2_field_lab', derivedFrom: ['drive_01'], required: true },
      { id: 'tier1_keycard_safe', grants: 'tier1_keycard', node: 's2_field_lab', interactableId: 'obj_lab_safe', requires: ['safe_code'], required: true },
      { id: 'tier1_keycard_ward', grants: 'tier1_keycard', node: 's4_bunker_yard', source: 'commander_ward_body', requires: [], required: false },
      { id: 's2_sample_photos', node: 's2_field_lab', interactableId: 'sec_photo_samples', required: false },

      // Sector 3 required detour chain (watchtower pump fuse + intake sluice + ravine breaker -> pump station -> gate control)
      { id: 'pump_fuse', node: 's3_infected_ravine', interactableId: 'pickup_pump_fuse', required: true },
      { id: 'intake_valve', node: 's3_infected_ravine', interactableId: 'obj_intake_valve', required: true },
      { id: 'ravine_breaker', node: 's3_infected_ravine', interactableId: 'obj_ravine_breaker', requires: ['pump_fuse'], required: true },
      { id: 'pump_powered', node: 's3_pump_station', interactableId: 'obj_pump_station', requires: ['pump_fuse', 'intake_valve', 'ravine_breaker'], required: true },
      { id: 's3_gate_ctrl', node: 's3_infected_ravine', interactableId: 'obj_ravine_gate_ctrl', requires: ['pump_powered'], required: true },
      { id: 's3_scientist_intel', node: 's3_infected_ravine', interactableId: 'sec_free_scientist', required: false },

      // Sector 4 required detour chain (interlock relay + hydraulic locks A & B + truck override + pressure purge -> Blast Gate terminal)
      { id: 's4_relay_off', node: 's4_guard_tower', interactableId: 'obj_s4_relay_tower', required: true },
      { id: 's4_hydraulic_a', node: 's4_bunker_yard', interactableId: 'obj_s4_hydraulic_a', required: true },
      { id: 's4_override_token', node: 's4_bunker_yard', interactableId: 'obj_s4_override_truck', required: true },
      { id: 's4_hydraulic_b', node: 's4_bunker_yard', interactableId: 'obj_s4_hydraulic_b', required: true },
      { id: 's4_purge_valve', node: 's4_bunker_yard', interactableId: 'obj_s4_purge_valve', requires: ['s4_hydraulic_a', 's4_hydraulic_b'], required: true },
      { id: 's4_gps_planted', node: 's4_bunker_yard', interactableId: 'sec_gps_truck', required: false },
      { id: 's4_jammer_parts', node: 's4_guard_tower', interactableId: 'cache_s4_tower', required: false }
    ],
    // Ordered required route walked by tools/route_length_check.js (A* on 10 px grid, gates open only after requirement met)
    requiredRoute: [
      // Sector 1
      { id: 's1_locker_key', sector: 1, label: 'North Sentry Crate (Boat Locker Key)', interactableId: 'pickup_locker_key' },
      { id: 's1_bolt_cutters', sector: 1, label: 'Flooded Fishing Hut Boat Locker (Bolt Cutters)', interactableId: 'pickup_bolt_cutters' },
      { id: 's1_breaker_n', sector: 1, label: 'NW Fence Voltage Feeder (Cut)', interactableId: 'obj_s1_breaker_north' },
      { id: 's1_breaker_s', sector: 1, label: 'SE Outpost Grounding Relay (Cut)', interactableId: 'obj_s1_breaker_south' },
      { id: 's1_cut_fence', sector: 1, label: 'Outpost Fence Gate (Cut & Open)', interactableId: 'obj_cut_fence', opensGates: ['outpost_fence_gate'] },
      // Sector 2
      { id: 's2_shed_key', sector: 2, label: 'NE Barracks Lockbox (Diesel Shed Key)', interactableId: 'pickup_shed_key' },
      { id: 's2_generator', sector: 2, label: 'SW Diesel Generator (Shut Down Power)', interactableId: 'obj_generator' },
      { id: 's2_drive_01', sector: 2, label: 'NW Field Lab Back Room (Encrypted Drive 01)', interactableId: 'pickup_drive_01' },
      { id: 's2_basha_decrypt', sector: 2, label: 'SE Outpost Basha Site (Decrypt Drive 01)', bashaId: 'basha_s2' },
      { id: 's2_lab_safe', sector: 2, label: 'NE VBS Field Lab Safe (Tier-1 Keycard)', interactableId: 'obj_lab_safe' },
      { id: 's2_gate', sector: 2, label: 'Ravine Checkpoint Gate (Unlock)', interactableId: 'obj_outpost_gate', opensGates: ['outpost_east_gate'] },
      // Sector 3
      { id: 's3_pump_fuse', sector: 3, label: 'NE Ravine Watchtower (High-Amp Pump Fuse)', interactableId: 'pickup_pump_fuse' },
      { id: 's3_intake_valve', sector: 3, label: 'SW Ravine Intake Sluice (Clear Line)', interactableId: 'obj_intake_valve' },
      { id: 's3_ravine_breaker', sector: 3, label: 'NW Ravine Circuit Breaker (Install Fuse)', interactableId: 'obj_ravine_breaker' },
      { id: 's3_pump_station', sector: 3, label: 'SE Ravine Pump Station (Drain Culvert)', interactableId: 'obj_pump_station', opensGates: ['culvert_entry_grate', 'culvert_grate'] },
      { id: 's3_gate_ctrl', sector: 3, label: 'NE Ravine Perimeter Gate Release', interactableId: 'obj_ravine_gate_ctrl', opensGates: ['ravine_east_gate'] },
      { id: 's3_cross_gate', sector: 3, label: 'Cross Perimeter Gate into Sector 4', x: 3130, y: 650 },
      // Sector 4
      { id: 's4_relay_tower', sector: 4, label: 'NE Guard Tower Interlock Relay', interactableId: 'obj_s4_relay_tower' },
      { id: 's4_hydraulic_a', sector: 4, label: 'SW Bunker Hydraulic Lock A', interactableId: 'obj_s4_hydraulic_a' },
      { id: 's4_override_truck', sector: 4, label: 'NW Command Truck Override Token', interactableId: 'obj_s4_override_truck' },
      { id: 's4_hydraulic_b', sector: 4, label: 'SE East Bunker Hydraulic Lock B', interactableId: 'obj_s4_hydraulic_b' },
      { id: 's4_purge_valve', sector: 4, label: 'West Bunker Pressure Purge Manifold', interactableId: 'obj_s4_purge_valve' },
      { id: 's4_terminal', sector: 4, label: 'Blast Gate Terminal (Swipe Keycard & 15s Hold)', interactableId: 'obj_terminal', opensGates: ['blast_gate'] },
      { id: 's4_extract', sector: 4, label: 'Facility Sub-Zero Extraction Zone', x: 4040, y: 660 }
    ],
    beats: [
      { sector: 1, title: 'Riverbank Insertion', pacing: 'Low tension — acquire Boat Locker Key, salvage Bolt Cutters, cut north/south fence relays, breach Outpost Fence.' },
      { sector: 2, title: 'Logging Outpost & Field Lab', pacing: 'Rising tension — grab Shed Key, sabotage Diesel Generator, recover Drive 01, decrypt at Basha, crack Lab Safe.' },
      { sector: 3, title: 'Infected Ravine', pacing: 'Spike — salvage Pump Fuse, clear intake sluice, flip north breaker, power Pump Station past boars & spores.' },
      { sector: 4, title: 'Temenggor Blast Gate', pacing: 'Climax — release guard-tower relay, hydraulic locks & command override under drone/Ward patrols, swipe terminal & hold 15 s.' }
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
