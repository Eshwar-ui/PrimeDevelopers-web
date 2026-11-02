import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hiddenUnitPaths } from '../properties/public-property';

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

// A unit's public page, wherever a section writes one into a link or a body.
// Slugs only (`labelSlug`), so a full stop or bracket after a link in prose is not part of it.
const UNIT_PAGE = /\/properties\/([\w-]+)\/units\/([\w-]+)\/([\w-]+)/gi;

/**
 * Every unit a value points at, as `property/building/unit` — by a link to its
 * page in any string, or by the `propertySlug` + `unitKey` pair a homepage
 * unit card stores (apps/web/src/lib/featured.js).
 */
function unitPathsIn(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    for (const [, property, building, unit] of value.matchAll(UNIT_PAGE)) {
      found.add(`${property}/${building}/${unit}`.toLowerCase());
    }
  } else if (Array.isArray(value)) {
    for (const item of value) unitPathsIn(item, found);
  } else if (value && typeof value === 'object') {
    const { propertySlug, unitKey } = value as Record<string, unknown>;
    if (typeof propertySlug === 'string' && typeof unitKey === 'string') found.add(`${propertySlug}/${unitKey}`.toLowerCase());
    for (const item of Object.values(value)) unitPathsIn(item, found);
  }
  return found;
}

/**
 * Removes every item in any array that points at a hidden unit — a homepage
 * card that features it, a link to its page — before a section goes to a
 * visitor. The same line as `withoutDrafts`, and for the same reason: the
 * browser would otherwise be the only thing keeping a unit an editor switched
 * off out of sight, and the card's heading, photographs and link are all in
 * the body of GET /api/content.
 *
 * `hidden` is `hiddenUnitPaths()`. Only arrays are pruned: a section's own
 * fields are never dropped, since the section would go with them.
 */
export function withoutHiddenUnits(value: Prisma.JsonValue, hidden: Set<string>): Prisma.JsonValue {
  if (Array.isArray(value)) {
    return value
      .filter((item) => ![...unitPathsIn(item)].some((path) => hidden.has(path)))
      .map((item) => withoutHiddenUnits(item, hidden));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutHiddenUnits(v as Prisma.JsonValue, hidden)]));
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
    const sections = Object.fromEntries(rows.map((r) => [r.section, includeDrafts ? r.data : withoutDrafts(r.data)]));
    if (includeDrafts || !unitPathsIn(sections).size) return sections;

    // Only a section that points at a unit needs the property list; most
    // responses never read it.
    const properties = await this.prisma.property.findMany({ select: { slug: true, detail: true } });
    const hidden = hiddenUnitPaths(properties);
    return hidden.size ? (withoutHiddenUnits(sections, hidden) as Record<string, Prisma.JsonValue>) : sections;
  }

  async upsert(section: string, data: Prisma.InputJsonValue) {
    return this.prisma.content.upsert({
      where: { section },
      create: { section, data },
      update: { data, updatedAt: new Date() },
    });
  }
}
