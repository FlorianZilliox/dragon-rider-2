// Cycle : les images exactes d'une foulée du dragon, phase par phase (marche, course…), et le diagramme des appuis.
// Chaque image est celle que le jeu dessinerait à cette phase (__essai.image), sans dépendre du chronomètre.
//   node outils/tests/cycle.mjs [adresse] [dossier] [vitesses=85,150,vol] [images=12]      (après npm run build)
//   « vol » : un battement d'ailes complet.
// Écrit <dossier>/<vitesse>-<i>.png et affiche, pour chaque phase, les pattes en l'air.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { trouverChrome } from './chrome.mjs';
import { adresseDuJeu } from './serveur.mjs';

const [, , adresse = '-', out = 'essais/cycle', vitesses = '85,150', n = '12'] = process.argv;
mkdirSync(out, { recursive: true });
const url = await adresseDuJeu(adresse);
const port = 9600 + Math.floor(Math.random() * 100);
const chrome = spawn(trouverChrome(), ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,760', `--user-data-dir=${out}/p${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const logs = [];
for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json`); const t = (await r.json()).find((x) => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.onopen = r);
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(d.params.exceptionDetails).slice(0, 400)); };
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true })).result.result?.value;
await cmd('Runtime.enable'); await cmd('Page.enable');
await cmd('Page.navigate', { url: url + '#essai#calme#atelier' }); await sleep(1500);
await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'x', code: 'KeyX', windowsVirtualKeyCode: 88 }); await sleep(50);
await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'x', code: 'KeyX', windowsVirtualKeyCode: 88 }); await sleep(4300);
await ev('window.__essai.poser(8, 15)'); await sleep(300);
const CALME = 'dos: 0, onde: 0, dosV: 0, ondeV: 0, cavY: 0, teteY: 0, aileS: 0, queue: 0, q2: 0, q3: 0, penche: 0';
for (const v of vitesses.split(',')) {
  const vol = v === 'vol';                           // « vol » : un battement d'ailes, en montée (amplitude pleine)
  console.log(vol ? '— un battement d\'ailes' : `— vitesse ${v} px/s : pattes en l'air (arrière loin, avant loin, arrière près, avant près)`);
  for (let i = 0; i < +n; i++) {
    const etat = vol ? `{ mode: 'air', ph: ${i / +n}, amp: 1, plane: 0, replie: 0, haut: 0, vx: 0, vy: 0, pitch: 0, bob: -2.6 * Math.sin(2 * Math.PI * (${i / +n} - 0.2)), ${CALME} }`
      : `{ allure: ${i / +n}, vx: ${v}, mode: 'ground', ${CALME} }`;
    if (!vol) await ev('window.__essai.poser(8, 15)'); else await ev('window.__essai.voler(20, 8)');
    const r = await ev(`window.__essai.image(${etat})`);
    if (!r) { logs.push(`${v}/${i} : pas d'image`); continue; }
    writeFileSync(`${out}/${v}-${i}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
    if (!vol) console.log(`  ${(i / +n).toFixed(2)}  ${r.pieds.map((p) => (p.leve ? '▲' : '·')).join(' ')}   ${r.pieds.filter((p) => p.leve).length} en l'air`);
  }
}
console.log(logs.join('\n') || '(aucune erreur)');
ws.close(); chrome.kill(); process.exit(0);
