import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { QuotationsService } from '../quotations/quotations.service';
import { SalesOrdersService } from '../sales-orders/sales-orders.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { CreditNotesService } from '../credit-notes/credit-notes.service';
import { DebitNotesService } from '../debit-notes/debit-notes.service';
import { ChallansService } from '../challans/challans.service';

/**
 * Unauthenticated read of a shared document (/doc?s=<token>).
 *
 * The token itself does not say which kind of document it belongs to, so this
 * resolves it across every shareable type. Tokens are 128-bit random values,
 * so a miss in one table simply means "try the next", not an error.
 */
@ApiTags('Public Documents')
@Controller('public-documents')
export class PublicDocumentsController {
  constructor(
    private readonly quotations: QuotationsService,
    private readonly salesOrders: SalesOrdersService,
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly creditNotes: CreditNotesService,
    private readonly debitNotes: DebitNotesService,
    private readonly challans: ChallansService,
  ) {}

  @Get(':token')
  @ApiOperation({
    summary:
      'Shared quotation / order / note / challan dekho (no login)',
  })
  async findByToken(@Param('token') token: string) {
    const lookups = [
      () => this.quotations.findByShareToken(token),
      () => this.salesOrders.findByShareToken(token),
      () => this.purchaseOrders.findByShareToken(token),
      () => this.creditNotes.findByShareToken(token),
      () => this.debitNotes.findByShareToken(token),
      () => this.challans.findByShareToken(token),
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
