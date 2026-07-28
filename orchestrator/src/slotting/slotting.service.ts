import { Injectable, Logger } from '@nestjs/common';
import { McpService } from '../mcp/mcp.service';

// Forward pick faces (short walk) vs reserve/back locations (long walk).
const PRIME = ['packing', 'shipping'];
const RESERVE = ['bulk', 'receiving', 'inspection'];
const FAST_PICKS = 3; // picks in the window to count as a fast mover
const WINDOW_HOURS = 168; // 7 days

export interface SlottingProposal {
  productId: string;
  fromLocation: string;
  toLocation: string;
  qty: number;
  picks: number;
  velocity: 'fast' | 'medium';
  rationale: string;
}

type Rec = Record<string, unknown>;

/**
 * Slotting optimizer (Phase Z): pick-frequency analysis over movement history.
 * Fast movers sitting in reserve locations (bulk/receiving) get proposed
 * relocations to a forward pick face (packing/shipping) — shorter pick paths.
 * Proposals execute through the same governed move-approval machinery as the board.
 */
@Injectable()
export class SlottingService {
  private readonly logger = new Logger(SlottingService.name);
  private readonly iflowBase = (process.env.IFLOW_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

  constructor(private readonly mcp: McpService) {}

  private records(result: unknown): Rec[] {
    return ((result as { structuredContent?: { records?: Rec[] } })?.structuredContent?.records ?? []) as Rec[];
  }

  /** Pick history needs per-location movements (fromLocation) — the iflow movement
   *  source has them; the MCP getRecentMovements is cache-backed and location-blind. */
  private async fetchMovements(warehouseId: string): Promise<Rec[]> {
    try {
      const res = await fetch(`${this.iflowBase}/iflow/movements?warehouseId=${warehouseId}&sinceHours=${WINDOW_HOURS}`);
      if (!res.ok) return [];
      const body = (await res.json()) as { records?: Rec[] };
      return body.records ?? [];
    } catch (error) {
      this.logger.warn(`movement fetch failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return [];
    }
  }

  async proposals(
    warehouseId: string,
  ): Promise<{
    warehouseId: string;
    window: string;
    proposals: SlottingProposal[];
    unavailableReason?: string;
  }> {
    const [stockRes, moves] = await Promise.all([
      this.mcp.callTool('listWarehouseStock', { warehouseId }).catch(() => null),
      this.fetchMovements(warehouseId),
    ]);
    const stock = this.records(stockRes);

    // Picks = outbound moves per (product, source location) over the window.
    const picksByProdLoc = new Map<string, number>();
    const picksByProduct = new Map<string, number>();
    for (const m of moves) {
      const prod = String(m.productId ?? m.materialId ?? '');
      const from = String(m.fromLocation ?? '').toLowerCase();
      if (!prod || !from) continue;
      picksByProdLoc.set(`${prod}@${from}`, (picksByProdLoc.get(`${prod}@${from}`) ?? 0) + 1);
      picksByProduct.set(prod, (picksByProduct.get(prod) ?? 0) + 1);
    }

    // Current qty per (product, location).
    const qtyByProdLoc = new Map<string, number>();
    const primeQtyByProduct = new Map<string, number>();
    for (const s of stock) {
      const prod = String(s.productId ?? s.materialId ?? '');
      const loc = String(s.location ?? '').toLowerCase();
      const qty = Number(s.quantity ?? 0);
      if (!prod || !loc) continue;
      qtyByProdLoc.set(`${prod}@${loc}`, (qtyByProdLoc.get(`${prod}@${loc}`) ?? 0) + qty);
      if (PRIME.includes(loc)) primeQtyByProduct.set(prod, (primeQtyByProduct.get(prod) ?? 0) + qty);
    }

    const proposals: SlottingProposal[] = [];
    for (const [prod, totalPicks] of picksByProduct) {
      if (totalPicks < FAST_PICKS) continue; // only fast/medium movers are worth relocating

      // Reserve location this product is most often picked from, with stock to move.
      let bestFrom = '';
      let bestFromPicks = 0;
      let bestFromQty = 0;
      for (const loc of RESERVE) {
        const picks = picksByProdLoc.get(`${prod}@${loc}`) ?? 0;
        const qty = qtyByProdLoc.get(`${prod}@${loc}`) ?? 0;
        if (picks > bestFromPicks && qty > 0) {
          bestFrom = loc;
          bestFromPicks = picks;
          bestFromQty = qty;
        }
      }
      if (!bestFrom) continue; // already picked from a forward face — no move needed

      // Target the prime face with the least of this product (balance the forward buffer).
      const targetPrime = [...PRIME].sort(
        (a, b) => (qtyByProdLoc.get(`${prod}@${a}`) ?? 0) - (qtyByProdLoc.get(`${prod}@${b}`) ?? 0),
      )[0];

      // Move about half the reserve qty forward, capped, leaving reserve buffer.
      const moveQty = Math.max(1, Math.min(Math.floor(bestFromQty / 2), 40));
      proposals.push({
        productId: prod,
        fromLocation: bestFrom,
        toLocation: targetPrime,
        qty: moveQty,
        picks: totalPicks,
        velocity: totalPicks >= 2 * FAST_PICKS ? 'fast' : 'medium',
        rationale: `${prod} picked ${totalPicks}× in 7 days (${bestFromPicks}× from ${bestFrom}) but sits in reserve — relocate ${moveQty} to ${targetPrime} for a shorter pick path.`,
      });
    }

    proposals.sort((a, b) => b.picks - a.picks);
    return { warehouseId, window: '7 days', proposals,
      // Slotting ranks fast movers by pick frequency, which needs dated
      // movements. The connected SAP material-document feed has no posting
      // timestamp, so a live plant yields no picks and returned a silent empty
      // list that read as "nothing to improve here".
      ...(proposals.length === 0 && stock.length > 0
        ? {
            unavailableReason:
              'No pick history is available for this plant. The connected SAP material-document feed carries ' +
              'no posting date, so movements cannot be counted over a time window. Connecting a movement feed ' +
              'with PostingDate would enable slotting analysis.',
          }
        : {}),
    };
  }
}
