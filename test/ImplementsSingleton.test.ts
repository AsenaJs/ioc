import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  ComponentType,
  Container,
  Implements,
  Inject,
  IocApplication,
  IocEngine,
  OnStart,
  OnStop,
  Scope,
  Service,
  Strategy,
} from '../index';

const createLogger = (warnings: string[] = []) => ({
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock((message: string) => {
    warnings.push(String(message));
  }),
});

const engineWithContainer = () => {
  const engine = new IocEngine();

  // IocEngine is a core service - its container normally arrives via DI
  (engine as any)['_container'] = new Container();

  return engine;
};

/**
 * `@Implements` registers a component under its name and its interface key. Both keys used to get
 * their own `Container.register()` call, and each call constructs a singleton - so the component
 * was built twice, its @OnStart and @OnStop ran twice, `@Inject` and `@Strategy` held different
 * objects, and every component scan (`resolveAll`) found it twice. The interface key is now an
 * alias of the name's entry: one instance, one lifecycle, one scan hit.
 */
describe('@Implements singleton', () => {
  let running: IocApplication | undefined;

  afterEach(async () => {
    await running?.stop();
    running = undefined;
  });

  const boot = async (components: any[], logger = createLogger()) => {
    running = await IocApplication.create({
      logger: logger as any,
      components,
    });

    await running.start();

    return running;
  };

  test('is constructed once and shared by its name and its interface key', async () => {
    let constructed = 0;
    let started = 0;
    let stopped = 0;

    @Service()
    @Implements('IMailer')
    class SmtpMailer {
      public constructor() {
        constructed++;
      }

      @OnStart()
      public start() {
        started++;
      }

      @OnStop()
      public stop() {
        stopped++;
      }
    }

    @Service()
    class Notifier {
      @Inject(SmtpMailer)
      public byName: SmtpMailer;

      @Inject('IMailer')
      public byInterface: SmtpMailer;

      @Strategy('IMailer')
      public all: SmtpMailer[];
    }

    const app = await boot([SmtpMailer, Notifier]);
    const notifier = await app.resolve<Notifier>('Notifier');

    expect(constructed).toBe(1);
    expect(started).toBe(1);
    expect(notifier.byInterface).toBe(notifier.byName);
    expect(notifier.all).toHaveLength(1);
    expect(notifier.all[0]).toBe(notifier.byName);

    await app.stop();
    running = undefined;

    expect(stopped).toBe(1);
  });

  test('keeps one instance per implementation when several share an interface key', async () => {
    const constructed: string[] = [];

    @Service()
    @Implements('IChannel')
    class EmailChannel {
      public constructor() {
        constructed.push('email');
      }
    }

    @Service()
    @Implements('IChannel')
    class SmsChannel {
      public constructor() {
        constructed.push('sms');
      }
    }

    @Service()
    class Broadcaster {
      @Inject(EmailChannel)
      public email: EmailChannel;

      @Inject(SmsChannel)
      public sms: SmsChannel;

      @Strategy('IChannel')
      public channels: unknown[];
    }

    const app = await boot([EmailChannel, SmsChannel, Broadcaster]);
    const broadcaster = await app.resolve<Broadcaster>('Broadcaster');

    expect(constructed.sort()).toEqual(['email', 'sms']);
    expect(broadcaster.channels).toHaveLength(2);
    expect(broadcaster.channels).toContain(broadcaster.email);
    expect(broadcaster.channels).toContain(broadcaster.sms);
  });

  test('stays transient under both keys', async () => {
    @Service({ scope: Scope.PROTOTYPE })
    @Implements('IRequestScratch')
    class RequestScratch {}

    const engine = engineWithContainer();

    await engine.searchAndRegister([{ Class: RequestScratch, interface: 'IRequestScratch' }]);

    const first = await engine.container.resolve('RequestScratch');
    const second = await engine.container.resolve('RequestScratch');
    const viaInterface = await engine.container.resolve('IRequestScratch');

    expect(first).toBeInstanceOf(RequestScratch);
    expect(viaInterface).toBeInstanceOf(RequestScratch);
    expect(first).not.toBe(second);
    expect(viaInterface).not.toBe(first);
    expect(viaInterface).not.toBe(second);
  });

  test('is found once by a component scan', async () => {
    @Service()
    @Implements('IClock')
    class SystemClock {}

    @Service()
    @Implements('IClock')
    class FrozenClock {}

    const engine = engineWithContainer();

    await engine.searchAndRegister([
      { Class: SystemClock, interface: 'IClock' },
      { Class: FrozenClock, interface: 'IClock' },
    ]);

    const scanned = ((await engine.container.resolveAll<object>(ComponentType.SERVICE)) ?? []).flat();

    expect(scanned).toHaveLength(2);
    expect(new Set(scanned.map((instance) => instance.constructor))).toEqual(new Set([SystemClock, FrozenClock]));
  });

  test('puts a double overriding the name under the interface key as well', async () => {
    const constructed: string[] = [];

    @Service()
    @Implements('IMailer')
    class SmtpMailer {
      public constructor() {
        constructed.push('smtp');
      }

      @OnStart()
      public start() {
        constructed.push('smtp.start');
      }
    }

    @Service()
    @Implements('IMailer')
    class SesMailer {}

    @Service()
    class Notifier {
      @Inject(SmtpMailer)
      public smtp: unknown;

      @Inject(SesMailer)
      public ses: unknown;

      @Strategy('IMailer')
      public mailers: unknown[];
    }

    const fake = { send: () => 'fake' };

    running = await IocApplication.create({
      logger: createLogger() as any,
      components: [SmtpMailer, SesMailer, Notifier],
      overrides: { SmtpMailer: fake },
    });

    await running.start();

    const notifier = await running.resolve<Notifier>('Notifier');

    expect(constructed).toEqual([]);
    expect(notifier.smtp).toBe(fake);
    expect(notifier.mailers).toHaveLength(2);
    expect(notifier.mailers).toContain(fake);
    expect(notifier.mailers).toContain(notifier.ses);
  });

  test('gives the interface key a test double without constructing the real class there', async () => {
    let constructed = 0;

    @Service()
    @Implements('IPaymentGateway')
    class StripeGateway {
      public constructor() {
        constructed++;
      }
    }

    const engine = engineWithContainer();
    const double = { charge: () => 'double' };

    engine.container.overrideInstance('IPaymentGateway', double);

    await engine.searchAndRegister([{ Class: StripeGateway, interface: 'IPaymentGateway' }]);

    expect(constructed).toBe(1);
    expect(await engine.container.resolve('IPaymentGateway')).toBe(double);
    expect(await engine.container.resolve('StripeGateway')).toBeInstanceOf(StripeGateway);
  });

  test('is still found by a scan when its name is its interface key', async () => {
    let constructed = 0;

    @Service('IClock')
    @Implements('IClock')
    class SystemClock {
      public constructor() {
        constructed++;
      }
    }

    const engine = engineWithContainer();

    await engine.searchAndRegister([{ Class: SystemClock, interface: 'IClock' }]);

    const scanned = ((await engine.container.resolveAll<object>(ComponentType.SERVICE)) ?? []).flat();

    expect(constructed).toBe(1);
    expect(await engine.container.resolve('IClock')).toBeInstanceOf(SystemClock);
    expect(scanned).toHaveLength(1);
  });
});

/**
 * `@Inject('IPaymentGateway')` names an interface key, which had no node in the dependency graph,
 * so nothing ordered the implementation before its dependent. The boot passed or failed with
 * "'IPaymentGateway' is not registered" depending on the order of the component list.
 */
describe('@Inject by @Implements interface key', () => {
  let running: IocApplication | undefined;

  afterEach(async () => {
    await running?.stop();
    running = undefined;
  });

  @Service()
  @Implements('IPaymentGateway')
  class StripeGateway {}

  @Service()
  class RefundService {
    @Inject('IPaymentGateway')
    public gateway: unknown;
  }

  const boot = async (components: any[], overrides?: Record<string, object>) => {
    running = await IocApplication.create({
      logger: createLogger() as any,
      components,
      overrides,
    });

    await running.start();

    return running;
  };

  test.each([
    ['implementation first', [StripeGateway, RefundService]],
    ['dependent first', [RefundService, StripeGateway]],
  ])('registers the implementation before its dependent (%s)', async (_label, components) => {
    const app = await boot(components);
    const refunds = await app.resolve<RefundService>('RefundService');

    expect(refunds.gateway).toBeInstanceOf(StripeGateway);
    expect(refunds.gateway).toBe(await app.resolve('StripeGateway'));
  });

  test('injects a double overriding the implementation by name', async () => {
    const fake = { charge: () => 'fake' };
    const app = await boot([StripeGateway, RefundService], { StripeGateway: fake });

    expect((await app.resolve<RefundService>('RefundService')).gateway).toBe(fake);
  });

  test('does not treat a component injecting its own interface key as a cycle', async () => {
    @Service()
    @Implements('IPaymentGateway')
    class ChainedGateway {}

    @Service()
    @Implements('IPaymentGateway')
    class FallbackGateway {
      @Inject('IPaymentGateway')
      public others: unknown;
    }

    const app = await boot([FallbackGateway, ChainedGateway]);

    expect(await app.resolve('FallbackGateway')).toBeInstanceOf(FallbackGateway);
  });

  test('does not order the implementations of an overridden interface key', async () => {
    @Service()
    class Ledger {
      @Inject('ILedgerGateway')
      public gateway: unknown;
    }

    @Service()
    @Implements('ILedgerGateway')
    class LedgerGateway {
      @Inject(Ledger)
      public ledger: unknown;
    }

    const fake = { post: () => 'fake' };
    const app = await boot([Ledger, LedgerGateway], { ILedgerGateway: fake });

    expect((await app.resolve<Ledger>('Ledger')).gateway).toBe(fake);
  });
});
