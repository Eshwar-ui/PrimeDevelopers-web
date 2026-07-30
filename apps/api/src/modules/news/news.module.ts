import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { NewsAdminController } from './news.admin.controller';

@Module({
  controllers: [NewsController, NewsAdminController],
  providers: [NewsService],
})
export class NewsModule {}
