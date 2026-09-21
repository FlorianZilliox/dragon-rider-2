// Banc de performance « téléphone » : processeur ralenti, partie jouée par un robot, mesure des images et de la mémoire.
// node outils/tests/perf.mjs <url du jeu> <dossier> [secondes=90] [ralentissement=4]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const [,, url, out, duree = '90', lent = '4'] = process.argv;
mkdirSync(out, { recursive: true });
const port = 9300 + Math.floor(Math.random() * 300);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=844,390', `--user-data-dir=${out}/p${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const logs = [];
for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json`); const t = (await r.json()).find((x) => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.onopen = r);
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(d.params.exceptionDetails).slice(0, 700)); };
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const K = { ArrowUp: [38, 'ArrowUp'], ArrowRight: [39, 'ArrowRight'], x: [88, 'KeyX'], c: [67, 'KeyC'] };
const key = (type, k) => cmd('Input.dispatchKeyEvent', { type, key: k, code: K[k][1], windowsVirtualKeyCode: K[k][0] });
const ev = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true })).result.result.value;
await cmd('Runtime.enable'); await cmd('Page.enable'); await cmd('Performance.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
await cmd('Page.navigate', { url: url + '#essai' }); await sleep(2000);
await key('keyDown', 'x'); await sleep(50); await key('keyUp', 'x'); await sleep(4300);
// compteur d'ordres de dessin et de durées d'image
await ev(`(() => { const c = document.getElementById('ecran').getContext('2d'); window.__appels = 0;
  for (const f of ['fillRect', 'drawImage']) { const o = c[f].bind(c); c[f] = (...a) => { window.__appels++; return o(...a); }; }
  window.__images = []; let av = performance.now(); let n0 = 0;
  (function f(t) { window.__images.push([t - av, window.__appels - n0]); av = t; n0 = window.__appels; requestAnimationFrame(f); })(performance.now()); })()`);
await cmd('Emulation.setCPUThrottlingRate', { rate: +lent });
const t0 = Date.now(); const tas = [];
await key('keyDown', 'ArrowRight');
while ((Date.now() - t0) / 1000 < +duree) {
  const s = (Date.now() - t0) / 1000;
  if (Math.floor(s * 2) % 5 === 0) { await key('keyDown', 'ArrowUp'); await sleep(300); await key('keyUp', 'ArrowUp'); }
  await key('keyDown', 'x'); await sleep(200); await key('keyUp', 'x');
  if (Math.floor(s) % 7 === 0) { await key('keyDown', 'c'); await sleep(50); await key('keyUp', 'c'); }
  const m = (await cmd('Performance.getMetrics')).result.metrics;
  const g = (n) => (m.find((x) => x.name === n) || {}).value;
  tas.push([s, g('JSHeapUsedSize') / 1e6, g('Nodes')]);
  const e = JSON.parse(await ev('JSON.stringify(window.__dragonRider())'));
  if (e.etat === 'fin') { await key('keyDown', 'x'); await sleep(60); await key('keyUp', 'x'); }
  await sleep(250);
}
await key('keyUp', 'ArrowRight');
const im = JSON.parse(await ev('JSON.stringify(window.__images)')).slice(5);
const d = im.map((x) => x[0]).sort((a, b) => a - b), q = (p) => d[Math.floor(d.length * p)].toFixed(1);
const appels = im.map((x) => x[1]).sort((a, b) => a - b);
const longues = im.filter((x) => x[0] > 50).length, gels = im.filter((x) => x[0] > 200).length;
console.log(`images : ${im.length} · durée médiane ${q(0.5)} ms · 95e ${q(0.95)} ms · 99e ${q(0.99)} ms · max ${d[d.length - 1].toFixed(0)} ms`);
console.log(`images > 50 ms : ${longues} · gels > 200 ms : ${gels}`);
console.log(`ordres de dessin par image : médiane ${appels[appels.length >> 1]} · 95e ${appels[Math.floor(appels.length * 0.95)]}`);
const tiers = (a) => a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : '-';
const n = im.length, part = (i) => im.slice(Math.floor(n * i / 3), Math.floor(n * (i + 1) / 3)).map((x) => x[0]);
console.log(`durée moyenne par tiers de partie : ${tiers(part(0))} / ${tiers(part(1))} / ${tiers(part(2))} ms`);
console.log(`mémoire JS : début ${tas[0][1].toFixed(1)} Mo · fin ${tas[tas.length - 1][1].toFixed(1)} Mo · max ${Math.max(...tas.map((x) => x[1])).toFixed(1)} Mo · nœuds ${tas[0][2]} → ${tas[tas.length - 1][2]}`);
console.log(logs.join('\n') || '(aucune erreur)');
ws.close(); chrome.kill();
