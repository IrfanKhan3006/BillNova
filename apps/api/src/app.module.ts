import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { BusinessModule } from './modules/business/business.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AdminModule } from './modules/admin/admin.module';
import { PlatformModule } from './modules/platform/platform.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { SalesOrdersModule } from './modules/sales-orders/sales-orders.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Real env vars always win; .env files are only a fallback (e.g. Hostinger).
      envFilePath: ['.env', '../../.env'],
    }),
    SubscriptionModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    BusinessModule,
    CustomersModule,
    ProductsModule,
    InvoicesModule,
    PurchasesModule,
    QuotationsModule,
    SalesOrdersModule,
    PurchaseOrdersModule,
    PaymentsModule,
    DashboardModule,
    ReportsModule,
    AdminModule,
    PlatformModule,
    AppointmentsModule,
  ],
})
export class AppModule {}
