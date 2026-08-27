import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

// Global: the brochure flow needs it today and the lead-notification flow
// will need it next, and neither should have to re-import a module whose
// only job is to hold one stateless client.
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
