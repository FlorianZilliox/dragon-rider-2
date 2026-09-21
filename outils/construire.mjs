// Assemble Dragon Rider depuis src/ en deux sorties, à partir des mêmes sources :
//   dist/              la PWA, à publier telle quelle (index.html, jeu.js, styles.css, images/, manifeste, sw.js) ;
//   Dragon-Rider.html  le fichier unique : double-clic pour jouer, hors ligne, rien à installer.
// Les données du jeu forment le module « donnees.js », fabriqué ici (il n'existe pas dans src/) :
//   - le dragon de Pixel Artist (assets/pixel-artist/dragon*.png|json) ;
//   - les décors peints (assets/decors/*.json et leurs images) ;
//   - les cartes texte des actes (niveaux/<cle>.txt).
//
// Usage : npm run build   les deux sorties
//         npm run dev     serveur local (http://localhost:8000) qui reconstruit à chaque modification
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, watch } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(RACINE, 'src'), DIST = join(RACINE, 'dist');
const DEV = process.argv.includes('--dev');

function arreter(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

let esbuild;
try { esbuild = await import('esbuild'); }
catch { arreter("l'outil d'assemblage (esbuild) n'est pas installé.\n  Dans le dossier du jeu, lancer une fois :  npm install\n  puis recommencer :  npm run build"); }

// ---------- les données : dragon, décors, niveaux ----------
// images : 'fichier' (chemin relatif, pour la PWA) ou 'integre' (data: URL, pour le fichier unique)
function donnees(images) {
  const PIXEL = join(RACINE, 'assets', 'pixel-artist');
  for (const f of ['dragon.png', 'dragon.json', 'dragon_propre.png', 'dragon_propre.json'])
    if (!existsSync(join(PIXEL, f))) arreter(`${f} absent : lancer d'abord  python3 pixel_artist/pixel_artist.py`);
  // les cartes : niveaux/<cle>.txt, une par acte (la liste des actes est dans src/js/config.js)
  const NIV = join(RACINE, 'niveaux');
  const niveaux = existsSync(NIV) ? readdirSync(NIV).filter((f) => f.endsWith('.txt')).sort() : [];
  if (!niveaux.length) arreter('aucune carte dans niveaux/ (un fichier <cle>.txt par acte)');
  const DECORS = join(RACINE, 'assets', 'decors');
  const descripteurs = existsSync(DECORS) ? readdirSync(DECORS).filter((f) => f.endsWith('.json')).sort() : [];
  if (!descripteurs.length) arreter('décors absents : lancer  python3 pixel_artist/pixeliser.py art/recettes/<acte>.json  pour chaque recette');

  const copies = new Map();   // chemin publié → fichier source
  const image = (source, publie) => {
    if (images === 'integre') return 'data:image/png;base64,' + readFileSync(source).toString('base64');
    copies.set(publie, source);
    return publie;
  };
  const art = {};
  for (const desc of descripteurs) {
    const d = JSON.parse(readFileSync(join(DECORS, desc), 'utf8'));
    for (const [nom, { image: fichier, ...reste }] of Object.entries(d.elements))
      art[`${d.nom}/${nom}`] = { ...reste, src: image(join(DECORS, fichier), `images/decors/${fichier}`) };
  }
  const pixel = JSON.parse(readFileSync(join(PIXEL, 'dragon.json'), 'utf8'));
  pixel.planche = JSON.parse(readFileSync(join(PIXEL, 'dragon_propre.json'), 'utf8'));
  const js = (v) => JSON.stringify(v);
  const code = [
    '// Fabriqué par outils/construire.mjs : ne pas modifier (voir assets/ et niveaux/).',
    `export const PIXEL = ${js(pixel)};`,
    `export const ATLAS = ${js(image(join(PIXEL, 'dragon.png'), 'images/dragon.png'))};`,
    `export const PLANCHE = ${js(image(join(PIXEL, 'dragon_propre.png'), 'images/dragon_propre.png'))};`,
    `export const ART = ${js(art)};`,
    `export const NIVEAUX = ${js(Object.fromEntries(niveaux.map((f) => [f.slice(0, -4), readFileSync(join(NIV, f), 'utf8')])))};`,
  ].join('\n');
  return { code, copies };
}

// navigateurs visés : ceux des téléphones et ordinateurs de ces cinq dernières années
const NAVIGATEURS = ['safari15', 'chrome96', 'firefox96', 'edge96'];

// le module donnees.js est fourni par l'assemblage
const pluginDonnees = (code) => ({
  name: 'donnees',
  setup(b) {
    b.onResolve({ filter: /^\.\/donnees\.js$/ }, () => ({ path: 'donnees.js', namespace: 'donnees' }));
    b.onLoad({ filter: /.*/, namespace: 'donnees' }, () => ({ contents: code, loader: 'js' }));
  },
});

const optionsJs = (code, format) => ({
  entryPoints: [join(SRC, 'js', 'main.js')],
  bundle: true, format, target: NAVIGATEURS, charset: 'utf8', legalComments: 'none',
  minify: !DEV, sourcemap: DEV ? 'linked' : false, logLevel: 'silent',
  plugins: [pluginDonnees(code)],
});
const optionsCss = { entryPoints: [join(SRC, 'styles.css')], bundle: true, minify: !DEV, target: NAVIGATEURS, logLevel: 'silent' };

// les erreurs d'assemblage, en clair : fichier, ligne, ce qui ne va pas
async function assembler(options) {
  try { return await esbuild.build(options); }
  catch (e) {
    const detail = (e.errors || []).map((x) => x.location ? `  ${relative(RACINE, x.location.file)}:${x.location.line} : ${x.text}` : `  ${x.text}`).join('\n');
    arreter(`le code du jeu contient une erreur, rien n'a été écrit :\n${detail || e.message}`);
  }
}

const empreinte = (...contenus) => { const h = createHash('sha256'); contenus.forEach((c) => h.update(c)); return h.digest('hex').slice(0, 12); };
const html = () => readFileSync(join(SRC, 'index.html'), 'utf8');

// ---------- la PWA : dist/ ----------
async function construirePwa() {
  const { code, copies } = donnees('fichier');
  rmSync(DIST, { recursive: true, force: true });
  await Promise.all([
    assembler({ ...optionsJs(code, 'esm'), outfile: join(DIST, 'jeu.js') }),
    assembler({ ...optionsCss, outfile: join(DIST, 'styles.css') }),
  ]);
  for (const [publie, source] of copies) { mkdirSync(dirname(join(DIST, publie)), { recursive: true }); copyFileSync(source, join(DIST, publie)); }
  const statiques = copierStatiques();
  writeFileSync(join(DIST, 'index.html'), html());
  // le service worker garde tout le jeu en cache : il se joue ensuite sans réseau
  const fichiers = ['./', 'index.html', 'jeu.js', 'styles.css', ...copies.keys(), ...statiques];
  const version = empreinte(...fichiers.filter((f) => f !== './').map((f) => readFileSync(join(DIST, f))));
  writeFileSync(join(DIST, 'sw.js'), readFileSync(join(SRC, 'sw.js'), 'utf8')
    .replace("'__VERSION__'", JSON.stringify(version)).replace('[/*FICHIERS*/]', JSON.stringify(fichiers)));
  return { version, fichiers };
}
// fichiers servis tels quels (manifeste, icônes) : tout src/ sauf le code, la page et les styles
function copierStatiques() {
  const publies = [];
  const parcourir = (dossier) => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, e.name), rel = relative(SRC, chemin);
      if (e.isDirectory()) { if (rel !== 'js') parcourir(chemin); continue; }
      if (['index.html', 'styles.css', 'sw.js'].includes(rel) || e.name.startsWith('.')) continue;
      mkdirSync(dirname(join(DIST, rel)), { recursive: true });
      copyFileSync(chemin, join(DIST, rel));
      publies.push(rel.split('\\').join('/'));
    }
  };
  parcourir(SRC);
  return publies;
}

// ---------- le fichier unique : Dragon-Rider.html ----------
async function construireFichierUnique() {
  const { code } = donnees('integre');
  const [js, css] = await Promise.all([
    assembler({ ...optionsJs(code, 'iife'), minify: true, sourcemap: false, write: false, outfile: 'jeu.js' }),
    assembler({ ...optionsCss, minify: true, write: false, outfile: 'styles.css' }),
  ]);
  const texte = (r) => r.outputFiles[0].text;
  const page = html()
    .replace(/[ \t]*<!-- pwa -->[\s\S]*?<!-- \/pwa -->\n?/g, '')   // manifeste, icônes : inutiles hors d'un site
    .replace(/<link rel="stylesheet" href="styles\.css">/, () => `<style>${texte(css).trim()}</style>`)
    .replace(/<script type="module" src="jeu\.js"><\/script>/, () => `<script>${texte(js).replace(/<\/script/gi, '<\\/script').trim()}</script>`);
  if (/src="jeu\.js"|href="styles\.css"/.test(page)) arreter("src/index.html doit contenir <link rel=\"stylesheet\" href=\"styles.css\"> et <script type=\"module\" src=\"jeu.js\"></script>");
  writeFileSync(join(RACINE, 'Dragon-Rider.html'), page);
  return page.length;
}

// ---------- lancement ----------
if (!DEV) {
  const [{ version, fichiers }, taille] = await Promise.all([construirePwa(), construireFichierUnique()]);
  console.log(`dist/ : PWA prête (${fichiers.length} fichiers en cache, version ${version})`);
  console.log(`Dragon-Rider.html : ${(taille / 1e3).toFixed(0)} Ko`);
} else {
  // développement : dist/ reconstruit à chaque modification de src/, servi en local
  mkdirSync(DIST, { recursive: true });
  rmSync(join(DIST, 'sw.js'), { force: true });
  const { code, copies } = donnees('fichier');
  for (const [publie, source] of copies) { mkdirSync(dirname(join(DIST, publie)), { recursive: true }); copyFileSync(source, join(DIST, publie)); }
  const recopier = () => { copierStatiques(); writeFileSync(join(DIST, 'index.html'), html()); };
  recopier();
  watch(SRC, { recursive: true }, (_, f) => { if (f && !f.startsWith('js')) recopier(); });
  const [ctxJs, ctxCss] = await Promise.all([
    esbuild.context({ ...optionsJs(code, 'esm'), outfile: join(DIST, 'jeu.js'), logLevel: 'info' }),
    esbuild.context({ ...optionsCss, outfile: join(DIST, 'styles.css'), logLevel: 'info' }),
  ]);
  await Promise.all([ctxJs.watch(), ctxCss.watch()]);
  const { port } = await ctxJs.serve({ servedir: DIST, port: 8000 });
  console.log(`\nDragon Rider en développement : http://localhost:${port}   (Ctrl+C pour arrêter)\n`);
}
