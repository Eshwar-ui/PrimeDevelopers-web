import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadsAdminController } from './leads.admin.controller';
import { LeadRetention } from './lead-retention';

@Module({
  controllers: [LeadsController, LeadsAdminController],
  providers: [LeadsService, LeadRetention],
})
export class LeadsModule {}
