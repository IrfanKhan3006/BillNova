import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';

@Module({
  imports: [HealthModule, AuthModule, UsersModule, TenantsModule],
})
export class AppModule {}
