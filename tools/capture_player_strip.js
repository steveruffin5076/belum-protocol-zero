#!/usr/bin/env node
// tools/capture_player_strip.js - In-game player frame strip capture (PLAYER_ART_ANIMATION_TASKS Appendix B)
'use strict';

const fs = require('fs');
const path = require('path');

const out = process.argv[2] || '.';
fs.mkdirSync(out, { recursive: true });

async function runWithPlaywright() {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:3000/');
  await p.waitForTimeout(1200);
  await p.click('#btn-prologue-skip');
  await p.waitForTimeout(200);
  await p.click('text=BEGIN OPERATION');
  await p.waitForTimeout(1500);
  const clip = () => p.evaluate(() => {
    const g = window.belumGameInstance, pl = g.player, c = g.camera.getRenderOffset(), z = c.zoom || 1;
    const W = innerWidth, H = innerHeight;
    const sx = (pl.centerX - c.x - W / 2) * z + W / 2;
    const sy = (pl.y + pl.height - c.y - H / 2) * z + H / 2;
    return { x: Math.round(sx - 70), y: Math.round(sy - 120), width: 140, height: 140 };
  });
  const shots = async (tag, n, gap) => {
    for (let i = 0; i < n; i++) {
      await p.screenshot({ path: path.join(out, `${tag}_${i}.png`), clip: await clip() });
      await p.waitForTimeout(gap);
    }
  };
  await shots('idle', 4, 160);
  await p.keyboard.down('KeyD'); await p.waitForTimeout(300); await shots('walkR', 8, 125); await p.keyboard.up('KeyD');
  await p.keyboard.down('KeyA'); await p.waitForTimeout(300); await shots('walkL', 4, 125); await p.keyboard.up('KeyA');
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyD'); await p.waitForTimeout(300);
  await shots('sprint', 8, 80);
  await p.keyboard.up('KeyD'); await p.keyboard.up('ShiftLeft');
  await p.keyboard.press('KeyC'); await p.waitForTimeout(300);
  await p.keyboard.down('KeyS'); await p.waitForTimeout(300); await shots('crouch', 8, 125); await p.keyboard.up('KeyS');
  await p.keyboard.press('KeyC'); await p.waitForTimeout(300);
  await p.keyboard.press('Space'); await shots('slash', 10, 55);
  await b.close();
}

async function runWithCDP() {
  const { spawn } = require('child_process');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const port = 9360 + Math.floor(Math.random() * 20);
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
      if (m.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(m.params));
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
    const keyDown = (code) => evalJS(`window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}', bubbles: true }));`);
    const keyUp = (code) => evalJS(`window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}', bubbles: true }));`);
    const keyPress = async (code) => { await keyDown(code); await sleep(35); await keyUp(code); };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(1200);
    await evalJS(`document.getElementById('btn-prologue-skip')?.click();`);
    await sleep(250);
    await evalJS(`document.getElementById('btn-begin-operation')?.click();`);
    await sleep(1400);

    const getClip = () => evalJS(`(() => {
      const g = window.belumGameInstance, pl = g.player, c = g.camera.getRenderOffset(), z = c.zoom || 1;
      const W = innerWidth, H = innerHeight;
      const sx = (pl.centerX - c.x - W / 2) * z + W / 2;
      const sy = (pl.y + pl.height - c.y - H / 2) * z + H / 2;
      return { x: Math.max(0, Math.round(sx - 70)), y: Math.max(0, Math.round(sy - 120)), width: 140, height: 140, scale: 1 };
    })()`);

    const shots = async (tag, n, gap) => {
      for (let i = 0; i < n; i++) {
        const clip = await getClip();
        const res = await send('Page.captureScreenshot', { format: 'png', clip });
        fs.writeFileSync(path.join(out, `${tag}_${i}.png`), Buffer.from(res.data, 'base64'));
        await sleep(gap);
      }
    };

    await shots('idle', 4, 160);
    await keyDown('KeyD'); await sleep(220); await shots('walkR', 8, 110); await keyUp('KeyD');
    await keyDown('KeyA'); await sleep(220); await shots('walkL', 6, 110); await keyUp('KeyA');
    await keyDown('ShiftLeft'); await keyDown('KeyA'); await sleep(180);
    await shots('sprint', 8, 70);
    await keyUp('KeyA'); await keyUp('ShiftLeft');
    await keyPress('KeyC'); await sleep(220);
    await keyDown('KeyD'); await sleep(180); await shots('crouch', 8, 110); await keyUp('KeyD');
    await keyPress('KeyC'); await sleep(220);
    await keyPress('Space'); await shots('slash', 10, 55);
    console.log('player strip captured to:', out, 'page errors:', errs.length);
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
