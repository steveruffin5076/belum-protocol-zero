const M = require('../src/entities/mercenary.js');
let failed = 0;

// flip: target wobbles 1 degree around straight up for 1 s at 60 fps
{
  const m = new M({ x: 500, y: 500, facingAngle: -Math.PI / 2 });
  let flips = 0, prev = m.facingRight;
  for (let f = 0; f < 60; f++) {
    m._rotateToward(-Math.PI / 2 + (f % 2 ? 0.017 : -0.017), 1 / 60);
    if (m.facingRight !== prev) { flips++; prev = m.facingRight; }
  }
  console.log(flips === 0 ? '[PASS]' : '[FAIL]', 'flip wobble: flips =', flips, '(want 0)');
  if (flips !== 0) failed++;
}

// flip: one full slow turn
{
  const m = new M({ x: 500, y: 500, facingAngle: 0 });
  let flips = 0, prev = m.facingRight;
  for (let f = 0; f <= 360; f++) {
    m._rotateToward(f * Math.PI / 180, 1);
    if (m.facingRight !== prev) { flips++; prev = m.facingRight; }
  }
  console.log(flips === 2 ? '[PASS]' : '[FAIL]', 'flip full turn: flips =', flips, '(want 2)');
  if (flips !== 2) failed++;
}

// stuck: guard above the barracks with its waypoint straight below
{
  const level = { obstacles: [{ solid: true, x: 1140, y: 210, width: 280, height: 150 }] };
  const m = new M({ x: 1256, y: 120, waypoints: [{ x: 1280, y: 450 }, { x: 1500, y: 450 }] });
  const sx = m.centerX, sy = m.centerY;
  for (let f = 0; f < 600; f++) m.update(1 / 60, null, [], level, {});
  const moved = Math.hypot(m.centerX - sx, m.centerY - sy);
  console.log(moved > 100 ? '[PASS]' : '[FAIL]', 'stuck: moved', moved.toFixed(0), 'px in 10 s (want > 100)');
  if (moved <= 100) failed++;
}

process.exit(failed ? 1 : 0);
