import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateNewsDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({ example: '2026-07-30T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;
}

export class UpdateNewsDto extends PartialType(CreateNewsDto) {}
