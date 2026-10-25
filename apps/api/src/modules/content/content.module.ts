import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { ContentAdminController } from './content.admin.controller';

@Module({
  controllers: [ContentController, ContentAdminController],
  providers: [ContentService],
})
export class ContentModule {}
