// Service worker : tout le jeu est mis en cache à l'installation, puis se joue sans réseau.
// La version et la liste des fichiers sont écrites par outils/construire.mjs ; une nouvelle version
// s'installe en arrière-plan et sert au lancement suivant (jamais de rechargement en pleine partie).
const VERSION = '__VERSION__';
const FICHIERS = [/*FICHIERS*/];
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

// d'abord le cache ; une ouverture de page (même avec #acte=2…) reçoit la page du jeu ; sinon le réseau
async function servir(r) {
  const c = await caches.open(CACHE);
  return (await c.match(r, { ignoreSearch: true }))
    || (r.mode === 'navigate' && await c.match('index.html'))
    || fetch(r);
}
