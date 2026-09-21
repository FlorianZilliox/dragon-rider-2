// Bande d'animation : pose le dragon (#essai), tient des touches, capture N images zoomées sur lui à intervalle régulier.
// node outils/tests/bande.mjs <url> <sortie.png> <acte> <sol|vol> <tx> <ty> <touches|-> <n> <intervalle_ms> [attente_ms] [avant:touches:ms | eval:expression]
import { spawn } from 'node:child_process';
import { trouverChrome } from './chrome.mjs';
import { adresseDuJeu } from './serveur.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const [,, adresse, sortie, acte, mode, tx, ty, touches, n = '8', pas = '60', attente = '600', avant = ''] = process.argv;
const url = await adresseDuJeu(adresse);
const dossier = path.dirname(sortie); mkdirSync(dossier, { recursive: true });
const chrome = trouverChrome();
const port = 9200 + Math.floor(Math.random() * 300);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,760', `--user-data-dir=${dossier}/p${port}`, 'about:blank'], { stdio: 'ignore' });
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
await cmd('Page.navigate', { url: url + '#essai#calme#niveau=' + acte }); await sleep(1400);
await key('keyDown', 'x'); await sleep(50); await key('keyUp', 'x'); await sleep(4300);
await ev(`window.__essai.${mode === 'vol' ? 'voler' : 'poser'}(${tx}, ${ty})`); await sleep(+attente);
if (avant.startsWith('eval:')) await cmd('Runtime.evaluate', { expression: avant.slice(5) });   // eval:<expression> : un événement juste avant la capture
else if (avant) { const [, ks, ms] = avant.split(':'); for (const k of ks.split('+')) await key('keyDown', k); await sleep(+ms); for (const k of ks.split('+')) await key('keyUp', k); }
const ts = touches === '-' ? [] : touches.split('+');
for (const k of ts) await key('keyDown', k);
const images = [];
for (let i = 0; i < +n; i++) {
  const e = JSON.parse(await ev('JSON.stringify(window.__dragonRider())'));
  const x = Math.max(0, e.sx * 3 - 190), y = Math.max(0, e.sy * 3 - 110);
  const r = await cmd('Page.captureScreenshot', { format: 'png', clip: { x, y, width: 380, height: 200, scale: 1 } });
  images.push(Buffer.from(r.result.data, 'base64'));
  await sleep(+pas);
}
for (const k of ts) await key('keyUp', k);
images.forEach((b, i) => writeFileSync(sortie.replace('.png', `-${i}.png`), b));
console.log(`${images.length} images → ${sortie.replace('.png', '-*.png')}`); console.log(logs.join('\n') || '(aucune erreur)');
ws.close(); proc.kill();
