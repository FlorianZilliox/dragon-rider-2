// Survol : un robot traverse un niveau d'ouest en est en vol, à une altitude de croisière (il monte quand il est trop
// bas, se laisse aller sinon), et mesure ce qui rend le vol laborieux : les blocages (il n'avance plus), les montées
// forcées, le souffle épuisé. Sans ennemis.
//   node outils/tests/survol.mjs [adresse] [dossier] [niveau=3] [rangée de croisière=9] [secondes=40]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { trouverChrome } from './chrome.mjs';
import { adresseDuJeu } from './serveur.mjs';

const [, , adresse = '-', out = 'essais/survol', niveau = '3', rangee = '9', duree = '40'] = process.argv;
mkdirSync(out, { recursive: true });
const url = await adresseDuJeu(adresse);
const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn(trouverChrome(), ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,760', `--user-data-dir=${out}/p${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const logs = [];
for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json`); const t = (await r.json()).find((x) => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.onopen = r);
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300)); };
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true })).result.result?.value;
const K = { ArrowUp: [38, 'ArrowUp'], ArrowRight: [39, 'ArrowRight'], x: [88, 'KeyX'] };
const key = (type, k) => cmd('Input.dispatchKeyEvent', { type, key: k, code: K[k][1], windowsVirtualKeyCode: K[k][0] });
await cmd('Runtime.enable'); await cmd('Page.enable');
await cmd('Page.navigate', { url: url + `#essai#calme#niveau=${niveau}` }); await sleep(1500);
await key('keyDown', 'x'); await sleep(50); await key('keyUp', 'x'); await sleep(4300);
const cible = (+rangee + 0.5) * 16;
await key('keyDown', 'ArrowUp'); await sleep(600);
await key('keyDown', 'ArrowRight');
let haut = true, t0 = Date.now(), dernier = null, bloque = 0, montees = 0, epuise = 0, xMax = 0, arret = null;
const trace = [];
while ((Date.now() - t0) / 1000 < +duree) {
  const e = JSON.parse(await ev('JSON.stringify(window.__dragonRider())'));
  const monter = e.py > cible || e.mode !== 'air';
  if (monter !== haut) { await key(monter ? 'keyDown' : 'keyUp', 'ArrowUp'); haut = monter; if (monter) montees++; }
  if (e.souffle <= 0.02) epuise++;
  if (dernier && e.px - dernier.px < 1 && e.px < e.largeur - 64) { if (!arret) arret = Date.now(); }
  else if (arret) { if (Date.now() - arret > 600) bloque++; arret = null; }
  xMax = Math.max(xMax, e.px); trace.push([Math.round((Date.now() - t0) / 100) / 10, Math.round(e.px / 16), Math.round(e.py / 16), e.souffle]);
  dernier = e;
  if (e.px >= e.largeur - 64) break;
  await sleep(100);
}
await key('keyUp', 'ArrowRight'); await key('keyUp', 'ArrowUp');
const s = (Date.now() - t0) / 1000, cols = Math.round(xMax / 16), fini = dernier && dernier.px >= dernier.largeur - 64;
if (arret && Date.now() - arret > 600) bloque++;                  // (un blocage dont il n'est jamais sorti)
console.log(`niveau ${niveau}, croisière rangée ${rangee} : ${cols} colonnes en ${s.toFixed(1)} s (${(cols / s).toFixed(1)} col/s)` +
  (fini ? ', traversé' : `, arrêté à la colonne ${Math.round(dernier.px / 16)} depuis ${arret ? ((Date.now() - arret) / 1000).toFixed(0) : 0} s`));
console.log(`blocages de plus de 0,6 s : ${bloque} · reprises de montée : ${montees} · mesures souffle épuisé : ${epuise}`);
console.log('trace (s, colonne, rangée, souffle) : ' + trace.filter((_, i) => i % 20 === 0).map((t) => `${t[0]}s c${t[1]} r${t[2]} ${t[3]}`).join(' | '));
console.log(logs.join('\n') || '(aucune erreur)');
ws.close(); chrome.kill(); process.exit(0);
