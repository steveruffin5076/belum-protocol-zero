#!/usr/bin/env node
// tools/check_queued_input.js - Appendix A check for Fix 1 (queued input outside gameplay)
'use strict';

async function runWithPlaywright() {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:3000/');
  await p.waitForTimeout(1200);
  await p.keyboard.press('Space');
  await p.keyboard.press('KeyB');
  await p.click('#btn-prologue-skip');
  await p.waitForTimeout(300);
  await p.click('text=BEGIN OPERATION');
  await p.waitForTimeout(500);
  const after = await p.evaluate(() => ({
    mode: window.belumGameInstance.mode,
    meleeSlashQueued: window.belumGameInstance.input.actions.meleeSlash
  }));
  console.log(JSON.stringify({ after }));
  await b.close();
  process.exit(after.mode === 'PLAYING' && !after.meleeSlashQueued ? 0 : 1);
}

async function runWithCDP() {
  const { spawn } = require('child_process');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const port = 9340 + Math.floor(Math.random() * 20);
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
    await send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(1200);
    // Press Space and KeyB during PROLOGUE briefing
    await evalJS(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyB', bubbles: true }));
      const skip = document.getElementById('btn-prologue-skip');
      if (skip) skip.click();
    })()`);
    await sleep(250);
    await evalJS(`document.getElementById('btn-begin-operation').click();`);
    await sleep(500);
    const after = await evalJS(`({
      mode: window.belumGameInstance.mode,
      meleeSlashQueued: window.belumGameInstance.input.actions.meleeSlash
    })`);
    // Also verify Check #3: pressing Space & E inside CAMP does not slash/interact after closing camp
    await evalJS(`(() => {
      const g = window.belumGameInstance;
      g.tryOpenCamp();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }));
      g.camp.close();
    })()`);
    await sleep(150);
    const afterCamp = await evalJS(`({
      mode: window.belumGameInstance.mode,
      meleeSlashQueued: window.belumGameInstance.input.actions.meleeSlash,
      interactQueued: window.belumGameInstance.input.actions.interact,
      parangAnimTimer: window.belumGameInstance.player.parangAnimTimer
    })`);
    console.log(JSON.stringify({ after, afterCamp }));
    const ok = after.mode === 'PLAYING' && !after.meleeSlashQueued &&
               afterCamp.mode === 'PLAYING' && !afterCamp.meleeSlashQueued &&
               !afterCamp.interactQueued && afterCamp.parangAnimTimer === 0;
    process.exit(ok ? 0 : 1);
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
