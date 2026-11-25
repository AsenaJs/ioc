import { Component, Inject } from '../../../index';
import type { ExportedTestService } from '../service/ExportedTestService.test';

@Component({ name: 'ExportedTestConsumer' })
export class ExportedTestConsumer {
  @Inject('ExportedTestService')
  private testService: ExportedTestService;

  public getData(): string {
    return this.testService.getValue();
  }
}
