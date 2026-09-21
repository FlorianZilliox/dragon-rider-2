import { J } from './etat.js';

// ================= Son : bruitages synthétisés (M : couper) =================
J.actx = null; J.muet = false; J.bruitBuf = null;
try { J.muet = localStorage.getItem('dragon-rider-muet') === '1'; } catch {}
export function reveillerSon() {
  if (!J.actx) { try { J.actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; } }
  if (J.actx.state === 'suspended') J.actx.resume();
}
export function bruit() {
  if (!J.bruitBuf) {
    J.bruitBuf = J.actx.createBuffer(1, J.actx.sampleRate * 2, J.actx.sampleRate);
    const d = J.bruitBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = J.actx.createBufferSource(); s.buffer = J.bruitBuf; return s;
}
export function env(g, t, a, d, v) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
export function osc(type, f0, f1, t, d, v, sortie) {
  const o = J.actx.createOscillator(), g = J.actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
  env(g, t, 0.005, d, v); o.connect(g).connect(sortie); o.start(t); o.stop(t + d + 0.05);
}
export function souffle(filtre, f0, f1, t, d, v, sortie, q = 1, attaque = 0.008) {
  const s = bruit(), f = J.actx.createBiquadFilter(), g = J.actx.createGain();
  f.type = filtre; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + d);
  env(g, t, attaque, d, v); s.connect(f).connect(g).connect(sortie); s.start(t); s.stop(t + d + 0.1);
}
export function sfx(nom, delai = 0) {
  if (J.muet || !J.actx || J.actx.state !== 'running') return;
  const t = J.actx.currentTime + delai, out = J.actx.createGain();
  out.gain.value = 0.32; out.connect(J.actx.destination);
  switch (nom) {
    case 'feu': souffle('bandpass', 2000, 360, t, 0.26, 0.9, out, 1.4); osc('square', 300, 85, t, 0.14, 0.1, out); break;
    case 'boum': souffle('lowpass', 1200, 110, t, 0.38, 1, out); osc('triangle', 160, 38, t, 0.3, 0.4, out); break;
    case 'aie': osc('square', 480, 110, t, 0.3, 0.2, out); osc('square', 460, 100, t + 0.02, 0.3, 0.1, out); break;
    case 'ruee': souffle('highpass', 500, 3400, t, 0.28, 0.5, out); break;
    case 'pose': osc('sine', 110, 42, t, 0.18, 0.6, out); souffle('lowpass', 500, 90, t, 0.14, 0.4, out); break;
    case 'envol': souffle('bandpass', 380, 1300, t, 0.22, 0.45, out, 0.8); break;
    case 'battement': souffle('lowpass', 380, 150, t, 0.09, 0.2, out); break;
    case 'combo': osc('square', 880, 880, t, 0.05, 0.07, out); osc('square', 1175, 1175, t + 0.06, 0.08, 0.07, out); break;
    case 'glas': [1, 2, 2.76, 5.4].forEach((m, i) => osc('sine', 98 * m, 98 * m * 0.995, t, 2.6 - i * 0.45, [0.55, 0.22, 0.16, 0.07][i], out)); break;
    case 'tonnerre': souffle('lowpass', 420, 45, t, 1.9, 1, out, 0.6, 0.06); break;
    case 'orbe': osc('triangle', 300, 150, t, 0.18, 0.18, out); break;
    case 'soin': [587, 784, 1047].forEach((f, i) => osc('sine', f, f, t + i * 0.07, 0.12, 0.2, out)); break;
    case 'touche': osc('square', 200, 90, t, 0.07, 0.12, out); break;
    case 'veilleur': osc('sawtooth', 100, 34, t, 1.2, 0.22, out); souffle('lowpass', 600, 70, t, 1.3, 0.8, out); break;
    case 'chute': osc('square', 380, 50, t, 0.9, 0.14, out); break;
  }
}
