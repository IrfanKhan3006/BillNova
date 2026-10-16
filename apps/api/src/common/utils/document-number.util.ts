/**
 * Shared numbering for the order documents (quotations, sales orders,
 * purchase orders).
 *
 * Mirrors the collision-safe scheme the invoice and purchase-invoice services
 * already use: take the higher of the tenant counter and the real row count,
 * then walk forward until the number is free. Must be called inside a
 * transaction so the counter bump and the document insert commit together.
 */

type NumberedDelegate = {
  count: (args: any) => Promise<number>;
  findFirst: (args: any) => Promise<any>;
};

export interface DocumentNumberConfig {
  /** Prisma delegate for the document table, e.g. tx.quotation */
  delegate: NumberedDelegate;
  /** Column holding the human-readable number, e.g. 'quotationNumber' */
  numberField: string;
  /** Tenant column holding the counter, e.g. 'quotationCounter' */
  counterField: string;
  prefix: string;
  currentCounter: number;
}

export interface GeneratedDocumentNumber {
  documentNumber: string;
  nextCounter: number;
}

export async function generateDocumentNumber(
  tx: any,
  tenantId: string,
  config: DocumentNumberConfig,
): Promise<GeneratedDocumentNumber> {
  const { delegate, numberField, prefix, currentCounter } = config;

  const existingCount = await delegate.count({ where: { tenantId } });
  let nextCounter = Math.max(currentCounter || 0, existingCount) + 1;

  const build = (counter: number) =>
    `${prefix}-${String(counter).padStart(5, '0')}`;

  let documentNumber = build(nextCounter);
  let collision = await delegate.findFirst({
    where: { tenantId, [numberField]: documentNumber },
    select: { id: true },
  });

  while (collision) {
    nextCounter += 1;
    documentNumber = build(nextCounter);
    collision = await delegate.findFirst({
      where: { tenantId, [numberField]: documentNumber },
      select: { id: true },
    });
  }

  await tx.tenant.update({
    where: { id: tenantId },
    data: { [config.counterField]: nextCounter },
  });

  return { documentNumber, nextCounter };
}

export interface ComputedLine {
  productId: string | null;
  name: string;
  description: string | null;
  qty: number;
  price: number;
  taxRate: number;
  taxAmount: number;
  discountRate: number;
  discountAmount: number;
  total: number;
  hsnCode: string | null;
}

export interface ComputedTotals {
  items: ComputedLine[];
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

/**
 * Line maths, identical to the invoice/purchase services: a per-line discount
 * percentage comes off the rate first, tax applies to the discounted amount.
 * `directDiscount` is an extra document-level amount, carried into the
 * discount total exactly as the purchase service carries it.
 */
export function computeDocumentTotals(
  items: any[],
  resolveProduct: (item: any) => any | null,
  directDiscount = 0,
  priceField: 'salesPrice' | 'purchasePrice' = 'salesPrice',
): ComputedTotals {
  let subTotal = 0;
  let taxAmount = 0;
  let discountAmount = Number(directDiscount) || 0;
  const computed: ComputedLine[] = [];

  for (const item of items) {
    const product = resolveProduct(item);

    const price = Number(item.price ?? product?.[priceField] ?? 0);
    const taxRate = Number(item.taxRate ?? product?.taxRate ?? 0);
    const discountRate = Number(item.discountRate ?? 0);
    const qty = Math.max(1, Math.round(Number(item.qty ?? 1)));

    const rateAfterDiscount = price * (1 - discountRate / 100);
    const lineSubTotal = rateAfterDiscount * qty;
    const lineTax = lineSubTotal * (taxRate / 100);
    const lineDiscount = price * (discountRate / 100) * qty;

    subTotal += lineSubTotal;
    taxAmount += lineTax;
    discountAmount += lineDiscount;

    computed.push({
      productId: product ? product.id : null,
      name: item.name || product?.name || 'Item',
      description: item.description?.trim() || null,
      qty,
      price,
      taxRate,
      taxAmount: lineTax,
      discountRate,
      discountAmount: lineDiscount,
      total: lineSubTotal + lineTax,
      hsnCode: item.hsnCode || product?.hsnCode || null,
    });
  }

  return {
    items: computed,
    subTotal,
    taxAmount,
    discountAmount,
    totalAmount: subTotal + taxAmount,
  };
}
