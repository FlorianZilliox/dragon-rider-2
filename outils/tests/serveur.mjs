// L'adresse du jeu pour les robots : une adresse http(s) donnée telle quelle, sinon la PWA de dist/ servie ici,
// sur un port libre, le temps du test (lancer d'abord  npm run build).
//   « - » ou « »   → le jeu local        « #essai… » → le jeu local, avec ces raccourcis
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.map': 'application/json' };

export async function adresseDuJeu(arg = '-') {
  if (/^https?:\/\//.test(arg)) return arg;
  if (!existsSync(join(DIST, 'index.html'))) { console.error("\n✗ dist/ absent : lancer d'abord  npm run build\n"); process.exit(1); }
  const serveur = createServer(async (req, res) => {
    const chemin = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    try {
      const f = join(DIST, chemin.endsWith('/') ? chemin + 'index.html' : chemin);
      res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
      res.end(await readFile(f));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  serveur.unref();                                    // le test peut se terminer sans l'arrêter
  return `http://127.0.0.1:${serveur.address().port}/${arg.startsWith('#') ? arg : ''}`;
}
