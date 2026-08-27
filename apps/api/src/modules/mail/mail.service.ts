import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

export interface MailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
  replyTo?: string;
}

/**
 * Transactional email, over Amazon SES.
 *
 * SES because the deployment target is AWS: on EC2/ECS/Lambda the SDK picks
 * up the task or instance role, so there is no API key to store, rotate or
 * leak — the one credential problem this repo has already had once. It is
 * also the cheapest option at any volume this site will reach.
 *
 * When no sender is configured the service does not throw and does not
 * silently swallow either: it logs the message it *would* have sent and
 * reports back that nothing was delivered, so the caller can still record
 * the lead. A missing credential should cost an email, never a lead — those
 * are the thing the site exists to collect.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string | undefined;
  private readonly client: SESv2Client | null;

  constructor(config: ConfigService) {
    this.from = config.get<string>('MAIL_FROM');
    const region = config.get<string>('AWS_REGION');

    // Credentials are deliberately not read from config: the SDK's own
    // provider chain covers env vars, shared config, and — on AWS — the
    // instance/task role, which is the way this should run in production.
    this.client = this.from && region ? new SESv2Client({ region }) : null;

    if (!this.client) {
      this.logger.warn(
        'MAIL_FROM and AWS_REGION are not both set — email is disabled and will be logged instead of sent.',
      );
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /** Returns true if the message was handed to SES, false if email is off. */
  async send(mail: OutgoingMail): Promise<boolean> {
    if (!this.client || !this.from) {
      this.logger.log(
        `[email disabled] would send "${mail.subject}" to ${mail.to}` +
          (mail.attachments?.length
            ? ` with ${mail.attachments.length} attachment(s): ${mail.attachments.map((a) => a.filename).join(', ')}`
            : ''),
      );
      return false;
    }

    // SES v2 takes a raw RFC-5322 message for anything with an attachment;
    // the structured `Simple` form cannot carry one.
    const raw = mail.attachments?.length
      ? this.buildRawMessage(mail)
      : null;

    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [mail.to] },
        ReplyToAddresses: mail.replyTo ? [mail.replyTo] : undefined,
        Content: raw
          ? { Raw: { Data: raw } }
          : {
              Simple: {
                Subject: { Data: mail.subject, Charset: 'UTF-8' },
                Body: {
                  Text: { Data: mail.text, Charset: 'UTF-8' },
                  ...(mail.html && { Html: { Data: mail.html, Charset: 'UTF-8' } }),
                },
              },
            },
      }),
    );
    return true;
  }

  /**
   * A minimal multipart/mixed MIME message.
   *
   * Hand-rolled rather than pulling in a MIME library: this sends exactly one
   * shape of message — a body plus attachments — and the alternative is a
   * dependency whose surface is a hundred times what is used here. Headers
   * are encoded rather than interpolated raw; a subject or filename carrying
   * a newline would otherwise let a caller inject arbitrary headers.
   */
  private buildRawMessage(mail: OutgoingMail): Buffer {
    const boundary = `----prime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    // RFC 2047 for anything non-ASCII, and it neutralises CR/LF at the same
    // time by base64-ing the whole value.
    const header = (value: string) =>
      /^[\x20-\x7E]*$/.test(value)
        ? value
        : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;

    const parts: string[] = [
      `From: ${this.from}`,
      `To: ${mail.to}`,
      ...(mail.replyTo ? [`Reply-To: ${mail.replyTo}`] : []),
      `Subject: ${header(mail.subject)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: ${mail.html ? 'text/html' : 'text/plain'}; charset=UTF-8`,
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(mail.html ?? mail.text, 'utf8').toString('base64'),
    ];

    for (const file of mail.attachments ?? []) {
      parts.push(
        `--${boundary}`,
        `Content-Type: ${file.contentType}; name="${header(file.filename)}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${header(file.filename)}"`,
        '',
        // Wrapped at 76 characters — base64 in a MIME part has a line-length
        // limit, and some receivers reject a single enormous line.
        (file.content.toString('base64').match(/.{1,76}/g) ?? []).join('\r\n'),
      );
    }

    parts.push(`--${boundary}--`, '');
    return Buffer.from(parts.join('\r\n'), 'utf8');
  }
}
