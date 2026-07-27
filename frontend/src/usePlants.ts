import { useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';

export type Plant = { warehouseId: string; live: boolean; positions: number };

/** Demo set, used until the landscape responds (or when nothing is connected). */
const FALLBACK: Plant[] = ['1010', '1020', '1030', '1040', '1050'].map((w) => ({
  warehouseId: w,
  live: false,
  positions: 0,
}));

/**
 * Plants come from the connected SAP landscape (Phase AG) rather than a
 * hard-coded list, so selectors show the customer's real plants.
 */
export function usePlants(client: AxiosInstance): Plant[] {
  const [plants, setPlants] = useState<Plant[]>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/ops/landscape/plants')
      .then((res) => {
        if (!cancelled && Array.isArray(res.data) && res.data.length) {
          setPlants(res.data as Plant[]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client]);

  return plants;
}

/**
 * "WH 1010 · live SAP" / "WH 1030 · demo data" for selectors.
 *
 * Demo plants used to render as a bare "WH 1030", indistinguishable from a real
 * one — which is how a user ends up with a simulator plant as their default and
 * concludes the whole app is showing fake data.
 */
export function plantLabel(p: Plant): string {
  return `WH ${p.warehouseId}${p.live ? ' · live SAP' : ' · demo data'}`;
}
