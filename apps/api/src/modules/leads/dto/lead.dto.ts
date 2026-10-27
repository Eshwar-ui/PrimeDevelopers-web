import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsFlatContext } from '../../../common/validators/flat-context';

// `read` is what the admin's mark-read toggle writes; the rest are for a sales
// pipeline the CMS doesn't expose yet. Omitting `read` would have made that
// button 400 — the column had no constraint before, so nothing caught it.
export const LEAD_STATUSES = ['new', 'read', 'contacted', 'qualified', 'closed'] as const;

// Which shared QuoteForm embed a lead came through — see QuoteForm.jsx on the
// web side, which is the only thing that sets this.
export const LEAD_SOURCES = ['contact', 'interiors', 'franchise', 'collab', 'invest'] as const;

/**
 * Two cheap tells of a bot, carried by both public forms and checked in
 * LeadsService.
 *
 * - `honeypot` is a field the forms hide from people (off screen, out of the
 *   tab order, hidden from assistive technology, named so no autofill profile
 *   matches it) that a form-filling bot fills in like any other.
 * - `fillMs` is how long the form was on screen before it was sent. A person
 *   needs a moment to type a name and an email; a script needs none.
 *
 * Either one files the lead as filtered: it is kept, flagged, out of the inbox
 * and out of the staff email, and the request is answered exactly as a real
 * one is — so a bot learns nothing, and a person who tripped it by mistake is
 * still in the admin under "Show filtered". Both are optional, so a form from
 * before this check still goes through.
 */
export class SpamSignalsDto {
  @ApiPropertyOptional({ description: 'Honeypot. Must be empty.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  honeypot?: string;

  // No upper bound: a tab left open for a week is still a person, and the
  // only thing this field can prove is that a submission was too quick.
  @ApiPropertyOptional({ description: 'Milliseconds the form was open before it was sent.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  fillMs?: number;
}

/**
 * The public lead submission. This is the only unauthenticated write in the
 * API, so every field is bounded — previously the browser inserted straight
 * into Postgres and a 10 MB message was as acceptable as a 10 character one.
 */
export class CreateLeadDto extends SpamSignalsDto {
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
  @IsFlatContext()
  context?: Record<string, string | number | boolean>;

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
export class BrochureRequestDto extends SpamSignalsDto {
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


/**
 * Paging for the admin list, newest first. The cursor is the last lead already
 * shown — its `createdAt` and `id` — rather than its id alone, so it still
 * works when that lead has been deleted in the meantime.
 */
export class ListLeadsQueryDto {
  @ApiPropertyOptional({ default: 100, maximum: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ description: "The last lead shown's createdAt. Send with beforeId." })
  @IsOptional()
  @IsISO8601()
  before?: string;

  @ApiPropertyOptional({ description: "The last lead shown's id. Send with before." })
  @IsOptional()
  @IsUUID()
  beforeId?: string;

  // A string, not a boolean: query values arrive as text, and implicit
  // conversion turns "false" into true.
  @ApiPropertyOptional({ enum: ['true', 'false'], description: 'true lists the leads the spam checks filtered out.' })
  @IsOptional()
  @IsIn(['true', 'false'])
  filtered?: 'true' | 'false';
}

/** What the admin can change on a lead: its status, and whether it was filtered as spam. */
export class UpdateLeadDto {
  @ApiPropertyOptional({ enum: LEAD_STATUSES })
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: (typeof LEAD_STATUSES)[number];

  /** false moves a filtered lead into the inbox — the spam checks got it wrong. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  spam?: boolean;
}
