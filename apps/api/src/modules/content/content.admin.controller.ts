import { Controller, Get, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service';

@ApiTags('Content (admin)')
@ApiBearerAuth()
@Controller('admin/content')
export class ContentAdminController {
  constructor(private content: ContentService) {}

  /**
   * Every section with its drafts, for the editor. The admin's save path reads this
   * immediately before writing a section back whole (admin/capStore.js,
   * admin/sectionStore.js), so it must never be served from a cache, and it must
   * include drafts — reading the public copy there would delete them on save.
   */
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'All site content, including unpublished drafts' })
  findAll() {
    return this.content.findAll(true);
  }
}
