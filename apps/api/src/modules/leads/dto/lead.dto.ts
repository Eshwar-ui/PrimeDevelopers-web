import {
  IsEmail,
  IsIn,
  IsObject,
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

// Which shared QuoteForm embed a lead came through — see QuoteForm.jsx on the
// web side, which is the only thing that sets this.
export const LEAD_SOURCES = ['contact', 'interiors', 'franchise', 'collab', 'invest'] as const;

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

  @ApiPropertyOptional({ enum: LEAD_SOURCES, default: 'contact' })
  @IsOptional()
  @IsIn(LEAD_SOURCES)
  source?: (typeof LEAD_SOURCES)[number];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape varies by `source`; Prisma's Json input type needs `any` here, not `unknown`.
  @ApiPropertyOptional({ description: 'Structured detail specific to `source` — an interior option slug, a desired property, an investment track.' })
  @IsOptional()
  @IsObject()
  context?: Record<string, any>;

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


/**
 * A brochure request. Narrower than CreateLeadDto on purpose: this form asks
 * for three fields and a property, and the visitor is telling us which
 * property they want — so propertyId is required here where it is optional
 * there, and there is no free-text message to bound.
 */
export class BrochureRequestDto {
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

  @ApiProperty()
  @IsUUID()
  propertyId!: string;
}


export class UpdateLeadStatusDto {
  @ApiProperty({ enum: LEAD_STATUSES })
  @IsIn(LEAD_STATUSES)
  status!: (typeof LEAD_STATUSES)[number];
}
