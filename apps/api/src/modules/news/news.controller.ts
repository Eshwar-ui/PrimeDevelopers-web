import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { Public } from '../../common/decorators/public.decorator';
import { Cacheable } from '../../common/decorators/cacheable.decorator';

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private news: NewsService) {}

  @Public()
  @Cacheable()
  @Get()
  @ApiOperation({ summary: 'Published news posts' })
  findAll() {
    return this.news.findAll(false);
  }

  @Public()
  @Cacheable()
  @Get(':slug')
  @ApiOperation({ summary: 'One published news post by slug' })
  findOne(@Param('slug') slug: string) {
    return this.news.findBySlug(slug, false);
  }
}
