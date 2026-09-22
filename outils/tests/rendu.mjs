// Rendu : dessine une série de postures figées du dragon (atelier, fond uni) et enregistre chaque image en PNG.
// Sert à comparer deux versions du rendu au pixel près (refonte du moteur, nouvelle découpe) :
//   node outils/tests/rendu.mjs [adresse] [dossier]                 (après npm run build)
//   node outils/tests/rendu.mjs --comparer <dossier-avant> <dossier-apres>
// Chaque posture part de réglages neutres (voir __essai.rendu dans src/js/main.js) et n'en change que quelques-uns.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { trouverChrome } from './chrome.mjs';
import { adresseDuJeu } from './serveur.mjs';

export const POSTURES = {
  'sol-repos': ['sol', {}],
  'vol-repos': ['vol', {}],
  'sol-creuse': ['sol', { dos: 6 }],
  'sol-voute': ['sol', { dos: -6 }],
  'sol-onde': ['sol', { onde: 5 }],
  'sol-tete': ['sol', { tete: { dx: 1, dy: 3, rot: -0.2 } }],
  'sol-cavalier': ['sol', { cavalier: { dy: 2, rot: 0.3 } }],
  'sol-queue': ['sol', { queue: 0.25, queues: { 'queue-2': 0.2, 'queue-3': 0.3 } }],
  'sol-aile': ['sol', { aile: { s: 1.3, sx: 1, rot: -0.2 } }],
  'sol-marche': ['sol', { amp: 1, allure: 0.3, corps: { dx: 0, dy: 1 } }],
  'vol-battement': ['vol', { aile: { s: -0.6, sx: 1, rot: 0.1 }, dos: 3, onde: -2 }],
  'vol-feu': ['vol', { teteVariante: 3, onde: 4 }],
};

if (process.argv[2] === '--comparer') {
  // compare deux dossiers de PNG, pixel à pixel (décodage PNG minimal : zlib, filtres, RGBA 8 bits)
  const { inflateSync } = await import('node:zlib');
  const lire = (f) => {
    const b = readFileSync(f); let o = 8, w, h, idat = [];
    while (o < b.length) { const n = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8); if (t === 'IHDR') { w = b.readUInt32BE(o + 8); h = b.readUInt32BE(o + 12); } if (t === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + n)); o += 12 + n; }
    const r = inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * 4), bpp = 4, L = w * bpp;
    for (let y = 0; y < h; y++) {
      const f = r[y * (L + 1)], lig = r.subarray(y * (L + 1) + 1, (y + 1) * (L + 1)), out = px.subarray(y * L, (y + 1) * L), prec = y ? px.subarray((y - 1) * L, y * L) : Buffer.alloc(L);
      for (let i = 0; i < L; i++) {
        const a = i >= bpp ? out[i - bpp] : 0, b2 = prec[i], c = i >= bpp ? prec[i - bpp] : 0;
        const p = a + b2 - c, pa = Math.abs(p - a), pb = Math.abs(p - b2), pc = Math.abs(p - c);
        out[i] = (lig[i] + [0, a, b2, (a + b2) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b2 : c][f]) & 255;
      }
    }
    return { w, h, px };
  };
  const [, , , A, B] = process.argv;
  for (const f of readdirSync(A).filter((f) => f.endsWith('.png')).sort()) {
    if (!existsSync(`${B}/${f}`)) { console.log(`${f.padEnd(20)} absent de ${B}`); continue; }
    const a = lire(`${A}/${f}`), b = lire(`${B}/${f}`);
    let n = 0;
    for (let i = 0; i < a.px.length; i += 4) if (a.px[i] !== b.px[i] || a.px[i + 1] !== b.px[i + 1] || a.px[i + 2] !== b.px[i + 2]) n++;
    console.log(`${f.padEnd(20)} ${n ? n + ' pixels différents' : 'identique'}`);
  }
  process.exit(0);
}

const [, , adresse = '-', out = 'essais/rendu'] = process.argv;
mkdirSync(out, { recursive: true });
const url = await adresseDuJeu(adresse);
const port = 9700 + Math.floor(Math.random() * 200);
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
for (const [nom, [pose, o]] of Object.entries(POSTURES)) {
  await ev(pose === 'sol' ? 'window.__essai.poser(8, 15)' : 'window.__essai.voler(20, 8)'); await sleep(300);
  const png = await ev(`window.__essai.rendu(${JSON.stringify(pose)}, ${JSON.stringify(o)})`);
  if (!png) { logs.push(`${nom} : pas d'image`); continue; }
  writeFileSync(`${out}/${nom}.png`, Buffer.from(png.split(',')[1], 'base64'));
}
console.log(`${Object.keys(POSTURES).length} postures → ${out}/`);
console.log(logs.join('\n') || '(aucune erreur)');
ws.close(); chrome.kill(); process.exit(0);
