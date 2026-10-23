import { Module } from '@nestjs/common';
import { TrackerSyncController } from './tracker-sync.controller';
import { TrackerSignatureGuard } from './tracker-signature.guard';
import { TrackerSyncService } from './tracker-sync.service';

@Module({
  controllers: [TrackerSyncController],
  providers: [TrackerSyncService, TrackerSignatureGuard],
})
export class TrackerSyncModule {}
