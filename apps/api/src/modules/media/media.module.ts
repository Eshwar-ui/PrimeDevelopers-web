import { Module } from '@nestjs/common';
import { ImageController } from './image.controller';
import { MediaStorage } from './media-storage';

@Module({
  controllers: [ImageController],
  providers: [MediaStorage],
  exports: [MediaStorage],
})
export class MediaModule {}
