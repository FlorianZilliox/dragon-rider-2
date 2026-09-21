// Écran titre : capture du menu, descente sur COMMANDES, écran des commandes, retour.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const [,, url, out, w = '1280', h = '760'] = process.argv;
mkdirSync(out, { recursive: true });
const port = 9500 + Math.floor(Math.random() * 300);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--window-size=${w},${h}`, `--user-data-dir=${out}/p${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const logs = [];
for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json`); const t = (await r.json()).find((x) => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.onopen = r);
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(d.params.exceptionDetails).slice(0, 900)); };
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const K = { ArrowDown: [40, 'ArrowDown'], x: [88, 'KeyX'] };
const tap = async (k) => { await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: K[k][1], windowsVirtualKeyCode: K[k][0] }); await sleep(60); await cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: K[k][1], windowsVirtualKeyCode: K[k][0] }); };
const shot = async (n) => { const r = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${n}.png`, Buffer.from(r.result.data, 'base64')); };
await cmd('Runtime.enable'); await cmd('Page.enable'); await cmd('Page.navigate', { url }); await sleep(2000);
await shot('1-menu'); await tap('ArrowDown'); await sleep(400); await shot('2-commandes-choisi');
await tap('x'); await sleep(500); await shot('3-ecran-commandes'); await tap('x'); await sleep(400); await shot('4-retour');
const e = (await cmd('Runtime.evaluate', { expression: 'JSON.stringify(window.__dragonRider())', returnByValue: true })).result.result.value;
console.log(e.slice(0, 60)); console.log(logs.join('\n') || '(aucune erreur)');
ws.close(); chrome.kill();
