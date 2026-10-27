import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  /**
   * `includeUnpublished` is the single place the public/admin distinction is
   * expressed. It replaces the old `properties_public_read` RLS policy, which
   * filtered on `published = true` in the database. Callers must pass it
   * explicitly — there is no default, so a new caller cannot leak drafts by
   * forgetting.
   */
  findAll(includeUnpublished: boolean) {
    return this.prisma.property.findMany({
      where: includeUnpublished ? {} : { published: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findBySlug(slug: string, includeUnpublished: boolean) {
    const property = await this.prisma.property.findUnique({ where: { slug } });
    if (!property || (!includeUnpublished && !property.published)) {
      // Same 404 either way: an unpublished property should be indistinguishable
      // from one that doesn't exist, or the draft slug leaks.
      throw new NotFoundException(`No property with slug "${slug}"`);
    }
    return property;
  }

  create(data: Prisma.PropertyCreateInput) {
    return this.prisma.property.create({ data });
  }

  /**
   * `expectedUpdatedAt` makes the write conditional: it lands only if the row
   * still carries that exact timestamp, and otherwise answers 409 with the
   * timestamp it does carry.
   *
   * The editor used to check this itself — read, compare, then write — which
   * left a gap between the read and the write for another save (or a tracker
   * sync) to land in, unseen. Here the read and the write share a transaction
   * and the row is locked first (`FOR UPDATE`, the same lock the tracker sync
   * takes), so of two saves that both started from one version exactly one
   * wins and the other is told.
   *
   * Without it the write is unconditional, as before.
   */
  async update(id: string, data: Prisma.PropertyUpdateInput, expectedUpdatedAt?: string) {
    if (!expectedUpdatedAt) {
      await this.assertExists(id);
      return this.prisma.property.update({
        where: { id },
        data: { ...data, updatedAt: new Date() },
      });
    }

    const expected = new Date(expectedUpdatedAt).getTime();
    return this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ updated_at: Date }[]>`
        SELECT updated_at FROM properties WHERE id = ${id}::uuid FOR UPDATE`;
      if (!row) throw new NotFoundException(`No property with id "${id}"`);

      // Compared as milliseconds: the editor's copy came through JSON, which
      // carries milliseconds, and Prisma reads the column back the same way.
      const current = new Date(row.updated_at).getTime();
      if (current !== expected) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'This property was changed by someone else after you opened it.',
          updatedAt: new Date(current).toISOString(),
        });
      }

      return tx.property.update({
        where: { id },
        // Always moves forward, even within the millisecond of the last write,
        // so the version just saved can never equal the one it replaced.
        data: { ...data, updatedAt: new Date(Math.max(Date.now(), current + 1)) },
      });
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.property.delete({ where: { id } });
  }

  private async assertExists(id: string) {
    const found = await this.prisma.property.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`No property with id "${id}"`);
  }
}
