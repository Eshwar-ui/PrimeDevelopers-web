import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { ListLeadsQueryDto, UpdateLeadDto } from './dto/lead.dto';

@ApiTags('Leads (admin)')
@ApiBearerAuth()
@Controller('admin/leads')
export class LeadsAdminController {
  constructor(private leads: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'Leads, newest first, with unit attributions — one page at a time' })
  findAll(@Query() query: ListLeadsQueryDto) {
    return this.leads.findAll(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Lead counts by status, and how many the spam checks filtered' })
  summary() {
    return this.leads.summary();
  }

  @Patch(':id')
  @ApiOperation({ summary: "Update a lead's status, or move a filtered lead to the inbox" })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lead' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.remove(id);
  }
}
