#!/usr/bin/env node
// tools/check_new_game_checkpoint.js - Appendix A browser check for FOLLOWUP Fix 1
'use strict';

const fs = require('fs');

const screenshotIdx = process.argv.indexOf('--screenshot');
const screenshotPath = screenshotIdx !== -1 ? process.argv[screenshotIdx + 1] : null;

async function runWithPlaywright() {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:3000/');
  await p.waitForTimeout(800);
  // An earlier session left a Sector 3 checkpoint with the Sector 1 guard dead
  await p.evaluate(() => localStorage.setItem('belum_checkpoint', JSON.stringify({
    version: 1, sector: 3, spawn: { x: 2215, y: 640 },
    ammo: { crossbow: 9, pistol: 20, decoy: 9 },
    unlockedWeapons: { parang: true, crossbow: true, pistol: true, decoy: true },
    inventory: { hasKeycard: true },
    collectedPickups: ['pickup_keycard', 'pickup_pistol'], deadMercs: ['merc_s1_1'], deadBoars: [], flags: {}
  })));
  await p.reload();
  await p.waitForTimeout(1000);
  await p.click('#btn-prologue-skip');
  await p.waitForTimeout(200);
  await p.click('text=BEGIN OPERATION');
  await p.waitForTimeout(800);
  await p.evaluate(() => window.belumGameInstance.player.takeDamage(99));
  await p.waitForTimeout(1500);
  if (await p.isVisible('#btn-retry-sector')) {
    await p.click('#btn-retry-sector');
    await p.waitForTimeout(800);
  }
  if (screenshotPath) {
    await p.screenshot({ path: screenshotPath });
  }
  const after = await p.evaluate(() => {
    const g = window.belumGameInstance;
    return {
      sector: g.currentSectorId,
      keycard: !!g.player.inventory.hasKeycard,
      pistolAmmo: g.player.ammo.pistol,
      s1GuardDead: g.mercenaries.find((m) => m.id === 'merc_s1_1').dead
    };
  });
  console.log(JSON.stringify({ after, errs }));
  await b.close();
  process.exit(after.sector === 1 && !after.keycard && !after.s1GuardDead && errs.length === 0 ? 0 : 1);
}

async function runWithCDP() {
  const { spawn } = require('child_process');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const port = 9470 + Math.floor(Math.random() * 20);
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
    const errs = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') {
        errs.push(m.params && m.params.exceptionDetails ? m.params.exceptionDetails.text : 'Runtime exception');
      }
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
    await sleep(800);
    // An earlier session left a Sector 3 checkpoint with the Sector 1 guard dead
    await evalJS(`localStorage.setItem('belum_checkpoint', JSON.stringify({
      version: 1, sector: 3, spawn: { x: 2215, y: 640 },
      ammo: { crossbow: 9, pistol: 20, decoy: 9 },
      unlockedWeapons: { parang: true, crossbow: true, pistol: true, decoy: true },
      inventory: { hasKeycard: true },
      collectedPickups: ['pickup_keycard', 'pickup_pistol'], deadMercs: ['merc_s1_1'], deadBoars: [], flags: {}
    }))`);
    await send('Page.reload', { ignoreCache: true });
    await sleep(1000);
    await evalJS(`document.getElementById('btn-prologue-skip')?.click()`);
    await sleep(200);
    await evalJS(`document.getElementById('btn-begin-operation')?.click()`);
    await sleep(800);
    await evalJS(`window.belumGameInstance.player.takeDamage(99)`);
    await sleep(1500);
    const retryVisible = await evalJS(`(() => {
      const btn = document.getElementById('btn-retry-sector');
      if (!btn) return false;
      const modal = document.getElementById('endgame-modal');
      return (!modal || !modal.classList.contains('hidden')) && !btn.classList.contains('hidden') && btn.offsetParent !== null;
    })()`);
    if (retryVisible) {
      await evalJS(`document.getElementById('btn-retry-sector').click()`);
      await sleep(800);
    }
    if (screenshotPath) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(screenshotPath, Buffer.from(shot.data, 'base64'));
    }
    const after = await evalJS(`(() => {
      const g = window.belumGameInstance;
      return {
        sector: g.currentSectorId,
        keycard: !!g.player.inventory.hasKeycard,
        pistolAmmo: g.player.ammo.pistol,
        s1GuardDead: g.mercenaries.find(m => m.id === 'merc_s1_1').dead
      };
    })()`);
    console.log(JSON.stringify({ after, errs }));
    process.exit(after.sector === 1 && !after.keycard && !after.s1GuardDead && errs.length === 0 ? 0 : 1);
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
