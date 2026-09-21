// Scénarios de test : suite d'actions « nom:arg:arg » (nav, poser, voler, souffle, tenir, tap, attendre, etat, shot, eval).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const [,, url, out, ...actions] = process.argv;
mkdirSync(out, { recursive: true });
const port = 9000 + Math.floor(Math.random() * 300);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,760', `--user-data-dir=${out}/p${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const logs = [];
for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json`); const t = (await r.json()).find((x) => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.onopen = r);
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(d.params.exceptionDetails).slice(0, 900)); };
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const K = { ArrowUp: [38, 'ArrowUp'], ArrowDown: [40, 'ArrowDown'], ArrowRight: [39, 'ArrowRight'], ArrowLeft: [37, 'ArrowLeft'], x: [88, 'KeyX'], c: [67, 'KeyC'] };
const key = (type, k) => cmd('Input.dispatchKeyEvent', { type, key: k, code: K[k][1], windowsVirtualKeyCode: K[k][0] });
const ev = async (e) => (await cmd('Runtime.evaluate', { expression: e, returnByValue: true })).result.result.value;
const etat = async () => JSON.parse(await ev('JSON.stringify(window.__dragonRider())'));
await cmd('Runtime.enable'); await cmd('Page.enable');
let n = 0;
for (const a of actions) {
  const [nom, ...arg] = a.split(':');
  if (nom === 'nav') {
    await cmd('Page.navigate', { url: 'about:blank' }); await sleep(300);
    await cmd('Page.navigate', { url: url + '#essai' + (arg[1] ? '' : '#calme') + '#acte=' + arg[0] + (arg[0] === '4' ? '#veilleur' : '') }); await sleep(1400);
    await key('keyDown', 'x'); await sleep(50); await key('keyUp', 'x'); await sleep(4200);
  } else if (nom === 'poser' || nom === 'voler') await ev(`window.__essai.${nom}(${arg[0]}, ${arg[1]})`);
  else if (nom === 'souffle') await ev(`window.__essai.souffle(${arg[0]})`);
  else if (nom === 'tenir') { const ks = arg[0].split('+'); for (const k of ks) await key('keyDown', k); await sleep(+arg[1]); for (const k of ks) await key('keyUp', k); }
  else if (nom === 'tap') { await key('keyDown', arg[0]); await sleep(60); await key('keyUp', arg[0]); }
  else if (nom === 'attendre') await sleep(+arg[0]);
  else if (nom === 'etat') { const e = await etat(); console.log(`[${arg[0] || ''}]`, `mode=${e.mode} x=${e.x} y=${e.y} sol=${e.sol} pv=${e.pv} souffle=${e.souffle} acte=${e.acte} etat=${e.etat} reliques=${e.reliques} reprise=${JSON.stringify(e.reprise)} arene=${e.arene} veilleur=${e.veilleur} score=${e.score}`); }
  else if (nom === 'shot') { const r = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${String(n++).padStart(2, '0')}_${arg[0]}.png`, Buffer.from(r.result.data, 'base64')); }
  else if (nom === 'eval') console.log(`[eval]`, await ev(arg.join(':')));
}
console.log(logs.join('\n') || '(aucune erreur)');
ws.close(); chrome.kill();
