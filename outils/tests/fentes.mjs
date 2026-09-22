// Fentes : pendant chaque animation, repère les pixels du fond (atelier, fond uni) enfermés dans la silhouette du dragon
// — les trous qui s'ouvrent aux articulations quand une pièce bouge. Mesure exacte, sur les pixels du jeu (pas une capture).
// node outils/tests/fentes.mjs [adresse] [dossier]     (après npm run build)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { trouverChrome } from './chrome.mjs';
import { adresseDuJeu } from './serveur.mjs';

const [,, adresse = '-', out = 'essais/fentes'] = process.argv;
mkdirSync(out, { recursive: true });
const url = await adresseDuJeu(adresse);
const port = 9400 + Math.floor(Math.random() * 300);
const chrome = spawn(trouverChrome(), ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,760', `--user-data-dir=${out}/p${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const logs = [];
for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json`); const t = (await r.json()).find((x) => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.onopen = r);
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300)); };
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.result?.value;
const K = { ArrowUp: [38, 'ArrowUp'], ArrowDown: [40, 'ArrowDown'], ArrowRight: [39, 'ArrowRight'], ArrowLeft: [37, 'ArrowLeft'], x: [88, 'KeyX'] };
const key = (type, k) => cmd('Input.dispatchKeyEvent', { type, key: k, code: K[k][1], windowsVirtualKeyCode: K[k][0] });

// côté page : compte les pixels du fond enfermés dans la silhouette, autour du dragon, à chaque image, pendant « ms »
const mesurer = (ms) => ev(`new Promise((ok) => {
  const c = document.getElementById('ecran'), g = c.getContext('2d'), fond = [157, 157, 152], res = { images: 0, trous: 0, pire: 0, lieux: {} };
  const fin = performance.now() + ${ms};
  (function f() {
    const e = window.__dragonRider(), x0 = Math.max(0, e.sx - 90), y0 = Math.max(0, e.sy - 60), w = Math.min(c.width - x0, 180), h = Math.min(c.height - y0, 110);
    const d = g.getImageData(x0, y0, w, h).data, estFond = (i) => Math.abs(d[i] - fond[0]) < 3 && Math.abs(d[i + 1] - fond[1]) < 3 && Math.abs(d[i + 2] - fond[2]) < 3;
    let n = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!estFond((y * w + x) * 4)) continue;
      let dragon = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !estFond(((y + dy) * w + x + dx) * 4)) dragon++;
      if (dragon >= 6) { n++; const k = Math.round((x0 + x - e.sx) / 4) * 4 + ',' + Math.round((y0 + y - e.sy) / 4) * 4; res.lieux[k] = (res.lieux[k] || 0) + 1; }
    }
    res.images++; res.trous += n; res.pire = Math.max(res.pire, n);
    if (performance.now() < fin) requestAnimationFrame(f); else ok(JSON.stringify(res));
  })();
})`);
await cmd('Runtime.enable'); await cmd('Page.enable');
await cmd('Page.navigate', { url: url + '#essai#calme#atelier' }); await sleep(1500);
await key('keyDown', 'x'); await sleep(50); await key('keyUp', 'x'); await sleep(4300);
const bilan = [];
const essai = async (nom, preparer, action, ms = 1500) => {
  await ev(preparer); await sleep(400);
  if (action) for (const k of action.split('+')) await key('keyDown', k);
  const r = JSON.parse(await mesurer(ms));
  if (action) for (const k of action.split('+')) await key('keyUp', k);
  const lieux = Object.entries(r.lieux).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `(${k}):${v}`).join(' ');
  bilan.push({ nom, moyenne: +(r.trous / r.images).toFixed(1), pire: r.pire, lieux });
};
await essai('repos au sol', 'window.__essai.poser(8, 15)', null, 2500);
await essai('marche et course', 'window.__essai.poser(8, 15)', 'ArrowRight', 1800);
await essai('jet de feu au sol', 'window.__essai.poser(8, 15)', 'x', 1500);
await essai('vol en montée', 'window.__essai.voler(20, 8)', 'ArrowUp', 1500);
await essai('vol en piqué', 'window.__essai.voler(20, 4)', 'ArrowDown', 900);
await essai('vol et feu', 'window.__essai.voler(20, 8)', 'x', 1500);
await essai('coup au sol', 'window.__essai.poser(8, 15); window.__essai.coup()', null, 1200);
console.log('fentes (pixels de fond enfermés dans la silhouette) — moyenne par image, pire image, lieux (x,y autour du dragon):nombre');
for (const b of bilan) console.log(`${b.nom.padEnd(18)} moyenne ${String(b.moyenne).padStart(5)}  pire ${String(b.pire).padStart(3)}  ${b.lieux}`);
writeFileSync(`${out}/fentes.json`, JSON.stringify(bilan, null, 1));
console.log(logs.join('\n') || '(aucune erreur)');
ws.close(); chrome.kill(); process.exit(0);
