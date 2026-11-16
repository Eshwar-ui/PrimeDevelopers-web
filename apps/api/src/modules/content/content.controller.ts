import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ContentService } from './content.service';
import { Public } from '../../common/decorators/public.decorator';
import { Cacheable } from '../../common/decorators/cacheable.decorator';
import { UpdateContentDto } from './dto/content.dto';
import { assertSafeUrls } from '../../common/validators/safe-urls';

@ApiTags('Content')
@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  @Public()
  @Cacheable()
  @Get()
  @ApiOperation({ summary: 'All site content, keyed by section, without drafts' })
  findAll() {
    return this.content.findAll(false);
  }

  @ApiBearerAuth()
  @Put(':section')
  @ApiOperation({ summary: 'Create or replace one section' })
  update(@Param('section') section: string, @Body() dto: UpdateContentDto) {
    // Links must be safe to put in an href (security audit L1).
    assertSafeUrls(dto.data, `the ${section} section`);
    return this.content.upsert(section, dto.data as Prisma.InputJsonValue);
  }
}
