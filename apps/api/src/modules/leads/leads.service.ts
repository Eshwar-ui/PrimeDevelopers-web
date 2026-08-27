import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BrochureRequestDto, CreateLeadDto } from './dto/lead.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  // A brochure is a document the client already produces; the CMS holds a
  // link to it in a couple of places depending on how the property was set
  // up. Checked in order of how deliberate each one is: the overview flyer
  // is the field that means "this property's brochure", where a resource
  // link merely happens to be a PDF.
  private flyerUrlFor(detail: unknown): string | null {
    const d = (detail ?? {}) as Record<string, any>;
    const overview = d.overview?.flyer;
    if (typeof overview === 'string' && overview.trim()) return overview.trim();

    const links: Array<{ url?: string; label?: string }> = Array.isArray(d.resourceLinks)
      ? d.resourceLinks
      : [];
    const named = links.find(
      (l) => typeof l?.url === 'string' && /brochure|flyer/i.test(String(l.label ?? '')),
    );
    if (named?.url) return named.url;

    const pdf = links.find((l) => typeof l?.url === 'string' && /\.pdf(\?|$)/i.test(l.url));
    return pdf?.url ?? null;
  }

  /**
   * Records the request as a lead, then emails the property's brochure to
   * whoever asked for it.
   *
   * The lead is written first and on its own. The email is the part that can
   * fail for reasons outside this system — an unverified SES identity, a
   * flyer URL that 404s, a mailbox that bounces — and none of those are a
   * reason to lose the enquiry. So a failed send is logged and reported back
   * as `emailed: false`, and the visitor is told plainly rather than shown a
   * success they did not get.
   */
  async requestBrochure(dto: BrochureRequestDto) {
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      select: { id: true, name: true, slug: true, address: true, detail: true },
    });
    if (!property) throw new NotFoundException(`No property with id "${dto.propertyId}"`);

    const lead = await this.prisma.websiteLead.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        message: `Brochure requested for ${property.name}.`,
      },
    });

    const flyerUrl = this.flyerUrlFor(property.detail);
    let emailed = false;
    try {
      emailed = await this.sendBrochureEmail(dto, property, flyerUrl);
    } catch (err) {
      this.logger.error(
        `Brochure email to ${dto.email} for ${property.slug} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { id: lead.id, emailed, hasBrochure: Boolean(flyerUrl) };
  }

  private async sendBrochureEmail(
    dto: BrochureRequestDto,
    property: { name: string; address: string | null; detail: unknown },
    flyerUrl: string | null,
  ): Promise<boolean> {
    const d = (property.detail ?? {}) as Record<string, any>;
    const overview: string = typeof d.overview?.body === 'string' ? d.overview.body : '';

    let attachment;
    if (flyerUrl) {
      // Bounded and timed out: this URL comes from the CMS, and a slow or
      // enormous file would otherwise hold the request open and push a
      // multi-megabyte buffer through the mail path. SES caps a message at
      // 40 MB; well under that is the only sane budget for a brochure.
      const MAX_BYTES = 8 * 1024 * 1024;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(flyerUrl, { signal: controller.signal });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.byteLength <= MAX_BYTES) {
            const name = decodeURIComponent(new URL(flyerUrl).pathname.split('/').pop() || 'brochure.pdf');
            attachment = {
              filename: /\.[a-z0-9]+$/i.test(name) ? name : `${name}.pdf`,
              contentType: res.headers.get('content-type') ?? 'application/pdf',
              content: buf,
            };
          } else {
            this.logger.warn(`Brochure for ${property.name} is ${buf.byteLength} bytes — too large to attach.`);
          }
        } else {
          this.logger.warn(`Brochure fetch for ${property.name} returned ${res.status}.`);
        }
      } finally {
        clearTimeout(timer);
      }
    }

    const lines = [
      `Hi ${dto.name},`,
      '',
      attachment
        ? `Thanks for your interest in ${property.name}. The brochure is attached.`
        : `Thanks for your interest in ${property.name}. Our team will send the brochure across shortly.`,
      '',
      property.address ? `${property.name} — ${property.address}` : property.name,
      ...(overview ? ['', overview] : []),
      '',
      'If you would like to arrange a tour or talk through availability, just reply to this email.',
      '',
      'Prime Developers',
    ];

    return this.mail.send({
      to: dto.email,
      subject: `${property.name} — brochure`,
      text: lines.join('\n'),
      attachments: attachment ? [attachment] : undefined,
    });
  }

  /**
   * Writes the lead and its unit attribution in one transaction.
   *
   * The browser previously did this as two independent inserts, so a failed
   * attribution left a lead with no record of what it was about — and the
   * failure was only ever console.error'd, invisible to anyone who could act
   * on it. Either both rows land or neither does.
   */
  async create(dto: CreateLeadDto) {
    const { propertyId, unitLabel, buildingLabel, ...lead } = dto;

    const wantsAttribution = Boolean(propertyId || unitLabel);
    if (wantsAttribution && !(propertyId && unitLabel)) {
      throw new BadRequestException(
        'propertyId and unitLabel must be provided together to attribute a lead to a unit',
      );
    }

    try {
      return await this.prisma.websiteLead.create({
        data: {
          ...lead,
          ...(wantsAttribution && {
            unitAttributions: {
              create: {
                propertyId: propertyId!,
                unitLabel: unitLabel!,
                buildingLabel: buildingLabel ?? null,
              },
            },
          }),
        },
        include: { unitAttributions: true },
      });
    } catch (err) {
      // A stale propertyId is a client-side problem, not a server fault — the
      // property may have been deleted while the visitor had the page open.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException(`No property with id "${propertyId}"`);
      }
      throw err;
    }
  }

  findAll() {
    return this.prisma.websiteLead.findMany({
      orderBy: { createdAt: 'desc' },
      include: { unitAttributions: true },
    });
  }

  async updateStatus(id: string, status: string) {
    await this.assertExists(id);
    return this.prisma.websiteLead.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.assertExists(id);
    // Attributions cascade — the FK is ON DELETE CASCADE.
    await this.prisma.websiteLead.delete({ where: { id } });
  }

  private async assertExists(id: string) {
    const found = await this.prisma.websiteLead.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`No lead with id "${id}"`);
  }
}
