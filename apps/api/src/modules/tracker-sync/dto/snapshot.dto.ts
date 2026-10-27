import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SNAPSHOT_VERSIONS } from '../tracker-merge';

/**
 * The snapshot Prime Tracker pushes, versions 1 and 2 — see
 * docs/tracker-sync-and-aws-plan.md. Signed, so these bounds are not about
 * hostile input; they keep a tracker bug from writing a malformed row into the
 * public site's unit list.
 *
 * Version 2 only adds optional fields, so both arrive here. The website must
 * accept a version before the tracker sends it: deploy the website first.
 */
export class SnapshotUnitDto {
  @IsString() @MinLength(1) @MaxLength(64)
  id!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  unitNumber!: string;

  // Any enum-shaped value, not only the seven known ones: a status a newer
  // tracker added must not fail the whole project's push. The merge reports
  // it and keeps the row's previous status.
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{0,39}$/)
  status!: string;

  @IsOptional() @IsInt() @Min(0)
  sqft!: number | null;

  @IsOptional() @IsString() @MaxLength(200)
  dealRef!: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  occupant!: string | null;

  // ── Version 2 ──

  @IsOptional() @IsArray() @ArrayMaxSize(200)
  @IsString({ each: true }) @MaxLength(64, { each: true })
  dealUnitIds?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(200)
  @IsString({ each: true }) @MaxLength(64, { each: true })
  mergedFromIds?: string[];

  // Free text in the tracker (a CustomOption key), so roomier than a unit number.
  @IsOptional() @IsString() @MaxLength(200)
  unitType?: string | null;

  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0)
  askingRent?: number | null;

  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0)
  askingPrice?: number | null;

  @IsOptional() @IsISO8601()
  availableSince?: string | null;
}

export class SnapshotBuildingDto {
  @IsString() @MinLength(1) @MaxLength(64)
  id!: string;

  @IsString() @MaxLength(200)
  name!: string;

  @IsArray() @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => SnapshotUnitDto)
  units!: SnapshotUnitDto[];

  // ── Version 2 ──

  @IsOptional() @IsInt() @Min(0)
  totalSqft?: number | null;

  @IsOptional() @IsInt() @Min(0)
  stories?: number | null;
}

export class SnapshotProjectDto {
  @IsString() @MinLength(1) @MaxLength(64)
  id!: string;

  @IsString() @MaxLength(200)
  name!: string;

  @IsString() @MinLength(1) @MaxLength(120)
  websiteSlug!: string;
}

export class TrackerSnapshotDto {
  @IsIn(SNAPSHOT_VERSIONS)
  version!: (typeof SNAPSHOT_VERSIONS)[number];

  @IsISO8601()
  generatedAt!: string;

  @ValidateNested()
  @Type(() => SnapshotProjectDto)
  project!: SnapshotProjectDto;

  @IsArray() @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SnapshotBuildingDto)
  buildings!: SnapshotBuildingDto[];
}
