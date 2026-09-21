// Inspection de l'animation : enregistre à chaque image (rAF) la pose, la position du dragon à l'écran et la caméra
// pendant un parcours scripté, puis mesure : changements de pose (sauts d'image), tressautement au sous-pixel, à-coups de caméra.
// node outils/tests/inspection.mjs <url du jeu> <dossier>
import { spawn } from 'node:child_process';
import { trouverChrome } from './chrome.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const [,, url, out] = process.argv;
mkdirSync(out, { recursive: true });
const port = 9100 + Math.floor(Math.random() * 300);
const chrome = spawn(trouverChrome(), ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,760', `--user-data-dir=${out}/p${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const logs = [];
for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json`); const t = (await r.json()).find((x) => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.onopen = r);
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(d.params.exceptionDetails).slice(0, 700)); };
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const K = { ArrowUp: [38, 'ArrowUp'], ArrowDown: [40, 'ArrowDown'], ArrowRight: [39, 'ArrowRight'], ArrowLeft: [37, 'ArrowLeft'], x: [88, 'KeyX'], c: [67, 'KeyC'] };
const key = (type, k) => cmd('Input.dispatchKeyEvent', { type, key: k, code: K[k][1], windowsVirtualKeyCode: K[k][0] });
const ev = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true })).result.result.value;
await cmd('Runtime.enable'); await cmd('Page.enable');
await cmd('Page.navigate', { url: url + '#essai#calme' }); await sleep(1400);
await key('keyDown', 'x'); await sleep(50); await key('keyUp', 'x'); await sleep(4300);
await ev('window.__essai.poser(8, 12)'); await sleep(500);
// enregistreur : une mesure par image affichée
await ev(`window.__traces = []; (function f(t) { const e = window.__dragonRider(); window.__traces.push([t, e.mode, e.visuel, e.px, e.py, e.cx, e.cy, e.fs]); if (window.__traces.length < 1400) requestAnimationFrame(f); })(performance.now());`);
const tenir = async (ks, ms) => { for (const k of ks) await key('keyDown', k); await sleep(ms); for (const k of ks) await key('keyUp', k); };
const etapes = [
  ['marche', () => tenir(['ArrowRight'], 1500)],
  ['arret', () => sleep(700)],
  ['feu au sol', () => tenir(['x'], 500)],
  ['demi-tour au sol', () => tenir(['ArrowLeft'], 600)],
  ['décollage', () => tenir(['ArrowUp'], 900)],
  ['vol', () => tenir(['ArrowRight'], 1200)],
  ['demi-tour en vol', () => tenir(['ArrowLeft'], 700)],
  ['ruée', async () => { await key('keyDown', 'c'); await sleep(60); await key('keyUp', 'c'); await sleep(600); }],
  ['piqué et atterrissage', () => tenir(['ArrowDown'], 1600)],
  ['repos', () => sleep(800)],
];
const temps = [];
for (const [nom, f] of etapes) { temps.push([nom, await ev('performance.now()')]); await f(); }
await sleep(300);
const T = await ev('JSON.stringify(window.__traces)');
writeFileSync(`${out}/traces.json`, T);
const tr = JSON.parse(T);
const etapeDe = (t) => { let n = '—'; for (const [nom, t0] of temps) if (t >= t0) n = nom; return n; };
// 1. changements de pose
console.log('— Poses successives —');
let prec = null;
for (const [t, mode, vis] of tr) { const cle = mode + ' / ' + vis.replace(/ \d+$/, ''); if (cle !== prec) { console.log(`${(t / 1000).toFixed(2)}s  [${etapeDe(t)}]  ${mode} · ${vis}`); prec = cle; } }
// 2. tressautement : position à l'écran affichée vs exacte
let saccades = 0, n = 0; const parEtape = {};
for (let i = 2; i < tr.length; i++) {
  const ecr = (k) => [Math.round(tr[k][3] - tr[k][5]), Math.round(tr[k][4] - tr[k][6])];   // comme le jeu le dessine désormais
  const exact = (k) => [tr[k][3] - tr[k][5], tr[k][4] - tr[k][6]];
  const [a, b, c] = [ecr(i - 2), ecr(i - 1), ecr(i)], [ea, eb, ec] = [exact(i - 2), exact(i - 1), exact(i)];
  for (const j of [0, 1]) {
    const aller = b[j] - a[j], retour = c[j] - b[j];
    if (aller * retour < 0 && Math.abs(ec[j] - ea[j]) < 1) { saccades++; const e = etapeDe(tr[i][0]); parEtape[e] = (parEtape[e] || 0) + 1; }   // va-et-vient d'un pixel sans vrai mouvement
    n++;
  }
}
console.log(`— Tressautement au sous-pixel : ${saccades} va-et-vient sur ${n} mesures —`, JSON.stringify(parEtape));
// 3. à-coups de caméra
let acoups = 0;
for (let i = 2; i < tr.length; i++) { const v1 = tr[i - 1][6] - tr[i - 2][6], v2 = tr[i][6] - tr[i - 1][6]; if (Math.abs(v2 - v1) > 1.2) acoups++; }
console.log(`— À-coups verticaux de caméra : ${acoups} —`);
const dts = tr.slice(1).map((x, i) => x[0] - tr[i][0]); dts.sort((a, b) => a - b);
console.log(`— Images : ${tr.length}, intervalle médian ${dts[dts.length >> 1].toFixed(1)} ms, 99e centile ${dts[Math.floor(dts.length * 0.99)].toFixed(1)} ms —`);
console.log(logs.join('\n') || '(aucune erreur)');
ws.close(); chrome.kill();
