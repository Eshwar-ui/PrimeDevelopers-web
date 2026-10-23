import { Body, Controller, HttpCode, HttpStatus, ParseBoolPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { TrackerSnapshotDto } from './dto/snapshot.dto';
import { TrackerSignatureGuard } from './tracker-signature.guard';
import { TrackerSyncService } from './tracker-sync.service';

/**
 * Server-to-server: Prime Tracker pushes each linked project here. `@Public()`
 * only skips the admin JWT guard — TrackerSignatureGuard is what admits the
 * request, and it admits nothing unsigned.
 */
@ApiTags('Integrations')
@Controller('integrations/tracker')
export class TrackerSyncController {
  constructor(private sync: TrackerSyncService) {}

  @Public()
  @UseGuards(TrackerSignatureGuard)
  @Post('snapshot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a Prime Tracker project snapshot to its property' })
  apply(
    @Body() snapshot: TrackerSnapshotDto,
    @Query('dryRun', new ParseBoolPipe({ optional: true })) dryRun?: boolean,
    @Query('force', new ParseBoolPipe({ optional: true })) force?: boolean,
  ) {
    return this.sync.apply(snapshot, { dryRun, force });
  }
}
