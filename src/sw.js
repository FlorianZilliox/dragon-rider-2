// Service worker : le jeu se joue sans réseau, et prend toujours la dernière version quand il y en a.
// - à l'installation, tout le jeu est mis en cache (la version et la liste des fichiers sont écrites par outils/construire.mjs) ;
// - ensuite, le réseau d'abord : chaque fichier est redemandé (vérification rapide, le serveur répond « inchangé » si
//   rien n'a bougé) et le cache est rafraîchi ; sans réseau, ou s'il tarde plus de 3 s, le cache répond.
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
