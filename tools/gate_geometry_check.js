#!/usr/bin/env node
// tools/gate_geometry_check.js - Appendix A check for Fix 1 (sector boundary gate geometry with real key input)
'use strict';

const BOUNDARIES = [
  { name: 'S1->S2', x: 1065, gateId: 'outpost_fence_gate', gateY: 650 },
  { name: 'S2->S3', x: 2135, gateId: 'outpost_east_gate', gateY: 650 },
  { name: 'S3->S4', x: 3090, gateId: 'ravine_east_gate', gateY: 650 }
];

async function runWithPlaywright() {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:3000/');
  await p.waitForTimeout(900);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(900);
  await p.click('#btn-prologue-skip');
  await p.waitForTimeout(200);
  await p.click('text=BEGIN OPERATION');
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const g = window.belumGameInstance;
    g.player.takeDamage = () => 0;
    for (const m of g.mercenaries) m.update = () => {};
    for (const bo of g.boars) bo.update = () => {};
    for (const d of (g.drones || [])) d.update = () => {};
  });
  const place = (x, y) => p.evaluate(([x, y]) => {
    const g = window.belumGameInstance;
    g.player.x = x - g.player.width / 2;
    g.player.y = y - g.player.height * 0.72;
    g.camera.snapTo(x, y);
  }, [x, y]);
  const walkRight = async (ms) => { await p.keyboard.down('KeyD'); await p.waitForTimeout(ms); await p.keyboard.up('KeyD'); };
  let failures = 0;
  for (const bd of BOUNDARIES) {
    const crossed = [];
    for (let y = 40; y <= 1280; y += 40) {
      await place(bd.x - 90, y);
      await walkRight(1400);
      const cx = await p.evaluate(() => window.belumGameInstance.player.centerX);
      if (cx > bd.x + 30) crossed.push(y);
    }
    if (crossed.length) { failures++; console.log(`[FAIL] ${bd.name} closed but crossed at y = ${crossed.join(', ')}`); }
    else console.log(`[PASS] ${bd.name} closed at every height`);
    // Open the gate the same way the game does, then it must be passable at the gate
    await p.evaluate((id) => { const o = window.belumGameInstance.level.obstacles.find((x) => x.id === id); if (o) { o.unlocked = true; o.solid = false; } }, bd.gateId);
    await place(bd.x - 90, bd.gateY);
    await walkRight(1400);
    const cxOpen = await p.evaluate(() => window.belumGameInstance.player.centerX);
    if (cxOpen > bd.x + 30) console.log(`[PASS] ${bd.name} passable when open`);
    else { failures++; console.log(`[FAIL] ${bd.name} still blocked when open (x=${cxOpen | 0})`); }
  }
  await b.close();
  process.exit(failures ? 1 : 0);
}

async function runWithCDP() {
  const { spawn } = require('child_process');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const port = 9440 + Math.floor(Math.random() * 40);
  const chrome = spawn('/usr/bin/chromium', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${port}`, '--window-size=1280,720', 'about:blank'
  ], { stdio: 'ignore' });
  let ws;
  try {
    let targetWsUrl = null;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json`);
        const pages = await res.json();
        const page = pages.find((x) => x.type === 'page' && x.webSocketDebuggerUrl);
        if (page) { targetWsUrl = page.webSocketDebuggerUrl; break; }
      } catch (_) {}
      await sleep(150);
    }
    if (!targetWsUrl) throw new Error('Could not connect to Chromium CDP');
    ws = new WebSocket(targetWsUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    let id = 1;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) reject(new Error(m.error.message)); else resolve(m.result);
      }
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const cid = id++; pending.set(cid, { resolve, reject }); ws.send(JSON.stringify({ id: cid, method, params }));
    });
    const evalJS = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
      return r.result ? r.result.value : undefined;
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(900);
    await evalJS('localStorage.clear()');
    await send('Page.reload');
    await sleep(900);
    await evalJS(`(() => { const s = document.getElementById('btn-prologue-skip'); if (s) s.click(); })()`);
    await sleep(200);
    await evalJS(`(() => { const b = document.getElementById('btn-begin-operation'); if (b) b.click(); })()`);
    await sleep(500);
    await evalJS(`(() => {
      const g = window.belumGameInstance;
      g.player.takeDamage = () => 0;
      for (const m of g.mercenaries) m.update = () => {};
      for (const bo of g.boars) bo.update = () => {};
      for (const d of (g.drones || [])) d.update = () => {};
    })()`);

    const place = (x, y) => evalJS(`(() => {
      const g = window.belumGameInstance;
      g.player.x = ${x} - g.player.width / 2;
      g.player.y = ${y} - g.player.height * 0.72;
      g.camera.snapTo(${x}, ${y});
    })()`);

    // Real Chromium browser keyboard input via CDP Input.dispatchKeyEvent
    const walkRight = async (ms) => {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', code: 'KeyD', key: 'd', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
      await sleep(ms);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyD', key: 'd', windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 });
    };

    let failures = 0;
    for (const bd of BOUNDARIES) {
      const crossed = [];
      for (let y = 40; y <= 1280; y += 40) {
        await place(bd.x - 90, y);
        await walkRight(1400);
        const cx = await evalJS('window.belumGameInstance.player.centerX');
        if (cx > bd.x + 30) crossed.push(y);
      }
      if (crossed.length) { failures++; console.log(`[FAIL] ${bd.name} closed but crossed at y = ${crossed.join(', ')}`); }
      else console.log(`[PASS] ${bd.name} closed at every height`);
      await evalJS(`(() => { const o = window.belumGameInstance.level.obstacles.find((x) => x.id === '${bd.gateId}'); if (o) { o.unlocked = true; o.solid = false; } })()`);
      await place(bd.x - 90, bd.gateY);
      await walkRight(1400);
      const cxOpen = await evalJS('window.belumGameInstance.player.centerX');
      if (cxOpen > bd.x + 30) console.log(`[PASS] ${bd.name} passable when open`);
      else { failures++; console.log(`[FAIL] ${bd.name} still blocked when open (x=${cxOpen | 0})`); }
    }
    process.exit(failures ? 1 : 0);
  } finally {
    if (ws) try { ws.close(); } catch (_) {}
    chrome.kill('SIGKILL');
  }
}

(async () => {
  try {
    require.resolve('playwright');
    await runWithPlaywright();
  } catch (_) {
    await runWithCDP();
  }
})();
