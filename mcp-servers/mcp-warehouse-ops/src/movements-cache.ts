export function movementCacheKey(warehouseId: string) {
  return `cache:movements:${warehouseId}`;
}

export function movementScoreWindow(sinceHours: number, now = Date.now()) {
  return {
    min: now - sinceHours * 60 * 60 * 1000,
    max: now,
  };
}
