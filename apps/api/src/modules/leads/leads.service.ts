import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BrochureRequestDto, CreateLeadDto, ListLeadsQueryDto, SpamSignalsDto } from './dto/lead.dto';
import { MailService } from '../mail/mail.service';

// How a brochure request reads in the leads list — also how one is recognised when
// counting recent requests to the same address.
const BROCHURE_MESSAGE_PREFIX = 'Brochure requested for';
export const BROCHURE_EMAILS_PER_ADDRESS_PER_DAY = 3;
const BROCHURE_MAX_BYTES = 8 * 1024 * 1024;

/** Where staff notifications go unless LEADS_NOTIFY_TO says otherwise. */
export const DEFAULT_LEADS_NOTIFY_TO = 'sales@theprimedeveloper.com';

/**
 * Faster than this from the form appearing to it being sent is a script. A
 * person with autofill still has to open the form, accept the suggestion and
 * press Send — comfortably over two and a half seconds.
 */
export const MIN_FILL_MS = 2500;

export const LEADS_PAGE_DEFAULT = 100;

/** Which bot tell a submission shows, or null for none. See SpamSignalsDto. */
export function spamSignal(dto: SpamSignalsDto): string | null {
  if (typeof dto.website === 'string' && dto.website.trim()) return 'honeypot filled';
  if (typeof dto.fillMs === 'number' && dto.fillMs < MIN_FILL_MS) return `sent ${dto.fillMs}ms after the form opened`;
  return null;
}

/** What happened to the brochure email, for the staff notification. */
export type BrochureOutcome = { sent: true; attached: boolean } | { sent: false; reason: string };

/** `Label: value`, or nothing at all for an empty value. */
const field = (label: string, value: unknown): string[] => {
  const text = value == null ? '' : String(value).trim();
  return text ? [`${label}: ${text}`] : [];
};

// A visitor-typed name goes into the subject; SES encodes it, but a line
// break still has no business in a header.
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

/**
 * The response body, or null once it passes `max` bytes — checked as it streams,
 * so an oversized flyer is abandoned at the limit instead of downloaded in full
 * and only then measured.
 */
export async function readCapped(res: Response, max: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!res.body) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  private readonly notifyTo: string[];
  private readonly adminUrl: string | null;

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    config: ConfigService,
  ) {
    // Comma-separated, so a second inbox is a config change rather than a deploy.
    this.notifyTo = String(config.get('LEADS_NOTIFY_TO') || DEFAULT_LEADS_NOTIFY_TO)
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);
    // Only a real https site gets a link: the local default is localhost,
    // which would be a dead link in anyone's inbox.
    const site = String(config.get('FRONTEND_URL') ?? '').replace(/\/+$/, '');
    this.adminUrl = /^https:\/\//.test(site) ? `${site}/admin/leads` : null;
  }

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
    const spam = spamSignal(dto);
    if (spam) {
      this.logger.warn(`Dropped a brochure request as spam (${spam}).`);
      return { id: randomUUID(), emailed: false, hasBrochure: false };
    }

    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      select: { id: true, name: true, slug: true, address: true, detail: true, published: true },
    });
    // An unpublished property answers exactly like a missing one: the endpoint must
    // not confirm a draft exists, let alone mail out its brochure.
    if (!property || !property.published) throw new NotFoundException(`No property with id "${dto.propertyId}"`);

    // Counted before this request's own row is written.
    const recentToSameAddress = await this.prisma.websiteLead.count({
      where: {
        email: { equals: dto.email, mode: 'insensitive' },
        message: { startsWith: BROCHURE_MESSAGE_PREFIX },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    const lead = await this.prisma.websiteLead.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        message: `${BROCHURE_MESSAGE_PREFIX} ${property.name}.`,
      },
    });

    // This endpoint sends mail from the company's own address to any address it is
    // given, with a visitor-supplied name in the body. The per-IP limit stops one
    // sender; this stops anyone using it to flood one recipient. The enquiry is
    // still recorded — only the email is withheld.
    const flyerUrl = this.flyerUrlFor(property.detail);
    let outcome: BrochureOutcome;
    if (recentToSameAddress >= BROCHURE_EMAILS_PER_ADDRESS_PER_DAY) {
      this.logger.warn(`Brochure email withheld for ${property.slug}: daily limit reached for one address.`);
      outcome = { sent: false, reason: `this address already asked ${recentToSameAddress} times today, so the daily limit held it back` };
    } else {
      try {
        const result = await this.sendBrochureEmail(dto, property, flyerUrl);
        outcome = result.sent
          ? { sent: true, attached: result.attached }
          : { sent: false, reason: 'email is switched off on the server (MAIL_FROM or AWS_REGION unset)' };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Brochure email to ${dto.email} for ${property.slug} failed: ${message}`);
        outcome = { sent: false, reason: `the send failed (${message})` };
      }
    }

    await this.notifyStaff(
      { id: lead.id, name: dto.name, email: dto.email, phone: dto.phone },
      { property: property.name, brochure: outcome, hasBrochure: Boolean(flyerUrl) },
    );

    return { id: lead.id, emailed: outcome.sent, hasBrochure: Boolean(flyerUrl) };
  }

  private async sendBrochureEmail(
    dto: BrochureRequestDto,
    property: { name: string; address: string | null; detail: unknown },
    flyerUrl: string | null,
  ): Promise<{ sent: boolean; attached: boolean }> {
    const d = (property.detail ?? {}) as Record<string, any>;
    const overview: string = typeof d.overview?.body === 'string' ? d.overview.body : '';

    let attachment;
    if (flyerUrl) {
      // Bounded and timed out: this URL comes from the CMS, and a slow or
      // enormous file would otherwise hold the request open and push a
      // multi-megabyte buffer through the mail path. SES caps a message at
      // 40 MB; well under that is the only sane budget for a brochure.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(flyerUrl, { signal: controller.signal });
        if (res.ok) {
          const buf = await readCapped(res, BROCHURE_MAX_BYTES);
          if (buf) {
            const name = decodeURIComponent(new URL(flyerUrl).pathname.split('/').pop() || 'brochure.pdf');
            attachment = {
              filename: /\.[a-z0-9]+$/i.test(name) ? name : `${name}.pdf`,
              contentType: res.headers.get('content-type') ?? 'application/pdf',
              content: buf,
            };
          } else {
            this.logger.warn(`Brochure for ${property.name} is over ${BROCHURE_MAX_BYTES} bytes — too large to attach.`);
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

    const sent = await this.mail.send({
      to: dto.email,
      subject: `${property.name} — brochure`,
      text: lines.join('\n'),
      attachments: attachment ? [attachment] : undefined,
    });
    return { sent, attached: Boolean(attachment) };
  }

  /**
   * Tells the sales inbox a lead came in. Until this existed the only way to
   * learn of one was to open /admin/leads, so an enquiry could sit unseen for
   * days.
   *
   * Never throws. The lead is already written by the time this runs, and a
   * mail problem — SES still in its sandbox, an unverified sender — costs the
   * notification, not the enquiry. A failure is logged, as the brochure's is.
   */
  async notifyStaff(
    lead: {
      id: string;
      name: string;
      email: string;
      phone?: string | null;
      message?: string | null;
      source?: string | null;
      context?: unknown;
      unitLabel?: string | null;
      buildingLabel?: string | null;
    },
    extra: { property?: string | null; brochure?: BrochureOutcome; hasBrochure?: boolean } = {},
  ): Promise<void> {
    const brochure = extra.brochure;
    const unit = lead.unitLabel
      ? [`Unit ${lead.unitLabel}`, lead.buildingLabel, extra.property].filter(Boolean).join(' · ')
      : null;
    const subject = oneLine(
      brochure
        ? `Brochure request: ${extra.property ?? 'a property'} — ${lead.name}`
        : `New enquiry from ${lead.name}${unit ? ` — ${unit}` : ''}`,
    );

    const context =
      lead.context && typeof lead.context === 'object' && !Array.isArray(lead.context)
        ? Object.entries(lead.context as Record<string, unknown>).flatMap(([key, value]) => field(key, value))
        : [];

    const lines = [
      brochure ? 'Someone asked for a brochure on the website.' : 'A new enquiry came in through the website.',
      '',
      ...field('Name', lead.name),
      ...field('Email', lead.email),
      ...field('Phone', lead.phone),
      ...field('Form', brochure ? null : lead.source),
      ...field('Property', brochure ? extra.property : null),
      ...field('Unit', unit),
      ...context,
      ...(lead.message?.trim() ? ['', 'Message:', lead.message.trim()] : []),
      ...(brochure ? ['', this.brochureLine(brochure, extra.hasBrochure)] : []),
      '',
      this.adminUrl ? `Open it in the admin: ${this.adminUrl}#lead-${lead.id}` : 'It is in the admin, under Leads.',
      'Reply to this email to answer them directly.',
    ];

    for (const to of this.notifyTo) {
      try {
        await this.mail.send({ to, subject, text: lines.join('\n'), replyTo: lead.email });
      } catch (err) {
        this.logger.error(
          `Lead notification for ${lead.id} to ${to} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // Said plainly. When the brochure did not go, the visitor was told the team
  // would send it — and this email is the only place that team finds out the
  // job is now theirs.
  private brochureLine(outcome: BrochureOutcome, hasBrochure?: boolean): string {
    if (outcome.sent && outcome.attached) return 'Brochure: emailed to them, attached.';
    if (outcome.sent) {
      return hasBrochure
        ? 'Brochure: NOT attached. The file on record could not be fetched or is too large; they were told the team will send it, so please do.'
        : 'Brochure: none on file for this property. They were told the team will send it, so please do.';
    }
    return `Brochure: NOT emailed, because ${outcome.reason}. Please send it to them yourself.`;
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
    const { propertyId, unitLabel, buildingLabel, website: _website, fillMs: _fillMs, ...lead } = dto;

    const wantsAttribution = Boolean(propertyId || unitLabel);
    if (wantsAttribution && !(propertyId && unitLabel)) {
      throw new BadRequestException(
        'propertyId and unitLabel must be provided together to attribute a lead to a unit',
      );
    }

    // After the attribution check, so a malformed request gets the same 400
    // whoever sent it. A dropped lead is answered in the shape of a real one:
    // nothing in the response tells a bot which of its tries got through.
    const spam = spamSignal(dto);
    if (spam) {
      this.logger.warn(`Dropped a ${lead.source ?? 'contact'} lead as spam (${spam}).`);
      return {
        id: randomUUID(),
        ...lead,
        phone: lead.phone ?? null,
        message: lead.message ?? null,
        status: 'new',
        source: lead.source ?? 'contact',
        context: lead.context ?? null,
        createdAt: new Date(),
        unitAttributions: [],
      };
    }

    let created;
    try {
      created = await this.prisma.websiteLead.create({
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

    // The property's name makes the notification readable at a glance; a
    // failed lookup only costs that line.
    const property = wantsAttribution
      ? await this.prisma.property
          .findUnique({ where: { id: propertyId! }, select: { name: true } })
          .catch(() => null)
      : null;
    await this.notifyStaff({ ...created, unitLabel, buildingLabel }, { property: property?.name ?? null });
    return created;
  }

  /**
   * One page of leads, newest first. `before` is the id of the last lead the
   * admin already holds; the id also breaks ties between leads written in the
   * same instant, so paging never repeats or skips one.
   */
  findAll(query: ListLeadsQueryDto = {}) {
    return this.prisma.websiteLead.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { unitAttributions: true },
      take: query.limit ?? LEADS_PAGE_DEFAULT,
      ...(query.before && { cursor: { id: query.before }, skip: 1 }),
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
