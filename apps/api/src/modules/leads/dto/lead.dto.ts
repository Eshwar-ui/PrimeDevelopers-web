import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// `read` is what the admin's mark-read toggle writes; the rest are for a sales
// pipeline the CMS doesn't expose yet. Omitting `read` would have made that
// button 400 — the column had no constraint before, so nothing caught it.
export const LEAD_STATUSES = ['new', 'read', 'contacted', 'qualified', 'closed'] as const;

/**
 * The public lead submission. This is the only unauthenticated write in the
 * API, so every field is bounded — previously the browser inserted straight
 * into Postgres and a 10 MB message was as acceptable as a 10 character one.
 */
export class CreateLeadDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  // ── Unit attribution ────────────────────────────────────────────────────
  // Optional, but propertyId and unitLabel are all-or-nothing: an attribution
  // needs both to identify anything. Enforced in the service.

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  unitLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buildingLabel?: string;
}


export class UpdateLeadStatusDto {
  @ApiProperty({ enum: LEAD_STATUSES })
  @IsIn(LEAD_STATUSES)
  status!: (typeof LEAD_STATUSES)[number];
}
