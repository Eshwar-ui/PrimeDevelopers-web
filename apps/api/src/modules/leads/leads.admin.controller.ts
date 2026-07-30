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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { UpdateLeadStatusDto } from './dto/lead.dto';

@ApiTags('Leads (admin)')
@ApiBearerAuth()
@Controller('admin/leads')
export class LeadsAdminController {
  constructor(private leads: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'All leads, newest first, with unit attributions' })
  findAll() {
    return this.leads.findAll();
  }

  @Patch(':id')
  @ApiOperation({ summary: "Update a lead's status" })
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadStatusDto) {
    return this.leads.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lead' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leads.remove(id);
  }
}
