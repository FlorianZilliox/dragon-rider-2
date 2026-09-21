// Joueur automatique « qui lit la carte » : vole vers la droite au-dessus des obstacles, se pose pour reprendre son souffle.
// options : poser:tx:ty (départ), reliques (la porte de chaque acte est ouverte d'office : le robot ne cherche pas les reliques)
import { spawn } from 'node:child_process';
import { trouverChrome } from './chrome.mjs';
import { adresseDuJeu } from './serveur.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const [,, adresse, out, duree = '120', options = ''] = process.argv;
const url = await adresseDuJeu(adresse);
mkdirSync(out, { recursive: true });
const port = 9700 + Math.floor(Math.random() * 200);
const chrome = spawn(trouverChrome(), ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,760', `--user-data-dir=${out}/p${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const logs = [];
for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json`); const t = (await r.json()).find((x) => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.onopen = r);
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(d.params.exceptionDetails).slice(0, 900)); };
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pend.has(i)) { pend.delete(i); console.log('DÉLAI DÉPASSÉ ' + method); r({ result: { result: {} } }); } }, 4000); });
const K = { ArrowUp: [38, 'ArrowUp'], ArrowDown: [40, 'ArrowDown'], ArrowRight: [39, 'ArrowRight'], x: [88, 'KeyX'], c: [67, 'KeyC'] };
const key = (type, k) => cmd('Input.dispatchKeyEvent', { type, key: k, code: K[k][1], windowsVirtualKeyCode: K[k][0] });
const ev = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true })).result.result.value;
await cmd('Runtime.enable'); await cmd('Page.enable'); await cmd('Page.navigate', { url }); await sleep(1500);
await key('keyDown', 'x'); await sleep(60); await key('keyUp', 'x'); await sleep(4300);
if (options.startsWith('poser:')) { const [, tx, ty] = options.split(':'); await ev(`window.__essai.poser(${tx}, ${ty})`); await sleep(300); }
// lecture de la carte côté page : sol et plafond devant le dragon
const lire = `(() => { const e = window.__dragonRider(), c = window.__essai.caseA, TP = 16, tx = Math.floor(e.x / TP), ty = Math.floor(e.y / TP);
  let sol = 1e9, plafond = -1e9;
  for (let x = tx - 1; x <= tx + 7; x++) {
    for (let y = Math.max(0, ty - 1); y < 24; y++) { const t = c(x, y); if (t === 1 || t === 4 || t === 3 || t === 2) { sol = Math.min(sol, y * TP); break; } }
    for (let y = ty; y >= 0; y--) { const t = c(x, y); if (t === 1 || t === 4) { plafond = Math.max(plafond, (y + 1) * TP); break; } }
  }
  return JSON.stringify(Object.assign(e, { solDevant: sol, plafondDevant: plafond })); })()`;
let tenu = new Set();
const tenir = async (voulu) => { for (const k of tenu) if (!voulu.has(k)) await key('keyUp', k); for (const k of voulu) if (!tenu.has(k)) await key('keyDown', k); tenu = voulu; };
const t0 = Date.now(); const journal = []; const push0 = journal.push.bind(journal); journal.push = (l) => { console.log(l); return push0(l); }; let pv = 5, pertes = 0, morts = 0, repos = false, dernierX = 0, bloqueDepuis = 0, acte = 0, debutActe = 0;
while ((Date.now() - t0) / 1000 < +duree) {
  const s = (Date.now() - t0) / 1000;
  const brut = await ev(lire); if (!brut) { console.log('lecture vide'); await sleep(200); continue; }
  const e = JSON.parse(brut);
  if (e.niveau !== acte) { if (acte) journal.push(`${s.toFixed(0)}s niveau ${acte} fini en ${(s - debutActe).toFixed(0)} s`); acte = e.niveau; debutActe = s; }
  if (options.includes('reliques') && e.reliques.split('/')[0] !== e.reliques.split('/')[1]) await ev('window.__essai.reliques()');
  if (e.pv < pv) { pertes += pv - e.pv; journal.push(`${s.toFixed(0)}s -${pv - e.pv} cœur(s) à x=${e.x} y=${e.y} (${e.mode})`); }
  pv = e.pv;
  if (e.etat === 'fin') { morts++; journal.push(`${s.toFixed(0)}s MORT à x=${e.x}`); await tenir(new Set()); await sleep(1300); await key('keyDown', 'x'); await sleep(60); await key('keyUp', 'x'); await sleep(1500); pv = 5; continue; }
  if (e.etat === 'epilogue' || e.arene) { journal.push(`${s.toFixed(0)}s ${e.arene ? 'ARÈNE' : 'ÉPILOGUE'}`); break; }
  const cible = e.plafondDevant > -1e9 && e.solDevant - e.plafondDevant < 110 ? (e.solDevant + e.plafondDevant) / 2 - 6 : e.solDevant - 58;
  const auSol = e.mode === 'ground' || e.mode === 'land';
  if (auSol && e.souffle < 0.35) repos = true;
  if (repos && e.souffle > 0.95) repos = false;
  const v = new Set(auSol ? [] : ['x']);
  if (!repos) {
    v.add('ArrowRight');
    if (e.y > cible + 6) v.add('ArrowUp'); else if (e.y < cible - 24 && !auSol) v.add('ArrowDown');
  }
  if (Math.abs(e.x - dernierX) < 2 && !repos) { if (!bloqueDepuis) bloqueDepuis = s; if (s - bloqueDepuis > 2.5) { journal.push(`${s.toFixed(0)}s BLOQUÉ à x=${e.x} y=${e.y} mode=${e.mode} souffle=${e.souffle}`); bloqueDepuis = s + 5; } } else bloqueDepuis = 0;
  dernierX = e.x;
  await tenir(v);
  if (Math.floor(s) % 15 === 0 && !journal.find((j) => j.startsWith(Math.floor(s) + 's ·'))) journal.push(`${Math.floor(s)}s · niveau ${e.niveau} x=${e.x}/${e.largeur} y=${e.y} pv=${e.pv} souffle=${e.souffle} reliques=${e.reliques} ${e.mode}`);
  await sleep(90);
}
const r = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/fin.png`, Buffer.from(r.result.data, 'base64'));
console.log(`FIN ${ev ? JSON.stringify(JSON.parse(await ev('JSON.stringify(window.__dragonRider())'))) : ''}`);
console.log(`cœurs perdus : ${pertes} · morts : ${morts}`);
console.log(logs.join('\n') || '(aucune erreur)');
ws.close(); chrome.kill();
