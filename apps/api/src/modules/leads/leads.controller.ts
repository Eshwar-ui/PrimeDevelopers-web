import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/lead.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Leads')
@Controller('leads')
export class LeadsController {
  constructor(private leads: LeadsService) {}

  /**
   * The only unauthenticated write in the API, and therefore the obvious spam
   * target. Ten submissions per minute per IP is far above what a real visitor
   * needs and far below what a bot wants.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a contact enquiry' })
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }
}
