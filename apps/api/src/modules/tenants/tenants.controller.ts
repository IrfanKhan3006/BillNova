import { Controller, Get } from '@nestjs/common';

@Controller('tenants')
export class TenantsController {
  @Get()
  getTenants() {
    return {
      module: 'Tenants',
      status: 'Working',
    };
  }
}