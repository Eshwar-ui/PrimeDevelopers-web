import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';

/**
 * ⚠️ The two fields marked below are the unresolved schema conflict.
 *
 * Migration 6 declares the columns as `summary` and `image`; the frontend
 * reads and writes `excerpt` and `cover_image` everywhere. This DTO follows
 * the migration, matching prisma/schema.prisma.
 *
 * If the live database turns out to use the frontend's names, the fix is
 * confined to three places — here, the Prisma model, and nothing else, because
 * the service never names these fields individually. Do not spread the fix
 * into the controllers.
 *
 * See docs/deployment-plan.md § "the news column conflict".
 */
export class CreateNewsDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(300)
  slug!: string;

  /** ⚠️ conflict: frontend calls this `excerpt`. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  /** ⚠️ conflict: frontend calls this `cover_image`. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

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
