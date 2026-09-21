// Téléphone simulé : la PWA servie en local (dist/), écran tactile en paysage.
// Vérifie : chargement sans erreur, service worker et cache, jeu hors ligne, croix au glissé (8 directions),
// boutons, portrait (demande de tourner + pause), marges d'encoche. Captures dans <dossier>.
// node outils/tests/mobile.mjs <dossier>      (après npm run build)
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trouverChrome } from './chrome.mjs';

const [,, out = 'essais-mobile'] = process.argv;
mkdirSync(out, { recursive: true });
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist');
if (!existsSync(join(DIST, 'index.html'))) { console.error('\n✗ dist/ absent : lancer d\'abord  npm run build\n'); process.exit(1); }

// un petit serveur statique pour dist/
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const serveur = createServer(async (req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { const f = join(DIST, chemin.endsWith('/') ? chemin + 'index.html' : chemin); res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://127.0.0.1:${serveur.address().port}/`;

const port = 9600 + Math.floor(Math.random() * 300);
const chrome = spawn(trouverChrome(), ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=844,390', `--user-data-dir=${out}/p${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const logs = [];
for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json`); const t = (await r.json()).find((x) => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.onopen = r);
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(d.params.exceptionDetails).slice(0, 500)); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push('console.error ' + JSON.stringify(d.params.args).slice(0, 300)); };
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.result?.value;
const shot = async (nom) => { const r = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${nom}.png`, Buffer.from(r.result.data, 'base64')); };
const ecran = (l, h) => cmd('Emulation.setDeviceMetricsOverride', { width: l, height: h, deviceScaleFactor: 3, mobile: true, screenOrientation: l > h ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 } });
const toucher = (type, points) => cmd('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], i) => ({ x, y, id: i + 1 })) });
const bilan = []; const verifier = (ok, texte) => { bilan.push(`${ok ? '✓' : '✗'} ${texte}`); };

await cmd('Runtime.enable'); await cmd('Page.enable');
await ecran(844, 390);
await cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await cmd('Page.navigate', { url: url + '#essai' }); await sleep(2500);

// 1. chargement, manette, cache hors ligne
verifier(await ev(`document.getElementById('jeu').classList.contains('tactile')`), 'manette tactile affichée');
verifier(await ev(`navigator.serviceWorker.ready.then(() => true)`), 'service worker actif');
await sleep(1500);
const cache = await ev(`caches.keys().then((k) => Promise.all(k.map((c) => caches.open(c).then((x) => x.keys())))).then((l) => l.flat().length)`);
verifier(cache > 20, `fichiers en cache : ${cache}`);
const taille = await ev(`(() => { const c = document.getElementById('ecran'); const r = c.getBoundingClientRect(); return [c.width, c.height, r.width, r.height, devicePixelRatio]; })()`);
verifier(taille && Math.abs((taille[2] * taille[4]) / taille[0] - Math.round((taille[2] * taille[4]) / taille[0])) < 1e-3, `écran ${taille[0]}×${taille[1]} pixels de jeu, ${(taille[2] * taille[4] / taille[0]).toFixed(2)} pixels physiques par pixel (entier)`);
await shot('1-titre-paysage');

// 2. la croix : on lance la partie (toucher l'écran), puis le pouce glisse de ← à ↖ à ↑ sans se lever
await toucher('touchStart', [[422, 150]]); await sleep(60); await toucher('touchEnd', []); await sleep(4800);
const croix = await ev(`(() => { const r = document.querySelector('.croix-dessin').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; })()`);
const [cx, cy, cl] = croix, R = cl * 0.4;
const bras = () => ev(`[...document.querySelectorAll('.bras.on')].map((b) => b.dataset.dir).sort().join('+')`);
await toucher('touchStart', [[cx - R, cy]]); await sleep(80); const g1 = await bras();
await toucher('touchMove', [[cx - R * 0.7, cy - R * 0.7]]); await sleep(80); const g2 = await bras();
await toucher('touchMove', [[cx, cy - R]]); await sleep(80); const g3 = await bras();
await toucher('touchMove', [[cx + R * 1.6, cy - R * 0.2]]); await sleep(80); const g4 = await bras();   // hors du dessin : toujours suivi
await toucher('touchMove', [[cx + 2, cy + 1]]); await sleep(80); const g5 = await bras();                // zone morte
verifier(g1 === 'left' && g2 === 'left+up' && g3 === 'up' && g4 === 'right' && g5 === '', `croix au glissé : ${[g1, g2, g3, g4, g5].map((g) => g || '∅').join(' → ')}`);
// deux doigts : on vole à droite en crachant le feu
const btn = await ev(`(() => { const r = document.querySelector('[data-k=fire]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
const x0 = JSON.parse(await ev('JSON.stringify(window.__dragonRider())')).x;
await toucher('touchMove', [[cx + R, cy - R * 0.3], btn]); await sleep(1200);
const pendant = await ev(`[...document.querySelectorAll('.rond.on')].map((b) => b.dataset.k).join('+')`);
await shot('2-deux-doigts');
await toucher('touchEnd', []); await sleep(200);
const x1 = JSON.parse(await ev('JSON.stringify(window.__dragonRider())')).x;
verifier(pendant === 'fire' && x1 > x0 + 40, `deux doigts : feu tenu (${pendant || '∅'}), le dragon avance (${x0} → ${x1})`);
verifier(await ev(`document.querySelectorAll('.on').length`) === 0, 'tout est relâché quand les doigts se lèvent');

// 3. portrait : on demande de tourner, la partie est en pause
await ecran(390, 844); await sleep(600);
verifier(await ev(`getComputedStyle(document.querySelector('.tourner')).display !== 'none'`), 'portrait : « Tournez l\'appareil »');
const p0 = JSON.parse(await ev('JSON.stringify(window.__dragonRider())')); await sleep(800);
const p1 = JSON.parse(await ev('JSON.stringify(window.__dragonRider())'));
verifier(p0.x === p1.x && p0.y === p1.y, 'portrait : la partie est figée');
await shot('3-portrait');
await ecran(844, 390); await sleep(600);
await shot('4-retour-paysage-pause');
await toucher('touchStart', [[422, 150]]); await sleep(60); await toucher('touchEnd', []); await sleep(600);
const p2 = JSON.parse(await ev('JSON.stringify(window.__dragonRider())')); await sleep(600);
const p3 = JSON.parse(await ev('JSON.stringify(window.__dragonRider())'));
verifier(p2.y !== p3.y || p2.x !== p3.x || p3.mode !== p2.mode || p3.souffle !== p2.souffle, 'un toucher reprend la partie');

// 4. hors ligne : on recharge sans réseau
await cmd('Network.enable');
await cmd('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await cmd('Page.reload'); await sleep(2500);
verifier(await ev(`typeof window.__dragonRider === 'function' && window.__dragonRider().etat === 'titre'`), 'hors ligne : le jeu se recharge depuis le cache');
await shot('5-hors-ligne');

console.log(bilan.join('\n'));
console.log(logs.join('\n') || '(aucune erreur)');
ws.close(); chrome.kill(); serveur.close();
process.exit(bilan.some((l) => l.startsWith('✗')) || logs.length ? 1 : 0);
