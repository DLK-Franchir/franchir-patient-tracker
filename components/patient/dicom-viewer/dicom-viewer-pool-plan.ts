/** Index chargé en priorité pour afficher la 1re image avant le pool parallèle. */
export const POOL_BOOTSTRAP_INDEX = 0;

export function shouldPumpParallelLoads(bootstrapComplete: boolean, poolSize: number): boolean {
  return bootstrapComplete || poolSize <= 1;
}

/** Prochain index à charger ; null si rien à démarrer (bootstrap en cours). */
export function nextPoolLoadIndex(
  cursor: number,
  poolSize: number,
  bootstrapComplete: boolean,
): number | null {
  if (poolSize <= 0) return null;
  if (!shouldPumpParallelLoads(bootstrapComplete, poolSize)) {
    return cursor === POOL_BOOTSTRAP_INDEX ? POOL_BOOTSTRAP_INDEX : null;
  }
  if (cursor >= poolSize) return null;
  return cursor;
}
