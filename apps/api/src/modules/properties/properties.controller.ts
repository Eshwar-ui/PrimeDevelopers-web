import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import { Public } from '../../common/decorators/public.decorator';
import { Cacheable } from '../../common/decorators/cacheable.decorator';

/**
 * Public read surface. Kept in its own controller from the admin routes below
 * `admin/properties` so the authentication boundary is visible in the URL
 * rather than being a per-handler decorator you have to remember to check —
 * and so a `:slug` route can never shadow an admin path.
 */
@ApiTags('Properties')
@Controller('properties')
export class PropertiesController {
  constructor(private properties: PropertiesService) {}

  @Public()
  @Cacheable()
  @Get()
  @ApiOperation({ summary: 'Published properties, in display order' })
  findAll() {
    return this.properties.findAll(false);
  }

  @Public()
  @Cacheable()
  @Get(':slug')
  @ApiOperation({ summary: 'One published property by slug' })
  findOne(@Param('slug') slug: string) {
    return this.properties.findBySlug(slug, false);
  }
}
