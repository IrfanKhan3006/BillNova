import { Module } from '@nestjs/common';
import { PublicDocumentsController } from './public-documents.controller';
import { QuotationsModule } from '../quotations/quotations.module';
import { SalesOrdersModule } from '../sales-orders/sales-orders.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { CreditNotesModule } from '../credit-notes/credit-notes.module';
import { DebitNotesModule } from '../debit-notes/debit-notes.module';
import { ChallansModule } from '../challans/challans.module';

@Module({
  imports: [
    QuotationsModule,
    SalesOrdersModule,
    PurchaseOrdersModule,
    CreditNotesModule,
    DebitNotesModule,
    ChallansModule,
  ],
  controllers: [PublicDocumentsController],
})
export class PublicDocumentsModule {}
