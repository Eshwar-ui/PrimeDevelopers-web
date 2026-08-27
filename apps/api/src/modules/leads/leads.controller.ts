import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LeadsService } from './leads.service';
import { BrochureRequestDto, CreateLeadDto } from './dto/lead.dto';
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

  /**
   * Emails a property's brochure to whoever asked for it, and records the
   * request as a lead. Same rate limit and same reasoning as above — it is
   * unauthenticated, it sends mail, and it is therefore worth more to a
   * spammer than the contact form is.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('brochure')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request a property brochure by email' })
  requestBrochure(@Body() dto: BrochureRequestDto) {
    return this.leads.requestBrochure(dto);
  }
}
