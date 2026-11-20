#!/usr/bin/env node
// tools/route_length_check.js - Fix 2 A* walkable-grid route length check (10 px cells, 16 px player padding)
'use strict';

const { createAct1Level } = require('../src/world/level_act1.js');
const { ACT1_FLOW } = require('../src/world/act1_flow.js');

const CELL = 10;
const PLAYER_RADIUS = 16;
const WALK_SPEED = 162; // px/s (Player.walkSpeed)
const MIN_SECTOR_SEC = 30;
const MIN_TOTAL_SEC = 150;

function buildBlockedGrid(level, openGateIds) {
  const cols = Math.ceil(level.worldW / CELL);
  const rows = Math.ceil(level.worldH / CELL);
  const blocked = new Uint8Array(cols * rows);
  const minWalkX = level.riverZone ? level.riverZone.x + level.riverZone.width + 8 : 16;
  const maxWalkX = level.worldW - 24;
  const minWalkY = 24;
  const maxWalkY = level.worldH - 24;

  // World & river bounds
  for (let r = 0; r < rows; r++) {
    const cy = r * CELL + CELL * 0.5;
    for (let c = 0; c < cols; c++) {
      const cx = c * CELL + CELL * 0.5;
      if (cx < minWalkX || cx > maxWalkX || cy < minWalkY || cy > maxWalkY) {
        blocked[r * cols + c] = 1;
      }
    }
  }

  // Pad every solid obstacle by PLAYER_RADIUS (16 px)
  const obstacles = level.obstacles || [];
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (!obs.solid) continue;
    if (obs.id && openGateIds.has(obs.id)) continue;

    const bx = obs.colX !== undefined ? obs.colX : obs.x;
    const by = obs.colY !== undefined ? obs.colY : obs.y;
    const bw = obs.colW !== undefined ? obs.colW : obs.width;
    const bh = obs.colH !== undefined ? obs.colH : obs.height;

    const c0 = Math.max(0, Math.floor((bx - PLAYER_RADIUS) / CELL));
    const c1 = Math.min(cols - 1, Math.ceil((bx + bw + PLAYER_RADIUS) / CELL));
    const r0 = Math.max(0, Math.floor((by - PLAYER_RADIUS) / CELL));
    const r1 = Math.min(rows - 1, Math.ceil((by + bh + PLAYER_RADIUS) / CELL));

    for (let r = r0; r <= r1; r++) {
      const cy = r * CELL + CELL * 0.5;
      for (let c = c0; c <= c1; c++) {
        const cx = c * CELL + CELL * 0.5;
        const closestX = Math.max(bx, Math.min(cx, bx + bw));
        const closestY = Math.max(by, Math.min(cy, by + bh));
        const dx = cx - closestX;
        const dy = cy - closestY;
        if (dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS) {
          blocked[r * cols + c] = 1;
        }
      }
    }
  }
  return { cols, rows, blocked };
}

function findNearestFreeCell(grid, targetC, targetR, maxRadiusCells) {
  const { cols, rows, blocked } = grid;
  const clampC = Math.max(0, Math.min(cols - 1, targetC));
  const clampR = Math.max(0, Math.min(rows - 1, targetR));
  if (!blocked[clampR * cols + clampC]) return { c: clampC, r: clampR };
  const maxR = maxRadiusCells || 8;
  for (let rad = 1; rad <= maxR; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
        const nc = clampC + dc;
        const nr = clampR + dr;
        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && !blocked[nr * cols + nc]) {
          return { c: nc, r: nr };
        }
      }
    }
  }
  return null;
}

class MinHeap {
  constructor() { this.arr = []; }
  push(node) {
    this.arr.push(node);
    let i = this.arr.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.arr[p].f <= this.arr[i].f) break;
      const tmp = this.arr[p]; this.arr[p] = this.arr[i]; this.arr[i] = tmp;
      i = p;
    }
  }
  pop() {
    if (this.arr.length === 0) return null;
    const top = this.arr[0];
    const last = this.arr.pop();
    if (this.arr.length > 0) {
      this.arr[0] = last;
      let i = 0;
      const n = this.arr.length;
      while (true) {
        let s = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < n && this.arr[l].f < this.arr[s].f) s = l;
        if (r < n && this.arr[r].f < this.arr[s].f) s = r;
        if (s === i) break;
        const tmp = this.arr[i]; this.arr[i] = this.arr[s]; this.arr[s] = tmp;
        i = s;
      }
    }
    return top;
  }
  get size() { return this.arr.length; }
}

function astarDistancePx(grid, x0, y0, x1, y1) {
  const { cols, rows, blocked } = grid;
  const start = findNearestFreeCell(grid, Math.floor(x0 / CELL), Math.floor(y0 / CELL), 7);
  const goal = findNearestFreeCell(grid, Math.floor(x1 / CELL), Math.floor(y1 / CELL), 7);
  if (!start || !goal) return null;

  const total = cols * rows;
  const gScore = new Float32Array(total);
  gScore.fill(1e9);
  const closed = new Uint8Array(total);
  const startIdx = start.r * cols + start.c;
  const goalIdx = goal.r * cols + goal.c;
  gScore[startIdx] = 0;

  const heap = new MinHeap();
  const h = (c, r) => Math.hypot(c - goal.c, r - goal.r) * CELL;
  heap.push({ idx: startIdx, c: start.c, r: start.r, f: h(start.c, start.r) });

  const dirs = [
    [1, 0, CELL], [-1, 0, CELL], [0, 1, CELL], [0, -1, CELL],
    [1, 1, CELL * Math.SQRT2], [1, -1, CELL * Math.SQRT2],
    [-1, 1, CELL * Math.SQRT2], [-1, -1, CELL * Math.SQRT2]
  ];

  while (heap.size > 0) {
    const cur = heap.pop();
    if (closed[cur.idx]) continue;
    if (cur.idx === goalIdx) return gScore[goalIdx];
    closed[cur.idx] = 1;
    const curG = gScore[cur.idx];

    for (let d = 0; d < 8; d++) {
      const nc = cur.c + dirs[d][0];
      const nr = cur.r + dirs[d][1];
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nIdx = nr * cols + nc;
      if (blocked[nIdx] || closed[nIdx]) continue;
      // Prevent diagonal corner-cutting through solid corners
      if (d >= 4 && (blocked[cur.r * cols + nc] || blocked[nr * cols + cur.c])) continue;
      const candG = curG + dirs[d][2];
      if (candG < gScore[nIdx]) {
        gScore[nIdx] = candG;
        heap.push({ idx: nIdx, c: nc, r: nr, f: candG + h(nc, nr) });
      }
    }
  }
  return null;
}

function run() {
  const level = createAct1Level();
  const route = ACT1_FLOW.requiredRoute;
  if (!Array.isArray(route) || route.length < 2) {
    console.error('[FAIL] ACT1_FLOW.requiredRoute is missing or incomplete');
    process.exit(1);
  }

  const openGateIds = new Set();
  const sectorDist = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let totalDist = 0;
  let failures = 0;

  let curX = level.spawn.x + 24;
  let curY = level.spawn.y + 49;

  console.log('=== BELUM: PROTOCOL ZERO — ACT 1 ROUTE LENGTH CHECK (A*, 10px GRID, 16px PAD) ===');
  for (let i = 0; i < route.length; i++) {
    const step = route[i];
    let targetX = step.x;
    let targetY = step.y;
    if (step.interactableId) {
      const it = (level.interactables || []).find((o) => o.id === step.interactableId);
      if (!it) {
        console.log(`[FAIL] Missing interactable for route step "${step.id}": ${step.interactableId}`);
        failures++;
        continue;
      }
      targetX = it.x;
      targetY = it.y;
    } else if (step.bashaId) {
      const bs = (level.bashaSites || []).find((o) => o.id === step.bashaId);
      if (!bs) {
        console.log(`[FAIL] Missing basha site for route step "${step.id}": ${step.bashaId}`);
        failures++;
        continue;
      }
      targetX = bs.x;
      targetY = bs.y;
    }

    const grid = buildBlockedGrid(level, openGateIds);
    const dist = astarDistancePx(grid, curX, curY, targetX, targetY);
    if (dist === null) {
      console.log(`[FAIL] Sector ${step.sector} leg -> ${step.label} (${targetX}, ${targetY}) UNREACHABLE with open gates [${Array.from(openGateIds).join(', ')}]`);
      failures++;
      continue;
    }

    const sec = dist / WALK_SPEED;
    sectorDist[step.sector] = (sectorDist[step.sector] || 0) + dist;
    totalDist += dist;
    console.log(`  S${step.sector} -> ${step.label}: ${Math.round(dist)} px (${sec.toFixed(1)}s)`);

    curX = targetX;
    curY = targetY;

    if (Array.isArray(step.opensGates)) {
      for (let g = 0; g < step.opensGates.length; g++) {
        openGateIds.add(step.opensGates[g]);
      }
    }
  }

  console.log('--- Per-Sector Pure Walking Summary (at 162 px/s) ---');
  for (let s = 1; s <= 4; s++) {
    const d = sectorDist[s] || 0;
    const t = d / WALK_SPEED;
    const pass = t >= MIN_SECTOR_SEC;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] Sector ${s}: ${Math.round(d)} px = ${t.toFixed(1)} s (target >= ${MIN_SECTOR_SEC} s)`);
    if (!pass) failures++;
  }

  const totalSec = totalDist / WALK_SPEED;
  const totalPass = totalSec >= MIN_TOTAL_SEC;
  console.log(`[${totalPass ? 'PASS' : 'FAIL'}] TOTAL REQUIRED ROUTE: ${Math.round(totalDist)} px = ${totalSec.toFixed(1)} s (target >= ${MIN_TOTAL_SEC} s)`);
  if (!totalPass) failures++;

  if (failures > 0) {
    console.error(`\n>>> ROUTE LENGTH CHECK FAILED (${failures} issue(s)) <<<`);
    process.exit(1);
  }
  console.log('\n>>> ALL ROUTE LENGTH CHECKS PASSED <<<');
  process.exit(0);
}

run();
