import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns every section keyed by name, which is the shape ContentContext
   * wants. The table has one row per site section and will never be large
   * enough for pagination to be worth the complexity.
   */
  async findAll(): Promise<Record<string, Prisma.JsonValue>> {
    const rows = await this.prisma.content.findMany({
      select: { section: true, data: true },
    });
    return Object.fromEntries(rows.map((r) => [r.section, r.data]));
  }

  async upsert(section: string, data: Prisma.InputJsonValue) {
    return this.prisma.content.upsert({
      where: { section },
      create: { section, data },
      update: { data, updatedAt: new Date() },
    });
  }
}
