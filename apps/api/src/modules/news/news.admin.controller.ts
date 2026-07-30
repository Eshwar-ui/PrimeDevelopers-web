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
import { NewsService } from './news.service';
import { CreateNewsDto, UpdateNewsDto } from './dto/news.dto';

@ApiTags('News (admin)')
@ApiBearerAuth()
@Controller('admin/news')
export class NewsAdminController {
  constructor(private news: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'All news posts, including drafts' })
  findAll() {
    return this.news.findAll(true);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'One news post by slug, published or not' })
  findOne(@Param('slug') slug: string) {
    return this.news.findBySlug(slug, true);
  }

  @Post()
  @ApiOperation({ summary: 'Create a news post' })
  create(@Body() dto: CreateNewsDto) {
    return this.news.create(dto as unknown as Prisma.NewsCreateInput);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a news post' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNewsDto) {
    return this.news.update(id, dto as unknown as Prisma.NewsUpdateInput);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a news post' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.news.remove(id);
  }
}
