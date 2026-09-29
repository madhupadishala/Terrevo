import type { DistributionLine, DoctorCallProductInput, InventoryBalance, OrderLine, RcpaLine } from "./types";

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

function positiveWhole(raw: string | undefined, label: string): number {
  const value = raw?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${label} must be a positive whole number.`);
  return Number(value);
}

function observedWhole(raw: string | undefined, label: string): number {
  const value = raw?.trim() ?? "";
  if (!value) return 0;
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a whole number.`);
  return Number(value);
}

export function buildOrderLines(productIds: string[], quantities: Record<string, string>): OrderLine[] {
  const unique = [...new Set(productIds)];
  if (unique.length > 50) throw new Error("Select no more than 50 order products.");
  return unique.map((productId, index) => ({
    sequence: index + 1,
    productId,
    quantity: positiveWhole(quantities[productId], "Order quantity"),
    remarks: null,
  }));
}

export type RcpaCompetitorDraft = {
  brand: string;
  prescriptionCount: string;
  stockQuantity: string;
  salesQuantity: string;
};

export function buildRcpaLines(
  productIds: string[],
  observations: Record<string, { prescriptionCount?: string; stockQuantity?: string; salesQuantity?: string }>,
  competitors: RcpaCompetitorDraft[],
): RcpaLine[] {
  const unique = [...new Set(productIds)];
  if (unique.length + competitors.length > 50) throw new Error("RCPA supports up to 50 unique items.");
  const result: RcpaLine[] = [];
  for (const productId of unique) {
    const raw = observations[productId] ?? {};
    const prescriptionCount = observedWhole(raw.prescriptionCount, "Prescription count");
    const stockQuantity = observedWhole(raw.stockQuantity, "Stock quantity");
    const salesQuantity = observedWhole(raw.salesQuantity, "Sales quantity");
    if (prescriptionCount + stockQuantity + salesQuantity === 0) throw new Error("Each selected RCPA product needs at least one observed quantity.");
    result.push({ sequence: result.length + 1, productId, competitorBrand: null, prescriptionCount, stockQuantity, salesQuantity });
  }
  const seen = new Set<string>();
  for (const draft of competitors) {
    const brand = draft.brand.trim();
    if (!brand) throw new Error("Competitor brand is required.");
    const key = brand.toLowerCase();
    if (seen.has(key)) throw new Error("Duplicate competitor brand.");
    seen.add(key);
    const prescriptionCount = observedWhole(draft.prescriptionCount, "Prescription count");
    const stockQuantity = observedWhole(draft.stockQuantity, "Stock quantity");
    const salesQuantity = observedWhole(draft.salesQuantity, "Sales quantity");
    if (prescriptionCount + stockQuantity + salesQuantity === 0) throw new Error("Each competitor RCPA line needs at least one observed quantity.");
    result.push({ sequence: result.length + 1, productId: null, competitorBrand: brand, prescriptionCount, stockQuantity, salesQuantity });
  }
  return result;
}


export function accountMutationScope(userId: string, tenantId: string, scope: string): string {
  const user = userId.trim();
  const tenant = tenantId.trim();
  const base = scope.trim();
  if (!user || !tenant || !base) throw new Error("Retry state requires user, tenant and operation scope.");
  return `${tenant}.${user}.${base}`;
}
