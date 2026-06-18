import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class PlatformLogger extends ConsoleLogger {
  constructor() {
    super('NexusBanking');
  }
}
