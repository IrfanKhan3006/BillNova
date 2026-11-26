import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule],
  controllers: [PlatformController],
})
export class PlatformModule {}
