import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MergeReport, SiteModel, TrackerCounts, TrackerSnapshot, mergeSnapshot } from './tracker-merge';

export interface ApplyOptions {
  dryRun?: boolean;
  force?: boolean;
}

export interface ApplyResult {
  property: string;
  applied: boolean;
  dryRun: boolean;
  report: MergeReport;
}

/**
 * The property's `detail` after a merge. The site model is written only when a
 * binding moved, and floor plans only when the property had some or the merge
 * made some — a property with none keeps none rather than gaining an empty
 * object.
 */
function nextDetail(
  detail: Record<string, any>,
  floorPlans: Record<string, any> | null | undefined,
  siteModel: SiteModel | null | undefined,
  trackerCounts: TrackerCounts,
  rebound: boolean,
): Prisma.InputJsonValue {
  const next: Record<string, any> = { ...detail, trackerCounts };
  if (floorPlans !== undefined) next.floorPlans = floorPlans;
  if (rebound) next.siteModel = siteModel;
  return next as Prisma.InputJsonValue;
}

@Injectable()
export class TrackerSyncService {
  private readonly logger = new Logger(TrackerSyncService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Merges one project snapshot into the property that mirrors it.
   *
   * Runs in a transaction that locks the property row, so a CMS save landing
   * mid-sync cannot be half-overwritten. The CMS editor saves the whole
   * `detail` blob and can still overwrite a sync that finished a moment
   * earlier — the tracker's hourly push puts the tracker's fields back.
   */
  async apply(snapshot: TrackerSnapshot, options: ApplyOptions = {}): Promise<ApplyResult> {
    return this.prisma.$transaction(async (tx) => {
      const property = await this.findProperty(tx, snapshot);
      await tx.$queryRaw`SELECT id FROM properties WHERE id = ${property.id}::uuid FOR UPDATE`;
      const current = await tx.property.findUniqueOrThrow({ where: { id: property.id } });

      const detail = (current.detail ?? {}) as Record<string, any>;
      const totalsBefore = { buildings: current.buildings, sold: current.sold, available: current.available };
      const { floorPlans, siteModel, trackerCounts, totals, report } = mergeSnapshot(
        detail.floorPlans,
        totalsBefore,
        snapshot,
        { force: options.force, siteModel: detail.siteModel, trackerCounts: detail.trackerCounts },
      );

      // A dry run answers 200 with the whole report — refusals included — so
      // the first push of a property can be read before anything is written.
      const result: ApplyResult = { property: current.slug, applied: false, dryRun: !!options.dryRun, report };
      if (options.dryRun) return result;
      if (report.refused) {
        this.logger.warn(`Refused tracker sync for ${current.slug}: ${report.refused}`);
        throw new ConflictException(result);
      }

      // Linking is a write, so it waits until a real run — a dry run against
      // the wrong slug must not claim that property for the project.
      const link = current.trackerProjectId ? {} : { trackerProjectId: snapshot.project.id };
      if (!report.changed) {
        if (current.trackerProjectId) return result;
        await tx.property.update({ where: { id: current.id }, data: link });
        return { ...result, applied: true };
      }

      await tx.websiteTrackerSync.create({
        data: {
          propertyId: current.id,
          trackerProjectId: snapshot.project.id,
          report: report as unknown as Prisma.InputJsonValue,
          previousFloorPlans: (detail.floorPlans ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          previousTotals: totalsBefore,
          forced: !!options.force,
        },
      });
      await tx.property.update({
        where: { id: current.id },
        data: {
          ...link,
          ...totals,
          detail: nextDetail(detail, floorPlans, siteModel, trackerCounts, report.rebound.length > 0),
          trackerSyncedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Tracker sync ${current.slug}: ${totalsBefore.buildings}/${totalsBefore.sold}/${totalsBefore.available}` +
          ` → ${totals.buildings}/${totals.sold}/${totals.available}, ${report.removedRows} rows removed` +
          (options.force ? ` (forced past: ${report.refusals.join('; ') || 'nothing'})` : ''),
      );
      return { ...result, applied: true };
    });
  }

  /**
   * By tracker id once linked; by slug only for the first sync. A slug that
   * already belongs to a different project is a conflict, never a re-link —
   * otherwise a typo in one project's website slug would silently start
   * overwriting another project's units.
   */
  private async findProperty(tx: Prisma.TransactionClient, snapshot: TrackerSnapshot) {
    const linked = await tx.property.findUnique({
      where: { trackerProjectId: snapshot.project.id },
      select: { id: true },
    });
    if (linked) return linked;

    const bySlug = await tx.property.findUnique({
      where: { slug: snapshot.project.websiteSlug },
      select: { id: true, trackerProjectId: true },
    });
    if (!bySlug) {
      throw new NotFoundException(`No property with slug "${snapshot.project.websiteSlug}"`);
    }
    if (bySlug.trackerProjectId && bySlug.trackerProjectId !== snapshot.project.id) {
      throw new ConflictException(
        `Property "${snapshot.project.websiteSlug}" already mirrors tracker project ${bySlug.trackerProjectId}`,
      );
    }
    return bySlug;
  }
}
