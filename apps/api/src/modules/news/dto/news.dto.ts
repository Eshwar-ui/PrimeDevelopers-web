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

  // Bounds well above the longest article today (~7,000 characters) — a ceiling on
  // what one save can add to a list every visitor downloads, not an editorial rule.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerpt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
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
