import { IsDefined, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateContentDto {
  /**
   * Deliberately unvalidated beyond "is an object". Each section's payload is
   * shaped by its own admin editor and the shapes differ per section; pinning
   * them down here would mean a DTO per section that has to be kept in step
   * with the frontend editors. The column is jsonb — Postgres accepts any of
   * it, and only the admin UI reads it back.
   */
  @ApiProperty({ type: Object })
  @IsDefined()
  @IsObject()
  data!: Record<string, unknown>;
}
