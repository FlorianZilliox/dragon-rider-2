import { J } from './etat.js';
import { relacher } from './entrees.js';

// ================= L'appareil : application installée, écran, veille, pause =================
// - PWA : le service worker met tout le jeu en cache (il se joue ensuite sans réseau) ;
// - l'écran reste allumé pendant qu'on joue ;
// - la partie se met en pause quand on quitte l'application, qu'un appel arrive ou qu'on tourne le téléphone en portrait ;
// - dans un navigateur de téléphone, le premier toucher passe en plein écran, verrouillé en paysage.

J.pause = false;
const installee = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');

// le cache hors ligne : seulement pour la version en ligne (le fichier unique n'a pas de manifeste)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && document.querySelector('link[rel="manifest"]')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// l'écran allumé tant qu'on joue (le navigateur rend le verrou quand la page est cachée : on le redemande au retour)
let verrou = null;
async function garderEcranAllume() {
  if (!('wakeLock' in navigator) || verrou || document.visibilityState !== 'visible') return;
  try { verrou = await navigator.wakeLock.request('screen'); verrou.addEventListener('release', () => { verrou = null; }); } catch {}
}

export function mettreEnPause() {
  if (J.etat === 'jeu') J.pause = true;
  relacher();                                        // aucune touche ne reste enfoncée pendant l'absence
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { mettreEnPause(); J.actx?.suspend?.().catch(() => {}); }
  else garderEcranAllume();
});
addEventListener('pagehide', mettreEnPause);
portrait.addEventListener?.('change', (e) => { if (e.matches) mettreEnPause(); });

// premier toucher dans un navigateur de téléphone : plein écran et paysage (sans effet là où ce n'est pas permis)
let pleinEcranDemande = false;
addEventListener('pointerup', (e) => {
  garderEcranAllume();
  if (pleinEcranDemande || installee || e.pointerType !== 'touch') return;
  pleinEcranDemande = true;
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) {
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
}, true);

// la pause : l'image reste figée, voilée, jusqu'au prochain toucher ou à la prochaine touche
export const enPause = () => J.pause || portrait.matches;
