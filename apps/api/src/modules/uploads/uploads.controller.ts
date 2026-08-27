import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { UploadsService } from './uploads.service';

class UploadDto {
  /** e.g. `properties/riverbend` or `properties/riverbend/model`. */
  @IsString()
  @MaxLength(200)
  folder!: string;
}

// Multer buffers into memory. Fine at these sizes — the largest accepted file
// is 10 MB and uploads are admin-only, so concurrency is one person at a time.
const LIMITS = { limits: { fileSize: 10 * 1024 * 1024, files: 1 } };

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private uploads: UploadsService) {}

  @Post('image')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an image, returns its public URL' })
  @UseInterceptors(FileInterceptor('file', LIMITS))
  uploadImage(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadDto) {
    return this.uploads.upload('image', file, dto.folder);
  }

  @Post('model')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a .glb model, returns its public URL' })
  @UseInterceptors(FileInterceptor('file', LIMITS))
  uploadModel(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadDto) {
    return this.uploads.upload('model', file, dto.folder);
  }

  @Post('document')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a PDF document, returns its public URL' })
  @UseInterceptors(FileInterceptor('file', LIMITS))
  uploadDocument(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadDto) {
    return this.uploads.upload('document', file, dto.folder);
  }
}
