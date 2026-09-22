// Service worker : le jeu se joue sans réseau, et prend toujours la dernière version quand il y en a.
// - à l'installation, tout le jeu est mis en cache (la version et la liste des fichiers sont écrites par outils/construire.mjs) ;
// - ensuite, le réseau d'abord : chaque fichier est redemandé (vérification rapide, le serveur répond « inchangé » si
//   rien n'a bougé) et le cache est rafraîchi ; sans réseau, ou s'il tarde plus de 3 s, le cache répond.
const VERSION = "d56f23d4a6b3";
const FICHIERS = ["./","index.html","jeu.js","styles.css","images/decors/cimetiere/lointain.png","images/decors/cimetiere/milieu.png","images/decors/cimetiere/proche.png","images/decors/commun/ciel.png","images/decors/commun/lune.png","images/decors/commun/nuages.png","images/decors/cryptes/fond.png","images/decors/cryptes/arcades.png","images/decors/ennemis/corbeau.png","images/decors/ennemis/chauve.png","images/decors/ennemis/ame.png","images/decors/ennemis/spectre.png","images/decors/ennemis/crane.png","images/decors/ennemis/veilleur.png","images/decors/feu/flamme.png","images/decors/feu/flamme-petite.png","images/decors/feu/boule-feu.png","images/decors/feu/explosion.png","images/decors/inscriptions/terres.png","images/decors/inscriptions/cimetiere.png","images/decors/inscriptions/cryptes.png","images/decors/inscriptions/veilleur.png","images/decors/inscriptions/tours.png","images/decors/objets/autel.png","images/decors/objets/reliquaire.png","images/decors/objets/porte.png","images/decors/objets/arbre.png","images/decors/objets/tombe.png","images/decors/objets/croix.png","images/decors/objets/ile.png","images/decors/objets/cadre.png","images/decors/objets/cadre-petit.png","images/decors/objets/curseur.png","images/decors/objets/poussiere.png","images/decors/objets/gargouille.png","images/decors/objets/etendard.png","images/decors/objets/fleche.png","images/decors/objets/herse.png","images/decors/objets/levier.png","images/decors/objets/bucher.png","images/decors/sang/orbe.png","images/decors/terrain/roc-terres.png","images/decors/terrain/roc-cimetiere.png","images/decors/terrain/roc-cryptes.png","images/decors/terrain/crete-terres.png","images/decors/terrain/crete-cimetiere.png","images/decors/terrain/dessous.png","images/decors/terrain/passerelle.png","images/decors/terrain/pointes.png","images/decors/terrain/roc-tours.png","images/decors/terrain/crete-tours.png","images/decors/terrain/dessous-tours.png","images/decors/terres/lointain.png","images/decors/terres/milieu.png","images/decors/terres/proche.png","images/decors/titre/logo.png","images/decors/tours-pieces/a-sommet.png","images/decors/tours-pieces/a-fut.png","images/decors/tours-pieces/a-pied.png","images/decors/tours-pieces/b-sommet.png","images/decors/tours-pieces/b-fut.png","images/decors/tours-pieces/b-pied.png","images/decors/tours-pieces/c-sommet.png","images/decors/tours-pieces/c-fut.png","images/decors/tours-pieces/c-pied.png","images/decors/tours-pieces/balcon.png","images/decors/tours-pieces/a-dessous.png","images/decors/tours-pieces/b-dessous.png","images/decors/tours-pieces/c-dessous.png","images/decors/tours-pieces/mur.png","images/decors/tours/lointain.png","images/decors/tours/milieu.png","images/decors/tours/proche.png","images/decors/tours/soubassements.png","images/dragon.png","images/dragon_propre.png","icones/icone-180.png","icones/icone-192.png","icones/icone-512.png","icones/icone-masquable-512.png","manifest.webmanifest"];
const CACHE = 'dragon-rider-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((cles) => Promise.all(cles.filter((c) => c.startsWith('dragon-rider-') && c !== CACHE).map((c) => caches.delete(c))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(servir(r));
});

const trop = (ms) => new Promise((_, non) => setTimeout(() => non(new Error('réseau trop lent')), ms));
async function servir(r) {
  const c = await caches.open(CACHE);
  try {
    const reponse = await Promise.race([fetch(r.url, { cache: 'no-cache', credentials: 'same-origin' }), trop(3000)]);
    if (reponse.ok) { c.put(r.url, reponse.clone()); return reponse; }
  } catch {}
  // hors ligne : le cache ; une ouverture de page (même avec #acte=2…) reçoit la page du jeu
  return (await c.match(r.url, { ignoreSearch: true }))
    || (r.mode === 'navigate' && await c.match('index.html'))
    || Response.error();
}
