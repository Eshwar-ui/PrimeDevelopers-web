import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NewsService {
  constructor(private prisma: PrismaService) {}

  findAll(includeUnpublished: boolean) {
    return this.prisma.news.findMany({
      where: includeUnpublished ? {} : { published: true },
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
    });
  }

  async findBySlug(slug: string, includeUnpublished: boolean) {
    const post = await this.prisma.news.findUnique({ where: { slug } });
    if (!post || (!includeUnpublished && !post.published)) {
      throw new NotFoundException(`No news post with slug "${slug}"`);
    }
    return post;
  }

  create(data: Prisma.NewsCreateInput) {
    return this.prisma.news.create({ data });
  }

  async update(id: string, data: Prisma.NewsUpdateInput) {
    await this.assertExists(id);
    return this.prisma.news.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.news.delete({ where: { id } });
  }

  private async assertExists(id: string) {
    const found = await this.prisma.news.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`No news post with id "${id}"`);
  }
}
