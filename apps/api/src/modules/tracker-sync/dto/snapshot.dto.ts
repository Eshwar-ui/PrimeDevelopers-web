import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TRACKER_UNIT_STATUSES, TrackerUnitStatus } from '../tracker-merge';

/**
 * The snapshot Prime Tracker pushes, version 1 — see
 * docs/tracker-sync-and-aws-plan.md. Signed, so these bounds are not about
 * hostile input; they keep a tracker bug from writing a malformed row into the
 * public site's unit list.
 */
export class SnapshotUnitDto {
  @IsString() @MinLength(1) @MaxLength(64)
  id!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  unitNumber!: string;

  @IsIn(TRACKER_UNIT_STATUSES)
  status!: TrackerUnitStatus;

  @IsOptional() @IsInt() @Min(0)
  sqft!: number | null;

  @IsOptional() @IsString() @MaxLength(200)
  dealRef!: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  occupant!: string | null;
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
  @Equals(1)
  version!: 1;

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
