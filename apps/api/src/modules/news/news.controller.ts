import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private news: NewsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Published news posts' })
  findAll() {
    return this.news.findAll(false);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'One published news post by slug' })
  findOne(@Param('slug') slug: string) {
    return this.news.findBySlug(slug, false);
  }
}
