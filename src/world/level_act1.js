// src/world/level_act1.js - 4 Continuous Sectors: Riverbank -> Logging Outpost -> Infected Ravine -> Blast Gate
(function (global) {
  'use strict';

  const Obstacle25D =
    (global.BelumGame && global.BelumGame.Obstacle25D) ||
    (typeof require !== 'undefined' ? require('./obstacles.js') : null);
  const Mercenary =
    (global.BelumGame && global.BelumGame.Mercenary) ||
    (typeof require !== 'undefined' ? require('../entities/mercenary.js') : null);
  const MutatedBoar =
    (global.BelumGame && global.BelumGame.MutatedBoar) ||
    (typeof require !== 'undefined' ? require('../entities/boar.js') : null);
  const SurveillanceDrone =
    (global.BelumGame && global.BelumGame.SurveillanceDrone) ||
    (typeof require !== 'undefined' ? require('../entities/drone.js') : null);

  function createAct1Level() {
    const worldW = 4200;
    const worldH = 1320;

    const sectors = [
      {
        id: 1,
        x: 0,
        y: 0,
        width: 1050,
        height: worldH,
        label: 'SECTOR 1 // SUNGAI BELUM RIVERBANK',
        groundTint: 'rgba(244, 236, 216, 0.35)'
      },
      {
        id: 2,
        x: 1050,
        y: 0,
        width: 1100,
        height: worldH,
        label: 'SECTOR 2 // ABANDONED LOGGING OUTPOST & FIELD LAB',
        groundTint: 'rgba(235, 224, 198, 0.38)'
      },
      {
        id: 3,
        x: 2150,
        y: 0,
        width: 1050,
        height: worldH,
        label: 'SECTOR 3 // THE INFECTED RAVINE (BT-09 SPORE ZONE)',
        groundTint: 'rgba(238, 221, 206, 0.35)'
      },
      {
        id: 4,
        x: 3200,
        y: 0,
        width: 1000,
        height: worldH,
        label: 'SECTOR 4 // TEMENGGOR PERIMETER BLAST GATE',
        groundTint: 'rgba(229, 223, 208, 0.45)'
      }
    ];

    const riverZone = { x: 0, y: 0, width: 135, height: worldH };

    const paths = [
      { x: 135, y: 585, width: 950, height: 150, fill: 'rgba(214, 198, 166, 0.35)' },
      { x: 1050, y: 550, width: 1100, height: 220, fill: 'rgba(205, 190, 158, 0.42)' },
      { x: 2150, y: 570, width: 1050, height: 190, fill: 'rgba(216, 192, 168, 0.35)' },
      { x: 3200, y: 490, width: 920, height: 320, fill: 'rgba(196, 190, 174, 0.45)' }
    ];

    const culvertZone = { x: 3240, y: 980, width: 640, height: 110 };
    const extractionZone = { x: 3960, y: 540, width: 210, height: 240 };

    // Build 2.5D obstacles & cover props across all 4 sectors
    const obsSpecs = [
      // === SECTOR 1: Sungai Belum Riverbank ===
      { type: 'canopy_tree', x: 540, y: 175, width: 160, height: 240, colX: 595, colY: 345, colW: 54, colH: 58 },
      { type: 'mud_rocks', x: 155, y: 410, width: 140, height: 70 },
      { type: 'mud_rocks', x: 465, y: 860, width: 140, height: 70 },
      { type: 'bamboo', x: 165, y: 180, width: 120, height: 125 },
      { type: 'bamboo', x: 310, y: 140, width: 130, height: 130 },
      { type: 'bamboo', x: 155, y: 1135, width: 140, height: 130 },
      { type: 'hollow_log', x: 340, y: 520, width: 165, height: 84 },
      { type: 'fern', x: 370, y: 695, width: 118, height: 86 },
      { type: 'fern', x: 585, y: 540, width: 120, height: 86 },
      { type: 'hollow_log', x: 690, y: 745, width: 165, height: 84 },
      { type: 'bamboo', x: 840, y: 260, width: 130, height: 130 },
      { type: 'fern', x: 865, y: 620, width: 116, height: 86 },
      { type: 'bamboo', x: 740, y: 990, width: 135, height: 130 },
      // Sector 1 Side Area: Flooded Fishing Hut
      { type: 'fishing_hut', x: 190, y: 920, width: 160, height: 95, label: 'FLOODED FISHING HUT' },

      // === SECTOR 2: Abandoned Logging Outpost & Field Lab ===
      { type: 'barracks', x: 1140, y: 210, width: 280, height: 150, label: 'LOGGING BARRACKS' },
      { type: 'barracks', x: 1580, y: 195, width: 250, height: 150, label: 'VBS FIELD LAB TENT' },
      { type: 'generator_shed', x: 1220, y: 900, width: 230, height: 135, label: 'DIESEL GENERATOR SHED' },
      { type: 'fence', x: 1065, y: 390, width: 26, height: 150 },
      // Task 4 Gate 1->2: Outpost Chain-Link Gate (requires Bolt Cutters)
      { id: 'outpost_fence_gate', type: 'sector_gate', x: 1065, y: 540, width: 26, height: 220, solid: true, label: 'OUTPOST FENCE' },
      { type: 'fence', x: 1065, y: 760, width: 26, height: 180 },
      { type: 'hollow_log', x: 1360, y: 610, width: 155, height: 80 },
      { type: 'fern', x: 1150, y: 660, width: 118, height: 84 },
      { type: 'fern', x: 1560, y: 730, width: 122, height: 88 },
      { type: 'fern', x: 1840, y: 465, width: 116, height: 84 },
      { type: 'bamboo', x: 1960, y: 190, width: 135, height: 130 },
      { type: 'bamboo', x: 1930, y: 960, width: 135, height: 130 },
      // Task 4 Gate 2->3: Outpost East Security Gate (requires Drive 01)
      { id: 'outpost_east_gate', type: 'sector_gate', x: 2135, y: 540, width: 26, height: 220, solid: true, label: 'RAVINE CHECKPOINT' },

      // === SECTOR 3: The Infected Ravine (Spore Zone & Boars) ===
      { type: 'bunker_wall', x: 2180, y: 90, width: 960, height: 110 },
      { type: 'bunker_wall', x: 2180, y: 1080, width: 960, height: 120 },
      { type: 'canopy_tree', x: 2220, y: 215, width: 160, height: 240, colX: 2275, colY: 385, colW: 54, colH: 58 },
      { type: 'mud_rocks', x: 2775, y: 895, width: 140, height: 70 },
      { type: 'hollow_log', x: 2290, y: 470, width: 160, height: 82 },
      { type: 'fern', x: 2255, y: 685, width: 124, height: 88 },
      { type: 'fern', x: 2555, y: 410, width: 124, height: 88 },
      { type: 'hollow_log', x: 2630, y: 810, width: 165, height: 84 },
      { type: 'fern', x: 2875, y: 430, width: 120, height: 86 },
      { type: 'bamboo', x: 2430, y: 910, width: 125, height: 125 },
      { type: 'fence', x: 3090, y: 230, width: 26, height: 270 },
      // Task 4 Gate 3->4: Ravine East Gate (powered by Pump Station)
      { id: 'ravine_east_gate', type: 'sector_gate', x: 3090, y: 500, width: 26, height: 300, solid: true, label: 'PERIMETER GATE' },
      { type: 'fence', x: 3090, y: 800, width: 26, height: 250 },

      // === SECTOR 4: Temenggor Perimeter Blast Gate ===
      { type: 'bunker_wall', x: 3260, y: 180, width: 650, height: 95 },
      { type: 'bunker_wall', x: 3825, y: 275, width: 90, height: 255 },
      { type: 'bunker_wall', x: 3825, y: 785, width: 90, height: 195 },
      { type: 'bunker_wall', x: 3260, y: 1095, width: 655, height: 95 },
      // Sector 4 Secondary & Side Area Props
      { type: 'radio_truck', x: 3340, y: 295, width: 150, height: 74, label: "WARD'S RADIO TRUCK" },
      { type: 'guard_tower', x: 3690, y: 285, width: 86, height: 96, label: 'GUARD TOWER' },
      { type: 'hollow_log', x: 3350, y: 690, width: 155, height: 80 },
      { type: 'fern', x: 3320, y: 465, width: 120, height: 86 },
      { type: 'fern', x: 3560, y: 820, width: 120, height: 86 },
      // Flooded Side Drainage Culvert Grate (Drained by Sector 3 Pump Station)
      { id: 'culvert_grate', type: 'culvert_grate', x: 3560, y: 985, width: 32, height: 100, solid: true },
      // Concrete Temenggor Blast Gate Door
      { id: 'blast_gate', type: 'blast_gate', x: 3825, y: 530, width: 95, height: 255, solid: true },
      // Task 6c: One hidden Basha Site (Field Cache) per sector
      { id: 'obs_basha_s1', type: 'basha_site', x: 440, y: 745, width: 108, height: 76, solid: false, blocksVision: false, blocksProjectiles: false, label: 'BASHA SITE (S1)' },
      { id: 'obs_basha_s2', type: 'basha_site', x: 1830, y: 905, width: 108, height: 76, solid: false, blocksVision: false, blocksProjectiles: false, label: 'BASHA SITE (S2)' },
      { id: 'obs_basha_s3', type: 'basha_site', x: 2215, y: 890, width: 108, height: 76, solid: false, blocksVision: false, blocksProjectiles: false, label: 'BASHA SITE (S3)' },
      { id: 'obs_basha_s4', type: 'basha_site', x: 3270, y: 850, width: 108, height: 76, solid: false, blocksVision: false, blocksProjectiles: false, label: 'BASHA SITE (S4)' }
    ];

    const bashaSites = [
      { id: 'basha_s1', sector: 1, x: 494, y: 785, label: 'Riverbank Basha Site', discovered: false, restedThisVisit: false },
      { id: 'basha_s2', sector: 2, x: 1884, y: 945, label: 'Outpost Perimeter Basha', discovered: false, restedThisVisit: false },
      { id: 'basha_s3', sector: 3, x: 2269, y: 930, label: 'Ravine Ledge Basha', discovered: false, restedThisVisit: false },
      { id: 'basha_s4', sector: 4, x: 3324, y: 890, label: 'Bunker Approach Basha', discovered: false, restedThisVisit: false }
    ];

    const obstacles = Obstacle25D ? obsSpecs.map((s) => new Obstacle25D(s)) : obsSpecs;

    // Toxic Rafflesia Spore Zones (Sector 3)
    const sporeZones = [
      { x: 2475, y: 635, radius: 74, dps: 1 },
      { x: 2770, y: 560, radius: 78, dps: 1 },
      { x: 2665, y: 745, radius: 66, dps: 1 }
    ];

    // Floodlights (Sector 2 & 4 - Sector 2 lights linked to Diesel Generator)
    const floodlights = [
      { id: 'fl_1', sector: 2, x: 1410, y: 365, range: 240, baseAngle: Math.PI * 0.5, sweepArc: 0.45, sweepSpeed: 0.65, active: true },
      { id: 'fl_2', sector: 2, x: 1710, y: 355, range: 250, baseAngle: Math.PI * 0.55, sweepArc: 0.4, sweepSpeed: 0.8, active: true },
      { id: 'fl_3', sector: 4, x: 3600, y: 280, range: 280, baseAngle: Math.PI * 0.55, sweepArc: 0.5, sweepSpeed: 0.75, active: true }
    ];

    // Red Laser Tripwires (Sector 4)
    const tripwires = [
      { id: 'lw_1', x1: 3500, y1: 520, x2: 3500, y2: 650, active: true },
      { id: 'lw_2', x1: 3710, y1: 690, x2: 3710, y2: 810, active: true }
    ];

    // Interactables, Objectives & Side-Area Caches (Task 4: floor pickup_keycard removed!)
    const interactables = [
      // Sector 1: Riverbank + Flooded Fishing Hut side area
      { id: 'pickup_parang', type: 'weapon_parang', x: 275, y: 635, badge: 'PRG', label: 'Steel Parang', highlight: true, collected: false },
      { id: 'pickup_crossbow', type: 'weapon_crossbow', x: 500, y: 475, badge: 'BOW', label: 'Crossbow (+5 Bolts)', highlight: true, collected: false },
      { id: 'pickup_bolt_cutters', type: 'bolt_cutters', x: 245, y: 1035, badge: 'CUT', label: 'Boat Locker [Bolt Cutters]', highlight: true, collected: false },
      { id: 'cache_s1_footlocker', type: 'side_footlocker', x: 320, y: 1035, badge: 'FLK', label: 'Fishing Hut Footlocker', collected: false },
      { id: 'sec_body_cam', type: 'sec_body_cam', x: 840, y: 920, badge: 'CAM', label: 'VBS Courier Body Camera', highlight: true, collected: false },
      { id: 'obj_cut_fence', type: 'cut_fence', x: 1035, y: 645, badge: 'FNC', label: 'Outpost Fence [Cut w/ Bolt Cutters]', highlight: true, collected: false },
      { id: 'pickup_water_1', type: 'dirty_water', x: 245, y: 800, badge: 'H2O', label: 'Rainwater Catch', collected: false },
      { id: 'pickup_bamboo_1', type: 'bamboo_shoots', x: 890, y: 420, badge: 'BMB', label: 'Wild Bamboo Shoots', collected: false },
      { id: 'pickup_can_s1', type: 'salvage_can_pebbles', x: 605, y: 860, badge: 'CAN', label: 'Empty Can & Pebbles', collected: false },

      // Sector 2: Logging Outpost + Field Lab + Diesel Shed Back Room
      { id: 'pickup_drive_01', type: 'encrypted_drive', x: 1705, y: 385, badge: 'DRV', label: 'Encrypted Drive 01', highlight: true, collected: false },
      { id: 'obj_lab_safe', type: 'lab_safe', x: 1635, y: 385, badge: 'SAF', label: 'VBS Lab Safe [4-Digit Code]', highlight: true, collected: false },
      { id: 'sec_photo_samples', type: 'sec_photo_samples', x: 1765, y: 390, badge: 'PHO', label: 'Lab Samples [Hold E 2s to Photograph]', highlight: true, collected: false },
      { id: 'pickup_pistol', type: 'weapon_pistol', x: 1475, y: 385, badge: '9MM', label: 'Suppressed 9mm (+8)', highlight: true, collected: false },
      { id: 'obj_generator', type: 'generator', x: 1335, y: 870, badge: 'GEN', label: 'Diesel Generator [Sabotage]', highlight: true, collected: false },
      { id: 'pickup_diesel_rag', type: 'salvage_diesel_rag', x: 1245, y: 885, badge: 'DSL', label: 'Diesel Fuel & Cloth Rag', collected: false },
      { id: 'pickup_flare_s2', type: 'salvage_flare', x: 1555, y: 860, badge: 'FLR', label: 'Road Flare & Wire', collected: false },
      { id: 'pickup_filter_mask', type: 'filter_mask', x: 2010, y: 440, badge: 'MSK', label: 'Respirator Filter Mask (90s)', highlight: true, collected: false },
      { id: 'cache_s2_ammo', type: 'side_ammo_can', x: 1265, y: 1065, badge: 'AMO', label: 'Shed Back Room Ammo Can', collected: false },
      { id: 'cache_s2_med', type: 'side_med_case', x: 1385, y: 1065, badge: 'MED', label: 'Shed Back Room Medical Case', collected: false },
      { id: 'pickup_wire_1', type: 'scrap_wire', x: 1845, y: 840, badge: 'WIR', label: 'Scrap Wire', collected: false },
      { id: 'obj_outpost_gate', type: 'outpost_gate', x: 2105, y: 645, badge: 'GAT', label: 'Ravine Checkpoint Gate [Need Drive 01]', highlight: true, collected: false },

      // Sector 3: Infected Ravine + Pump Station + Spore Sinkhole + Captured Scientist
      { id: 'pickup_rocks_1', type: 'decoy_rocks', x: 2295, y: 605, badge: 'NOI', label: 'Noisemakers (+5)', highlight: true, collected: false },
      { id: 'pickup_water_2', type: 'dirty_water', x: 2390, y: 780, badge: 'H2O', label: 'Ravine Runoff', collected: false },
      { id: 'sec_free_scientist', type: 'sec_free_scientist', x: 2340, y: 375, badge: 'SCI', label: 'Captured VBS Scientist [Free]', highlight: true, collected: false },
      { id: 'cache_s3_cold_storage', type: 'side_cold_storage', x: 2665, y: 745, badge: 'LAB', label: 'Sinkhole Cold-Storage Unit', collected: false },
      { id: 'pickup_radio_parts_s3', type: 'salvage_radio_parts', x: 2790, y: 890, badge: 'RAD', label: 'Radio Parts & Battery', collected: false },
      { id: 'obj_pump_station', type: 'pump_station', x: 2945, y: 955, badge: 'PMP', label: 'Pump Station [Restore Power]', highlight: true, collected: false },
      { id: 'pickup_drive_02', type: 'encrypted_drive', x: 2985, y: 875, badge: 'DRV', label: 'Encrypted Drive 02', highlight: true, collected: false },

      // Sector 4: Blast Gate + Radio Truck + Guard Tower
      { id: 'sec_gps_truck', type: 'sec_gps_truck', x: 3420, y: 380, badge: 'GPS', label: "Ward's Radio Truck [Plant GPS]", highlight: true, collected: false },
      { id: 'cache_s4_tower', type: 'side_guard_tower', x: 3730, y: 395, badge: 'JAM', label: 'Guard Tower [Radio Jammer Parts]', collected: false },
      { id: 'obj_culvert', type: 'culvert_unlock', x: 3525, y: 1030, badge: 'CLV', label: 'Culvert Hatch [Drained by Pump]', highlight: true, collected: false },
      { id: 'obj_terminal', type: 'blast_terminal', x: 3785, y: 495, badge: 'TRM', label: 'Blast Gate Terminal [Swipe Keycard]', highlight: true, collected: false }
    ];

    // Enemies: Mercenaries (Sector 1, 2, 3 Checkpoint, 4 Commander Ward + Spotter)
    const mercSpecs = [
      // Sector 1: 1 lone Ironclad guard positioned for rear Parang stealth takedown
      {
        id: 'merc_s1_1',
        sector: 1,
        x: 785,
        y: 625,
        facingAngle: 0,
        waypoints: [
          { x: 785, y: 625 },
          { x: 930, y: 625 }
        ]
      },
      // Sector 2: 3 Ironclad riflemen with intersecting patrols
      {
        id: 'merc_s2_1',
        sector: 2,
        x: 1320,
        y: 515,
        facingAngle: Math.PI,
        waypoints: [
          { x: 1220, y: 515 },
          { x: 1530, y: 515 }
        ]
      },
      {
        id: 'merc_s2_2',
        sector: 2,
        x: 1690,
        y: 590,
        facingAngle: Math.PI * 0.5,
        waypoints: [
          { x: 1690, y: 430 },
          { x: 1690, y: 790 }
        ]
      },
      {
        id: 'merc_s2_3',
        sector: 2,
        x: 1930,
        y: 625,
        facingAngle: Math.PI,
        waypoints: [
          { x: 1850, y: 575 },
          { x: 2040, y: 710 }
        ]
      },
      // Sector 3: Ironclad Checkpoint blocking Ravine exit (prime target for Boar Faction Infighting!)
      {
        id: 'merc_s3_1',
        sector: 3,
        x: 2980,
        y: 560,
        facingAngle: Math.PI,
        waypoints: [
          { x: 2960, y: 540 },
          { x: 3020, y: 615 }
        ]
      },
      {
        id: 'merc_s3_2',
        sector: 3,
        x: 3010,
        y: 710,
        facingAngle: Math.PI,
        waypoints: [
          { x: 2990, y: 735 },
          { x: 2940, y: 660 }
        ]
      },
      // Sector 4: Outpost Commander Ward + Spotter Guard
      {
        id: 'merc_s4_spotter',
        sector: 4,
        role: 'spotter',
        name: 'Ironclad Spotter',
        x: 3480,
        y: 415,
        facingAngle: Math.PI * 0.75,
        waypoints: [
          { x: 3430, y: 380 },
          { x: 3670, y: 380 }
        ]
      },
      {
        id: 'merc_s4_ward',
        sector: 4,
        role: 'commander',
        name: 'Commander Ward',
        hp: 140,
        x: 3685,
        y: 620,
        facingAngle: Math.PI,
        waypoints: [
          { x: 3660, y: 550 },
          { x: 3660, y: 740 }
        ]
      }
    ];

    const mercenaries = Mercenary ? mercSpecs.map((m) => new Mercenary(m)) : mercSpecs;

    // Sector 3: 2 Mutated Babi Hutan (Wild Boars) — grazing near ravine center until provoked
    const boarSpecs = [
      { id: 'boar_s3_1', x: 2480, y: 525 },
      { id: 'boar_s3_2', x: 2590, y: 720 }
    ];
    const boars = MutatedBoar ? boarSpecs.map((b) => new MutatedBoar(b)) : boarSpecs;

    // Sector 3/4: PMC Surveillance Quadcopter Drone (Task 4 aerial threat)
    const droneSpecs = [
      {
        id: 'drone_s34_1',
        sector: 4,
        speed: 92,
        coneRadius: 128,
        waypoints: [
          { x: 2960, y: 480 },
          { x: 3420, y: 440 },
          { x: 3640, y: 730 },
          { x: 3180, y: 760 }
        ]
      }
    ];
    const drones = SurveillanceDrone ? droneSpecs.map((d) => new SurveillanceDrone(d)) : droneSpecs;

    return {
      worldW,
      worldH,
      spawn: { x: 185, y: 645 },
      sectors,
      riverZone,
      paths,
      culvertZone,
      extractionZone,
      obstacles,
      bashaSites,
      sporeZones,
      floodlights,
      tripwires,
      interactables,
      mercenaries,
      boars,
      drones,
      fenceCut: false,
      outpostGateOpen: false,
      pumpPowered: false,
      culvertDrained: false,
      labSafeOpened: false,
      generatorSabotaged: false,
      culvertUnlocked: false,
      blastGateOpening: false,
      blastGateOpen: false,
      blastGateTimer: 15.0,
      reinforcementSpawned: false,
      secondaryObjectives: {
        bodyCam: false,
        samplePhotos: false,
        scientistFreed: false,
        gpsPlanted: false
      }
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createAct1Level };
  }
  global.BelumGame = global.BelumGame || {};
  global.BelumGame.createAct1Level = createAct1Level;
})(typeof window !== 'undefined' ? window : globalThis);
