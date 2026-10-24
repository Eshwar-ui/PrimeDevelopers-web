import { Module } from '@nestjs/common';
import { CspController } from './csp.controller';

@Module({ controllers: [CspController] })
export class CspModule {}
