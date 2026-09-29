import type { DistributionLine, DoctorCallProductInput, InventoryBalance } from "./types";

export function buildDoctorProducts(productIds: string[]): DoctorCallProductInput[] {
  const unique = [...new Set(productIds)];
  if (unique.length > 20) throw new Error("Select no more than 20 products.");
  return unique.map((productId, index) => ({
    sequence: index + 1,
    productId,
    detailNotes: null,
  }));
}

export function distributionKey(balance: Pick<InventoryBalance, "itemType" | "itemId">): string {
  return `${balance.itemType}:${balance.itemId}`;
}

export function buildDistributionLines(
  balances: InventoryBalance[],
  quantities: Record<string, string>,
): DistributionLine[] {
  const lines: DistributionLine[] = [];
  for (const balance of balances) {
    const raw = quantities[distributionKey(balance)]?.trim();
    if (!raw) continue;
    if (!/^[1-9]\d*$/.test(raw)) throw new Error("Sample/gift quantity must be a positive whole number.");
    const quantity = Number(raw);
    if (quantity > balance.quantity) throw new Error("Sample/gift quantity cannot exceed available balance.");
    lines.push({ itemType: balance.itemType, itemId: balance.itemId, quantity });
  }
  return lines;
}


export function projectedInventoryBalance(
  balance: InventoryBalance,
  quantities: Record<string, string>,
): number | null {
  const raw = quantities[distributionKey(balance)]?.trim();
  if (!raw) return balance.quantity;
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const quantity = Number(raw);
  if (quantity > balance.quantity) return null;
  return balance.quantity - quantity;
}

export function weekStartFromDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid work date.");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Invalid work date.");
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}
