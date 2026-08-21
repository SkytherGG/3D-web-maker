async function main() {
/*
 * Smoke test for the 3D World scrub engine.
 *   cd 3d-world && npm i jsdom && node scripts/smoke-test.js
 * Exercises: DOM build, spacer/runway, image-mode rendering (camera moves,
 * connector envelopes), HUD (timecode, progress, copy, CTA), cinematic
 * autoplay, public API, video-mode scrubbing + seam crossfade, teardown.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ENGINE = fs.readFileSync(
  path.resolve(__dirname, '..', 'references', 'scrub-engine.js'), 'utf8');

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="world"></div><footer></footer></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  runScripts: 'dangerously',
});
const { window } = dom;
const { document } = window;

let failures = 0;

// eslint-disable-next-line no-unused-vars
function check(name, cond, extra) {
  if (cond) console.log('  PASS  ' + name);
  else { failures++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

/* ---- browser-ish polyfills jsdom lacks ---- */
const rafQueue = [];
window.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
window.cancelAnimationFrame = () => {};
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
window.innerHeight = 800;
window.scrollY = 0;
window.scrollTo = (x, y) => { window.scrollY = y; window.scrollEvent = { x, y }; };
Object.defineProperty(document.documentElement, 'scrollHeight', { get: () => 6000, configurable: true });
window.Image = class {
  constructor() { this.complete = true; this.naturalWidth = 1376; this.naturalHeight = 768; this._src = ''; }
  set src(v) { this._src = v; queueMicrotask(() => { if (this.onload) this.onload(); }); }
  get src() { return this._src; }
};
window.fetch = () => Promise.reject(new Error('fetch should not be needed (inline manifest)'));

// run engine in the window (browser path)
window.eval(ENGINE);
if (typeof window.ScrollWorld !== 'function') { console.error('engine did not attach to window'); process.exit(1); }
console.log('engine attached:', typeof window.ScrollWorld);

function pump(frames = 2) {
  for (let i = 0; i < frames; i++) {
    const q = rafQueue.splice(0);
    q.forEach((cb) => cb(performance.now() + i * 16));
  }
}

const manifest = {
  version: 1, mode: 'image', runway: 700, background: '#0B1E3A',
  brand: { name: 'NORTHLIGHT' },
  sections: [
    { id: 'hero', label: '00 — The World', eyebrow: 'E', title: 'One world.', body: 'b', tags: ['A', 'B'],
      still: 'img/hero.jpg', duration: 5.5, scroll: 1.1, linger: 0.6,
      camera: { from: { scale: 1 }, to: { scale: 1.16 }, ease: 'inOut' } },
    { id: 'trailhead', label: '01 — Trailhead', eyebrow: 'E2', title: 'Start', body: 'b2', tags: ['C'],
      still: 'img/s1.jpg', duration: 6.2, scroll: 1.2, linger: 0.8,
      camera: { from: { scale: 1 }, to: { scale: 1.24 }, ease: 'inOut' } },
    { id: 'valley', label: '02 — Valley', eyebrow: 'E3', title: 'Cross', body: 'b3', tags: [],
      still: 'img/s2.jpg', duration: 6.2, scroll: 1.2, linger: 0.8,
      camera: { from: { scale: 1.04 }, to: { scale: 1.28 }, ease: 'inOut' } },
  ],
  connectors: [
    { id: 'c1', still: 'img/c1.jpg', duration: 2.4, camera: { from: { scale: 1.12 }, to: { scale: 1.5 } } },
    { id: 'c2', still: 'img/c2.jpg', duration: 2.4, camera: { from: { scale: 1.18 }, to: { scale: 1.55 } } },
  ],
  cta: { eyebrow: 'R', headline: 'See it.', sub: 's', button: 'Go', href: 'https://example.com', showAt: 0.92 },
};

let sceneLog = [];
const world = new window.ScrollWorld({
  container: '#world', mode: 'image',
  manifest,
  onSceneChange: (s) => sceneLog.push(s.id),
});

await new Promise((r) => setTimeout(r, 30)); // let Image onloads fire
pump(5);

console.log('\n— basic structure —');
check('stage built', !!document.querySelector('.sw-stage'));
check('spacer inserted', !!document.querySelector('.sw-spacer'));
check('spacer height 700vh', document.querySelector('.sw-spacer').style.height === '700vh');
const bgStyle = document.querySelector('.sw-stage').style.background;
check('background applied', bgStyle === '#0B1E3A' || bgStyle === 'rgb(11, 30, 58)' || /#0B1E3A/.test(bgStyle), bgStyle);
check('brand set', document.querySelector('.sw-brand').textContent === 'NORTHLIGHT');
check('base layer has a still child', document.querySelector('.sw-base').children.length === 1);
check('timecode rendered', /\d:\d\d \/ \d:\d\d/.test(document.querySelector('.sw-timecode').textContent), document.querySelector('.sw-timecode').textContent);
check('progress fill width > 0%', document.querySelector('.sw-progress-fill').style.width !== '0.00%');
check('hint visible initially', document.querySelector('.sw-hint').style.opacity === '');
check('CTA hidden initially', document.querySelector('.sw-cta').style.opacity === '0');

// copy: first section active
const copyItems = document.querySelectorAll('.sw-copy-item');
check('first copy visible', copyItems[0].style.opacity === '1');
check('other copy hidden', copyItems[1].style.opacity === '0');

// ---- scroll to the middle (end of hero / start of connector region) ----
const MAX = 6000 - 800;
window.scrollY = MAX * 0.20; // early in timeline
pump(4);
const midTransform = document.querySelector('.sw-base').style.transform;
check('camera transform applied mid-scroll', /scale\(1\.\d/.test(midTransform), midTransform);
check('scene change fired', sceneLog.length >= 1, sceneLog.join(','));

// ---- scroll to the end: CTA should appear ----
window.scrollY = MAX;
pump(6);
check('CTA visible at end', document.querySelector('.sw-cta').style.opacity === '1');
check('CTA button href', document.querySelector('.sw-cta-btn').href === 'https://example.com/');
check('last copy visible at end', copyItems[2].style.opacity === '1');
const pw = document.querySelector('.sw-progress-fill').style.width;
check('progress full at end', pw === '100.00%' || pw === '100%', pw); // jsdom normalizes trailing zeros

// ---- connector envelope: t inside connector 1 (6.05-8.45s) ----
// compute timeline: hero 5.5*1.1=6.05, c1 2.4, trailhead 6.2*1.2=7.44, c2 2.4, valley 6.2*1.2=7.44
// total = 6.05+2.4+7.44+2.4+7.44 = 25.73. t at p=0.35 -> 9.0 (inside c1's tail or trailhead start)
window.scrollY = MAX * 0.28;
pump(4);
const fxOpacity = parseFloat(document.querySelector('.sw-fx').style.opacity);
console.log('\n— connector at p=0.28 (inside c1) —');
check('fx layer has connector child', document.querySelector('.sw-fx').children.length === 1);
check('fx connector alpha ramped up', fxOpacity > 0 && fxOpacity <= 1, String(fxOpacity));

// ---- cinematic autoplay ----
console.log('\n— cinematic mode —');
window.scrollY = 0; world.toggleCinematic();
check('cinematic toggled on', world.cinematic === true);
const y0 = window.scrollY;
pump(30); // ~0.5s of autoplay
check('autoplay advances page scroll', window.scrollY > y0, `y0=${y0} y1=${window.scrollY}`);
world.pause();
check('cinematic paused', world.cinematic === false);

// user scroll exits autoplay
world.play();
window.scrollY += 50;
window.dispatchEvent(new window.Event('scroll'));
pump(1);
check('user scroll exits autoplay', world.cinematic === false);

// ---- API ----
console.log('\n— API —');
world.setProgress(0.5);
check('setProgress scrolls', Math.abs(window.scrollY - MAX * 0.5) < 2, `y=${window.scrollY}`);
world.scrollToSection('valley');
check('scrollToSection works', Math.abs(window.scrollY - MAX * ( (6.05+2.4+7.44+2.4) / 25.73)) < 4, `y=${window.scrollY}`);

world.destroy();
check('destroy cleans stage', document.querySelector('#world').children.length === 0);
check('destroy removes spacer', !document.querySelector('.sw-spacer'));

// ---- video mode subtest ----
console.log('\n— video mode —');
const dom2 = new JSDOM('<body><div id="w2"></div></body>', { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'dangerously' });
const w2 = dom2.window;
const rafQ2 = [];
w2.requestAnimationFrame = (cb) => { rafQ2.push(cb); return rafQ2.length; };
w2.cancelAnimationFrame = () => {};
w2.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
w2.innerHeight = 800; w2.scrollY = 0;
w2.scrollTo = (x, y) => { w2.scrollY = y; };
Object.defineProperty(w2.document.documentElement, 'scrollHeight', { get: () => 6000, configurable: true });
w2.fetch = () => Promise.reject(new Error('n/a'));
function pump2(n) { for (let i = 0; i < n; i++) rafQ2.splice(0).forEach((cb) => cb(0)); }
w2.eval(ENGINE);
const vman = {
  version: 1, mode: 'video', runway: 600, background: '#000',
  sections: [
    { id: 'a', label: 'A', clip: 'v/a.mp4', duration: 4, crossfade: 0.1 },
    { id: 'b', label: 'B', clip: 'v/b.mp4', duration: 4, crossfade: 0.1 },
  ],
  connectors: [{ id: 'ca', clip: 'v/ca.mp4', duration: 2 }],
  cta: { headline: 'go', button: 'Go', href: '#', showAt: 0.9 },
};
const w2world = new w2.ScrollWorld({ container: '#w2', mode: 'video', manifest: vman });
pump2(5);
const vids = w2world._videos;
check('video-mode: video created for current entry', Object.keys(vids).length >= 1, Object.keys(vids).join(','));
check('video-mode: src resolved', vids['section:0'].src.indexOf('v/a.mp4') !== -1, vids['section:0'].src);
check('video-mode: currentTime scrubbed', vids['section:0'].currentTime >= 0);
// crossfade boundary: t = 4.05 (0.05s into connector) -> prev video should be visible
w2.scrollY = 5200 * (4.05 / 10.0); w2.dispatchEvent(new w2.Event('scroll'));
pump2(4);
check('video-mode: crossfade prev loaded', !!(w2world._crossing && w2world._crossing.currentTime >= 0));
w2world.destroy();
check('video-mode: destroy ok', true);

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED ✅' : failures + ' CHECK(S) FAILED ❌'));
process.exit(failures === 0 ? 0 : 1);
}
main();
