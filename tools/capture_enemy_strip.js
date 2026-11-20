#!/usr/bin/env node
// tools/capture_enemy_strip.js - In-game enemy frame strip capture (ENEMY_ART_ANIMATION_TASKS Appendix B)
'use strict';

const fs = require('fs');
const path = require('path');

const out = process.argv[2] || '.';
fs.mkdirSync(out, { recursive: true });

async function runWithPlaywright() {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3000/');
  await p.waitForTimeout(1200);
  await p.click('#btn-prologue-skip');
  await p.waitForTimeout(200);
  await p.click('text=BEGIN OPERATION');
  await p.waitForTimeout(2200);
  await p.evaluate(() => { const g = window.belumGameInstance; g.mode = 'TEST'; g.player.x = -5000; });
  const clip = (kind, idx) => p.evaluate(([kind, idx]) => {
    const g = window.belumGameInstance, e = g[kind][idx], c = g.camera.getRenderOffset(), z = c.zoom || 1;
    const W = innerWidth, H = innerHeight;
    const sx = (e.centerX - c.x - W / 2) * z + W / 2, sy = (e.y + e.height - c.y - H / 2) * z + H / 2;
    return { x: Math.round(sx - 75), y: Math.round(sy - 125), width: 150, height: 145 };
  }, [kind, idx]);
  const snap = (kind, idx) => p.evaluate(([kind, idx]) => {
    const g = window.belumGameInstance, e = g[kind][idx]; g.camera.snapTo(e.centerX, e.centerY);
  }, [kind, idx]);
  const shot = async (name, kind, idx) => {
    await p.waitForTimeout(50);
    await p.screenshot({ path: path.join(out, `${name}.png`), clip: await clip(kind, idx) });
  };
  const mi = await p.evaluate(() => window.belumGameInstance.mercenaries.findIndex(m => m.role === 'rifleman'));
  const si = await p.evaluate(() => window.belumGameInstance.mercenaries.findIndex(m => m.role === 'spotter'));
  const ci = await p.evaluate(() => window.belumGameInstance.mercenaries.findIndex(m => m.role === 'commander'));
  await snap('mercenaries', mi);
  for (const [dn, ang] of [['right', 0], ['left', Math.PI], ['up', -Math.PI / 2], ['down', Math.PI / 2]]) {
    for (let f = 0; f < 8; f++) {
      await p.evaluate(([i, ang, f]) => {
        const m = window.belumGameInstance.mercenaries[i];
        m.state = 'PATROL'; m.suspicionMeter = 0; m.firingAnimTimer = 0; m.holdingAimPose = false;
        m.facingAngle = ang; m.facingRight = Math.cos(ang) >= 0; m.spriteDir = 'side'; m._updateSpriteDir();
        for (const a of [m.animPatrol, m.animPatrolUp, m.animPatrolDown]) if (a) a.currentFrame = f;
      }, [mi, ang, f]);
      await shot(`merc_${dn}_${f}`, 'mercenaries', mi);
    }
  }
  for (const [dn, ang] of [['right', 0], ['up', -Math.PI / 2], ['down', Math.PI / 2]]) {
    for (let f = 0; f < 8; f++) {
      await p.evaluate(([i, ang, f]) => {
        const m = window.belumGameInstance.mercenaries[i];
        m.facingAngle = ang; m.facingRight = Math.cos(ang) >= 0; m.spriteDir = 'side'; m._updateSpriteDir();
        m.firingAnimTimer = 1;
        for (const a of [m.animFire, m.animFireUp, m.animFireDown]) if (a) a.currentFrame = f;
      }, [mi, ang, f]);
      await shot(`fire_${dn}_${f}`, 'mercenaries', mi);
    }
  }
  await p.evaluate(([i]) => {
    const m = window.belumGameInstance.mercenaries[i];
    m.firingAnimTimer = 0; m.state = 'ALERT'; m.holdingAimPose = true; m.facingAngle = 0; m.facingRight = true;
    m.spriteDir = 'side'; m._updateSpriteDir();
    if (m.animFire) m.animFire.currentFrame = 1;
  }, [mi]);
  await shot('fire_aim_hold', 'mercenaries', mi);
  await p.evaluate(([i]) => { const m = window.belumGameInstance.mercenaries[i]; m.firingAnimTimer = 0; m.holdingAimPose = false; m.dead = true; m.state = 'DEAD'; }, [mi]);
  await shot('merc_dead', 'mercenaries', mi);
  if (si >= 0) {
    await snap('mercenaries', si);
    await p.evaluate(([i]) => { const m = window.belumGameInstance.mercenaries[i]; m.state = 'PATROL'; m.suspicionMeter = 0; m.facingAngle = 0; m.facingRight = true; m.spriteDir = 'side'; m._updateSpriteDir(); }, [si]);
    await shot('spotter', 'mercenaries', si);
  }
  await snap('mercenaries', ci);
  await p.evaluate(([i]) => { const m = window.belumGameInstance.mercenaries[i]; m.state = 'PATROL'; m.suspicionMeter = 0; m.facingAngle = 0; m.facingRight = true; m.spriteDir = 'side'; m._updateSpriteDir(); }, [ci]);
  await shot('commander', 'mercenaries', ci);
  await snap('boars', 0);
  for (const [n, st, an, frames] of [
    ['graze', 'GRAZE', 'animIdle', [0, 1, 2, 3, 4, 5, 6, 7]],
    ['telegraph', 'TELEGRAPH', 'animPaw', [0, 1, 2]],
    ['charge', 'CHARGE', 'animRun', [3, 4, 5, 6, 7]]
  ]) {
    for (const f of frames) {
      await p.evaluate(([st, an, f]) => {
        const bo = window.belumGameInstance.boars[0];
        bo.state = st; bo.facingRight = true; if (bo[an]) bo[an].currentFrame = f;
      }, [st, an, f]);
      await shot(`boar_${n}_${f}`, 'boars', 0);
    }
  }
  await p.evaluate(() => { window.belumGameInstance.boars[0].state = 'STUNNED'; });
  await shot('boar_stunned', 'boars', 0);
  await p.evaluate(() => { const bo = window.belumGameInstance.boars[0]; bo.dead = true; bo.state = 'DEAD'; });
  await shot('boar_dead', 'boars', 0);
  console.log('page errors:', errs);
  await b.close();
}

async function runWithCDP() {
  const { spawn } = require('child_process');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const port = 9380 + Math.floor(Math.random() * 20);
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

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(1200);
    await evalJS(`document.getElementById('btn-prologue-skip')?.click();`);
    await sleep(250);
    await evalJS(`document.getElementById('btn-begin-operation')?.click();`);
    await sleep(1800);
    await evalJS(`(() => { const g = window.belumGameInstance; g.mode = 'TEST'; g.player.x = -5000; })()`);

    const getClip = (kind, idx) => evalJS(`(() => {
      const g = window.belumGameInstance, e = g['${kind}'][${idx}], c = g.camera.getRenderOffset(), z = c.zoom || 1;
      const W = innerWidth, H = innerHeight;
      const sx = (e.centerX - c.x - W / 2) * z + W / 2, sy = (e.y + e.height - c.y - H / 2) * z + H / 2;
      return { x: Math.max(0, Math.round(sx - 75)), y: Math.max(0, Math.round(sy - 125)), width: 150, height: 145, scale: 1 };
    })()`);
    const snap = (kind, idx) => evalJS(`(() => {
      const g = window.belumGameInstance, e = g['${kind}'][${idx}]; g.camera.snapTo(e.centerX, e.centerY);
    })()`);
    const shot = async (name, kind, idx) => {
      await sleep(45);
      const clip = await getClip(kind, idx);
      const res = await send('Page.captureScreenshot', { format: 'png', clip });
      fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(res.data, 'base64'));
    };

    const { mi, si, ci } = await evalJS(`(() => {
      const ms = window.belumGameInstance.mercenaries;
      return {
        mi: ms.findIndex(m => m.role === 'rifleman'),
        si: ms.findIndex(m => m.role === 'spotter'),
        ci: ms.findIndex(m => m.role === 'commander')
      };
    })()`);

    await snap('mercenaries', mi);
    for (const [dn, ang] of [['right', 0], ['left', Math.PI], ['up', -Math.PI / 2], ['down', Math.PI / 2]]) {
      for (let f = 0; f < 8; f++) {
        await evalJS(`(() => {
          const m = window.belumGameInstance.mercenaries[${mi}];
          m.state = 'PATROL'; m.suspicionMeter = 0; m.firingAnimTimer = 0; m.holdingAimPose = false;
          m.facingAngle = ${ang}; m.facingRight = Math.cos(${ang}) >= 0; m.spriteDir = 'side'; m._updateSpriteDir();
          for (const a of [m.animPatrol, m.animPatrolUp, m.animPatrolDown]) if (a) a.currentFrame = ${f};
        })()`);
        await shot(`merc_${dn}_${f}`, 'mercenaries', mi);
      }
    }
    for (const [dn, ang] of [['right', 0], ['up', -Math.PI / 2], ['down', Math.PI / 2]]) {
      for (let f = 0; f < 8; f++) {
        await evalJS(`(() => {
          const m = window.belumGameInstance.mercenaries[${mi}];
          m.facingAngle = ${ang}; m.facingRight = Math.cos(${ang}) >= 0; m.spriteDir = 'side'; m._updateSpriteDir();
          m.firingAnimTimer = 1;
          for (const a of [m.animFire, m.animFireUp, m.animFireDown]) if (a) a.currentFrame = ${f};
        })()`);
        await shot(`fire_${dn}_${f}`, 'mercenaries', mi);
      }
    }
    await evalJS(`(() => {
      const m = window.belumGameInstance.mercenaries[${mi}];
      m.firingAnimTimer = 0; m.state = 'ALERT'; m.holdingAimPose = true; m.facingAngle = 0; m.facingRight = true;
      m.spriteDir = 'side'; m._updateSpriteDir();
      if (m.animFire) m.animFire.currentFrame = 1;
    })()`);
    await shot('fire_aim_hold', 'mercenaries', mi);
    await evalJS(`(() => { const m = window.belumGameInstance.mercenaries[${mi}]; m.firingAnimTimer = 0; m.holdingAimPose = false; m.dead = true; m.state = 'DEAD'; })()`);
    await shot('merc_dead', 'mercenaries', mi);

    if (si >= 0) {
      await snap('mercenaries', si);
      await evalJS(`(() => { const m = window.belumGameInstance.mercenaries[${si}]; m.state = 'PATROL'; m.suspicionMeter = 0; m.facingAngle = 0; m.facingRight = true; m.spriteDir = 'side'; m._updateSpriteDir(); })()`);
      await shot('spotter', 'mercenaries', si);
    }
    await snap('mercenaries', ci);
    await evalJS(`(() => { const m = window.belumGameInstance.mercenaries[${ci}]; m.state = 'PATROL'; m.suspicionMeter = 0; m.facingAngle = 0; m.facingRight = true; m.spriteDir = 'side'; m._updateSpriteDir(); })()`);
    await shot('commander', 'mercenaries', ci);

    await snap('boars', 0);
    for (const [n, st, an, frames] of [
      ['graze', 'GRAZE', 'animIdle', [0, 1, 2, 3, 4, 5, 6, 7]],
      ['telegraph', 'TELEGRAPH', 'animPaw', [0, 1, 2]],
      ['charge', 'CHARGE', 'animRun', [3, 4, 5, 6, 7]]
    ]) {
      for (const f of frames) {
        await evalJS(`(() => {
          const bo = window.belumGameInstance.boars[0];
          bo.state = '${st}'; bo.facingRight = true; if (bo['${an}']) bo['${an}'].currentFrame = ${f};
        })()`);
        await shot(`boar_${n}_${f}`, 'boars', 0);
      }
    }
    await evalJS(`window.belumGameInstance.boars[0].state = 'STUNNED';`);
    await shot('boar_stunned', 'boars', 0);
    await evalJS(`(() => { const bo = window.belumGameInstance.boars[0]; bo.dead = true; bo.state = 'DEAD'; })()`);
    await shot('boar_dead', 'boars', 0);
    console.log('enemy strip captured to:', out, 'page errors:', errs);
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
