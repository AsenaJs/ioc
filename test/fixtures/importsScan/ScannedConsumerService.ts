import { Inject, Service } from '../../../index';

/**
 * Injects a component that never appears in this folder: it only exists when the
 * caller hands it in through `imports`, so a resolving `greet()` proves the two
 * sources were merged into one graph.
 */
@Service()
export class ScannedConsumerService {
  @Inject('ImportedGreetingService')
  private greetingService: { greet: () => string };

  public greet(): string {
    return this.greetingService.greet();
  }
}
