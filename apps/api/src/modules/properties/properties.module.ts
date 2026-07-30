import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { PropertiesAdminController } from './properties.admin.controller';

@Module({
  controllers: [PropertiesController, PropertiesAdminController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
