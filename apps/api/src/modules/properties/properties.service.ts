import { Injectable, NotFoundException } from '@nestjs/common';
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

  async update(id: string, data: Prisma.PropertyUpdateInput) {
    await this.assertExists(id);
    return this.prisma.property.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
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
