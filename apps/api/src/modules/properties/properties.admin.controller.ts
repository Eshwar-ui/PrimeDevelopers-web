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
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';

@ApiTags('Properties (admin)')
@ApiBearerAuth()
@Controller('admin/properties')
export class PropertiesAdminController {
  constructor(private properties: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'All properties, including unpublished drafts' })
  findAll() {
    return this.properties.findAll(true);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'One property by slug, published or not' })
  findOne(@Param('slug') slug: string) {
    return this.properties.findBySlug(slug, true);
  }

  @Post()
  @ApiOperation({ summary: 'Create a property' })
  create(@Body() dto: CreatePropertyDto) {
    return this.properties.create(dto as unknown as Prisma.PropertyCreateInput);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a property (409 when expectedUpdatedAt is stale)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    const { expectedUpdatedAt, ...data } = dto;
    return this.properties.update(id, data as unknown as Prisma.PropertyUpdateInput, expectedUpdatedAt);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a property' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.properties.remove(id);
  }
}
