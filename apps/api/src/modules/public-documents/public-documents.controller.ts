import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { QuotationsService } from '../quotations/quotations.service';
import { SalesOrdersService } from '../sales-orders/sales-orders.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';

/**
 * Unauthenticated read of a shared order document (/doc?s=<token>).
 *
 * The token itself does not say which kind of document it belongs to, so this
 * resolves it across the three types. Tokens are 128-bit random values, so a
 * miss in one table simply means "try the next", not an error.
 */
@ApiTags('Public Documents')
@Controller('public-documents')
export class PublicDocumentsController {
  constructor(
    private readonly quotations: QuotationsService,
    private readonly salesOrders: SalesOrdersService,
    private readonly purchaseOrders: PurchaseOrdersService,
  ) {}

  @Get(':token')
  @ApiOperation({
    summary: 'Shared quotation / sales order / purchase order dekho (no login)',
  })
  async findByToken(@Param('token') token: string) {
    const lookups = [
      () => this.quotations.findByShareToken(token),
      () => this.salesOrders.findByShareToken(token),
      () => this.purchaseOrders.findByShareToken(token),
    ];

    for (const lookup of lookups) {
      try {
        return await lookup();
      } catch (err) {
        if (!(err instanceof NotFoundException)) throw err;
      }
    }

    throw new NotFoundException('Document not found or no longer available.');
  }
}
