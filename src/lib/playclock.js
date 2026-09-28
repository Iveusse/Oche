// Chrono de jeu actif + écran toujours allumé pendant une partie.
import { useEffect, useRef } from 'react';

export const IDLE_MS = 3 * 60000; // plus de 3 min sans toucher l'écran : chrono en pause

// Garde l'écran allumé tant que le composant est monté (Screen Wake Lock API,
// dispo sur iPhone en app écran d'accueil depuis iOS 18.4). Le verrou saute
// quand l'app passe en arrière-plan : on le redemande au retour.
export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined;
    let lock = null; let alive = true;
    const request = async () => {
      if (!alive || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try { lock = await navigator.wakeLock.request('screen'); } catch { /* refusé (mode éco, etc.) */ }
    };
    const onVis = () => { if (document.visibilityState === 'visible') request(); };
    request();
    document.addEventListener('visibilitychange', onVis);
    // iOS peut exiger un geste : on retente au premier toucher
    window.addEventListener('pointerdown', request);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerdown', request);
      if (lock && !lock.released) lock.release().catch(() => {});
    };
  }, [active]);
}

// Accumule le temps pendant lequel l'écran de jeu est visible et utilisé.
// take() renvoie le temps accumulé depuis le dernier appel et remet à zéro.
export function usePlayClock(running) {
  const c = useRef({ acc: 0, last: Date.now(), input: Date.now() });
  useEffect(() => {
    if (!running) return undefined;
    const s = c.current;
    s.last = Date.now(); s.input = Date.now();
    const tick = () => {
      const now = Date.now();
      // plafond de 5 s par tick : si le téléphone a dormi, on ne compte pas le trou
      if (document.visibilityState === 'visible' && now - s.input < IDLE_MS) s.acc += Math.min(now - s.last, 5000);
      s.last = now;
    };
    const touch = () => { tick(); s.input = Date.now(); };
    const onVis = () => { tick(); if (document.visibilityState === 'visible') s.input = Date.now(); };
    const id = setInterval(tick, 1000);
    window.addEventListener('pointerdown', touch);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      tick();
      clearInterval(id);
      window.removeEventListener('pointerdown', touch);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [running]);
  return () => {
    const s = c.current; const now = Date.now();
    if (document.visibilityState === 'visible' && now - s.input < IDLE_MS) s.acc += Math.min(now - s.last, 5000);
    s.last = now; s.input = now;
    const ms = Math.round(s.acc); s.acc = 0;
    return ms;
  };
}
