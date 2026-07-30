import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ContentService } from './content.service';
import { Public } from '../../common/decorators/public.decorator';
import { UpdateContentDto } from './dto/content.dto';

@ApiTags('Content')
@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'All site content, keyed by section' })
  findAll() {
    return this.content.findAll();
  }

  @ApiBearerAuth()
  @Put(':section')
  @ApiOperation({ summary: 'Create or replace one section' })
  update(@Param('section') section: string, @Body() dto: UpdateContentDto) {
    return this.content.upsert(section, dto.data as Prisma.InputJsonValue);
  }
}
