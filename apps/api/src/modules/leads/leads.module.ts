import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadsAdminController } from './leads.admin.controller';

@Module({
  controllers: [LeadsController, LeadsAdminController],
  providers: [LeadsService],
})
export class LeadsModule {}
