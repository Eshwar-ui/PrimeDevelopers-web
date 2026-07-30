import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreatePropertyDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  buildings?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  available?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  /** Array of image URLs. Stored as jsonb. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  gallery?: unknown[];

  /**
   * The rich nested payload — buildings, units, floor plans, reference links.
   * Left unvalidated for the same reason as content.data: its shape is defined
   * by the admin editors and duplicating it here would mean two definitions
   * drifting apart. See docs/deployment-plan.md on the eventual move to
   * relational units.
   */
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  detail?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
