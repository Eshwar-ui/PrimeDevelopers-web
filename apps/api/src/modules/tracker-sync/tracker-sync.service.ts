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
 * The property's `detail` after a merge. The site model is written only when
 * the merge changed it — a binding re-pointed or a unit tag dropped, which it
 * marks by handing back a new object — and floor plans only when the property
 * had some or the merge made some: a property with none keeps none rather than
 * gaining an empty object.
 */
function nextDetail(
  detail: Record<string, any>,
  floorPlans: Record<string, any> | null | undefined,
  siteModel: SiteModel | null | undefined,
  trackerCounts: TrackerCounts,
): Prisma.InputJsonValue {
  const next: Record<string, any> = { ...detail, trackerCounts };
  if (floorPlans !== undefined) next.floorPlans = floorPlans;
  if (siteModel !== detail.siteModel) next.siteModel = siteModel;
  return next as Prisma.InputJsonValue;
}

/**
 * The part of the site model a sync can change, for its undo record: spread
 * back over `detail.siteModel`, it puts every shape back on the label it had,
 * without undoing a model re-uploaded since.
 */
const siteBindings = (siteModel: SiteModel | null | undefined) =>
  siteModel
    ? ({ unitBindings: siteModel.unitBindings ?? {}, buildingBindings: siteModel.buildingBindings ?? {} } as Prisma.InputJsonValue)
    : Prisma.JsonNull;

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
      const property = await this.findProperty(tx, snapshot, !!options.dryRun);
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

      if (!report.changed) return result;

      // Never roll back to an older picture of the project: a delayed push, or
      // one replayed inside the signature's window, would undo newer statuses
      // (security audit L5). Compared with the last snapshot that changed this
      // property, whose generatedAt the sync record keeps.
      const last = await tx.websiteTrackerSync.findFirst({
        where: { propertyId: current.id },
        orderBy: { createdAt: 'desc' },
        select: { report: true },
      });
      const lastGeneratedAt = (last?.report as { generatedAt?: string } | null)?.generatedAt;
      if (lastGeneratedAt && !(Date.parse(snapshot.generatedAt) > Date.parse(lastGeneratedAt))) {
        this.logger.warn(`Refused stale tracker snapshot for ${current.slug}: ${snapshot.generatedAt} is not newer than ${lastGeneratedAt}`);
        throw new ConflictException(
          `Snapshot generated ${snapshot.generatedAt} is not newer than the last one applied (${lastGeneratedAt}); push a fresh one.`,
        );
      }

      await tx.websiteTrackerSync.create({
        data: {
          propertyId: current.id,
          trackerProjectId: snapshot.project.id,
          report: { ...report, generatedAt: snapshot.generatedAt } as unknown as Prisma.InputJsonValue,
          previousFloorPlans: (detail.floorPlans ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          previousTotals: totalsBefore,
          previousSiteBindings: siteBindings(detail.siteModel),
          forced: !!options.force,
        },
      });
      await tx.property.update({
        where: { id: current.id },
        data: {
          ...totals,
          detail: nextDetail(detail, floorPlans, siteModel, trackerCounts),
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
   * The property an admin linked to this project in the CMS (its "Prime Tracker
   * project ID"). The sync no longer links a property itself: any tracker user
   * who could set a project's website slug could otherwise claim any unlinked
   * listing and rewrite its units (security audit M3). A dry run may still look
   * a property up by slug, so the first push can be previewed before linking;
   * it writes nothing.
   */
  private async findProperty(tx: Prisma.TransactionClient, snapshot: TrackerSnapshot, dryRun: boolean) {
    const linked = await tx.property.findUnique({
      where: { trackerProjectId: snapshot.project.id },
      select: { id: true },
    });
    if (linked) return linked;

    const bySlug = await tx.property.findUnique({
      where: { slug: snapshot.project.websiteSlug },
      select: { id: true, trackerProjectId: true },
    });
    if (bySlug && dryRun && !bySlug.trackerProjectId) return bySlug;
    if (bySlug?.trackerProjectId) {
      throw new ConflictException(
        `Property "${snapshot.project.websiteSlug}" already mirrors tracker project ${bySlug.trackerProjectId}`,
      );
    }
    throw new NotFoundException(
      bySlug
        ? `Property "${snapshot.project.websiteSlug}" is not linked to tracker project ${snapshot.project.id} (${snapshot.project.name}). ` +
            `An admin links it in the website CMS: Properties → ${snapshot.project.websiteSlug} → Prime Tracker project ID.`
        : `No property with slug "${snapshot.project.websiteSlug}"`,
    );
  }
}
