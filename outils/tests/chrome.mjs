// Trouve Chrome (ou Chromium, Edge) sur cette machine pour les robots de test.
// Ordre : la variable CHROME si elle est définie, puis les emplacements habituels (macOS, Linux, Windows).
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

export function trouverChrome() {
  const candidats = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    `${process.env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ].filter(Boolean);
  for (const c of candidats) if (existsSync(c)) return c;
  for (const nom of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { return execSync(`command -v ${nom}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
  }
  console.error("\n✗ Chrome introuvable : les robots de test en ont besoin.\n  Installer Google Chrome, ou indiquer son emplacement :  CHROME=/chemin/vers/chrome node outils/tests/…\n");
  process.exit(1);
}
