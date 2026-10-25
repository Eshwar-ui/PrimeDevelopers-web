import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Removes every draft from a section before it goes to a visitor: any object in any
 * array whose `published` is exactly `false`.
 *
 * The CMS keeps drafts inside the section they belong to — a CAP/NNN listing is an
 * item in `cap_listings.items` with `published: false` until an editor publishes it
 * — and until this existed the only thing hiding a draft was the browser, so its
 * price, cap rate, rent and tenant were readable by anyone calling GET /api/content.
 *
 * `false` exactly, not falsy: an item that has no `published` field at all was never
 * a draft (most sections have no such concept) and must keep rendering.
 */
export function withoutDrafts(value: Prisma.JsonValue): Prisma.JsonValue {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(item && typeof item === 'object' && !Array.isArray(item) && item.published === false))
      .map(withoutDrafts);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutDrafts(v as Prisma.JsonValue)]));
  }
  return value;
}

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns every section keyed by name, which is the shape ContentContext
   * wants. The table has one row per site section and will never be large
   * enough for pagination to be worth the complexity.
   *
   * `includeDrafts` is the public/admin line, passed explicitly by each caller —
   * the same rule as PropertiesService.findAll, so a new caller cannot leak drafts
   * by forgetting it.
   */
  async findAll(includeDrafts: boolean): Promise<Record<string, Prisma.JsonValue>> {
    const rows = await this.prisma.content.findMany({
      select: { section: true, data: true },
    });
    return Object.fromEntries(rows.map((r) => [r.section, includeDrafts ? r.data : withoutDrafts(r.data)]));
  }

  async upsert(section: string, data: Prisma.InputJsonValue) {
    return this.prisma.content.upsert({
      where: { section },
      create: { section, data },
      update: { data, updatedAt: new Date() },
    });
  }
}
