import { beforeEach, describe, expect, test } from 'bun:test';
import type { Class, InjectableComponent } from '../index';
import { Container, Implements, Inject, IocEngine, Service, Strategy } from '../index';

/**
 * Injected fields are accessors with no setter, which is a good property - the container owns
 * them. But the engine's own message for that ("Attempted to assign to readonly property.")
 * names neither the field nor the class nor the supported alternative, so the first person to
 * reach for `Object.assign(instance, {dep: double})` in a test spends a run working out what it
 * is telling them.
 */
@Service()
class OutboxWriter {
  public append(): string {
    return 'real';
  }
}

@Service()
class NotificationService {
  @Inject(OutboxWriter)
  private outbox: OutboxWriter;

  public notify(): string {
    return this.outbox.append();
  }
}

@Service()
@Implements('IChannel')
class EmailChannel {}

@Service()
class Broadcaster {
  @Strategy('IChannel')
  private channels: unknown[];

  public count(): number {
    return this.channels.length;
  }
}

describe('assigning to an injected field', () => {
  let engine: IocEngine;

  beforeEach(async () => {
    engine = new IocEngine();
    (engine as any)['_container'] = new Container();

    const classes: Class[] = [OutboxWriter, NotificationService, EmailChannel, Broadcaster];

    await engine.searchAndRegister(classes.map((Class) => ({ Class, interface: null }) as InjectableComponent));
  });

  test('names the field, the class and the way out for @Inject', async () => {
    const service: any = await engine.container.resolve('NotificationService');

    expect(() => Object.assign(service, { outbox: { append: () => 'double' } })).toThrow(
      "Cannot assign to 'outbox' on NotificationService: fields wired by @Inject are read-only.",
    );

    expect(() => Object.assign(service, { outbox: {} })).toThrow(/overrideInstance\(\)/);
    expect(() => Object.assign(service, { outbox: {} })).toThrow(/'overrides' option of IocApplication\.create\(\)/);
  });

  test('lets whatever wraps the container name its own way out', async () => {
    class HarnessContainer extends Container {
      protected override injectedFieldHint = 'Use the harness.';
    }

    const harnessEngine = new IocEngine();

    (harnessEngine as any)['_container'] = new HarnessContainer();

    await harnessEngine.searchAndRegister(
      [OutboxWriter, NotificationService].map((Class) => ({ Class, interface: null })),
    );

    const service: any = await harnessEngine.container.resolve('NotificationService');

    expect(() => Object.assign(service, { outbox: {} })).toThrow(
      "Cannot assign to 'outbox' on NotificationService: fields wired by @Inject are read-only. Use the harness.",
    );
  });

  test('does the same for @Strategy', async () => {
    const broadcaster: any = await engine.container.resolve('Broadcaster');

    expect(() => Object.assign(broadcaster, { channels: [] })).toThrow(
      "Cannot assign to 'channels' on Broadcaster: fields wired by @Strategy are read-only.",
    );
  });

  test('leaves the real dependency in place after a refused assignment', async () => {
    const service: any = await engine.container.resolve('NotificationService');

    expect(() => Object.assign(service, { outbox: { append: () => 'double' } })).toThrow();
    expect(service.notify()).toBe('real');
  });
});
