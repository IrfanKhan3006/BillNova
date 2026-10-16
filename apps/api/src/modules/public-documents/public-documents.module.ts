import { Module } from '@nestjs/common';
import { PublicDocumentsController } from './public-documents.controller';
import { QuotationsModule } from '../quotations/quotations.module';
import { SalesOrdersModule } from '../sales-orders/sales-orders.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';

@Module({
  imports: [QuotationsModule, SalesOrdersModule, PurchaseOrdersModule],
  controllers: [PublicDocumentsController],
})
export class PublicDocumentsModule {}
