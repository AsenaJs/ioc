import { describe, expect, test } from 'bun:test';
import { Container, defineComponent, Implements, Inject, IocApplication, IocEngine, Service, Strategy } from '../index';

/**
 * Component *identity* - what a class is, what it is called, what scope it has - is read
 * own-only. Behaviour is inherited; identity is not.
 *
 * Reading it off the chain produced two distinct failures, both silent for a while:
 *
 * 1. An undecorated subclass of a component was itself treated as a component, and since
 *    NameKey was also read off the chain it registered under its *base's* name. Container
 *    promotes a duplicate key to an array, so every `@Inject(Base)` started handing out
 *    `[Base, Sub]` and the first property access failed far from the cause.
 * 2. A @Service extending a component of another kind answered true for that kind, so
 *    `resolveAll` handed it out as one - without the own-only metadata that kind is built on.
 */

/**
 * A kind this package knows nothing about, and a symbol rather than a string: whatever is built
 * on the container defines its own kinds, and `resolveAll` has to answer for those too.
 */
const HANDLER = Symbol('handler');

const engineWith = (components: any[]) => {
  const engine = new IocEngine();
  const warnings: string[] = [];

  (engine as any)['_container'] = new Container();
  (engine as any)['logger'] = {
    info: () => {},
    warn: (message: string) => warnings.push(message),
    error: () => {},
  };

  return {
    engine,
    warnings,
    register: () => engine.searchAndRegister(components.map((Class) => ({ Class, interface: null }))),
  };
};

describe('component identity is own-only', () => {
  test('an undecorated subclass is not a component', async () => {
    @Service('BaseRepo')
    class BaseRepo {
      public find() {
        return 'base';
      }
    }

    // The decorator was simply forgotten - a very ordinary mistake
    class UserRepo extends BaseRepo {}

    const { engine, register } = engineWith([BaseRepo, UserRepo]);

    await register();

    const resolved = await engine.container.resolve('BaseRepo');

    // Not an array. Under the chained read both classes registered as 'BaseRepo' and this
    // returned [BaseRepo, UserRepo], so `repo.find(...)` threw "find is not a function".
    expect(Array.isArray(resolved)).toBe(false);
    // Identity, not membership: a UserRepo instance is also `instanceof BaseRepo`, so the
    // last-write-wins form of the bug would read identical to the correct answer.
    expect((resolved as any).constructor).toBe(BaseRepo);
  });

  test('the injected dependency stays a single instance', async () => {
    @Service('SharedService')
    class SharedService {
      public value = 'shared';
    }

    class UndecoratedChild extends SharedService {}

    @Service('Consumer')
    class Consumer {
      @Inject('SharedService')
      public shared!: SharedService;
    }

    const { engine, register } = engineWith([SharedService, UndecoratedChild, Consumer]);

    await register();

    const consumer: any = await engine.container.resolve('Consumer');

    expect(Array.isArray(consumer.shared)).toBe(false);
    expect(consumer.shared.value).toBe('shared');
  });

  test('a decorated subclass is still registered under its own name', async () => {
    @Service('ParentService')
    class ParentService {}

    @Service('ChildService')
    class ChildService extends ParentService {}

    const { engine, register } = engineWith([ParentService, ChildService]);

    await register();

    // Identity, not membership: a ChildService instance is also `instanceof ParentService`, so
    // toBeInstanceOf(ParentService) passes for both the right and the wrong answer.
    expect((await engine.container.resolve('ParentService')).constructor).toBe(ParentService);
    expect((await engine.container.resolve('ChildService')).constructor).toBe(ChildService);
  });

  test('the container resolves component types own-only too', async () => {
    @defineComponent(HANDLER, {})
    class RealHandler {
      public ping() {
        return 'pong';
      }
    }

    @Service('NotAHandler')
    class NotAHandler extends RealHandler {}

    const container = new Container();

    await container.register('RealHandler', RealHandler, true);
    await container.register('NotAHandler', NotAHandler, true);

    const handlers = await container.resolveAll(HANDLER);

    expect(handlers).toHaveLength(1);
    expect((handlers[0] as any).constructor).toBe(RealHandler);
  });

  test('a string param is the component name whatever the kind', async () => {
    /**
     * A decorator whose string argument means something else - a path, a topic - turns it into
     * an object before calling defineComponent. If the package guessed per kind instead, a kind
     * it has never heard of would have no way to say which reading it wants.
     */
    @defineComponent(HANDLER, 'NamedHandler')
    class AnyClassName {}

    const { engine, register } = engineWith([AnyClassName]);

    await register();

    expect(engine.container.has('NamedHandler')).toBe(true);
    expect(engine.container.has('AnyClassName')).toBe(false);
  });

  // Skipping the class silently is what the originating report explicitly asked us not to do:
  // a component that is simply never registered does nothing, and nothing anywhere says so.
  test('warns, naming both classes, when a subclass is missing its decorator', async () => {
    @Service('AnnouncedBase')
    class AnnouncedBase {}

    class ForgottenSubclass extends AnnouncedBase {}

    const { warnings, register } = engineWith([AnnouncedBase, ForgottenSubclass]);

    await register();

    const warning = warnings.find((message) => message.includes('ForgottenSubclass'));

    expect(warning).toBeString();
    expect(warning).toContain('AnnouncedBase');
    expect(warning).toContain('NOT registered');
  });

  test('stays quiet for an undecorated class that extends nothing', async () => {
    @Service('QuietService')
    class QuietService {}

    class PlainHelper {}

    const { warnings, register } = engineWith([QuietService, PlainHelper]);

    await register();

    // An ordinary helper in the scan folder is not a mistake and must not be reported.
    expect(warnings.filter((message) => message.includes('carries no decorator'))).toEqual([]);
  });

  test('a decorated chain still registers each level', async () => {
    @Service('Alpha')
    class Alpha {}

    @Service('Beta')
    class Beta extends Alpha {}

    const { engine, register } = engineWith([Alpha, Beta]);

    await register();

    expect((await engine.container.resolve('Alpha')).constructor).toBe(Alpha);
    expect((await engine.container.resolve('Beta')).constructor).toBe(Beta);
  });
});

/**
 * `@Implements` is the deliberate exception to "identity belongs to the concrete class", and
 * nothing covered it - which is what makes it worth pinning.
 *
 * The rule is about *unique* identity: a name, a path, a component-type marker. A second entry
 * under any of those is by definition a collision, which is why they are read own-only. An
 * interface key is the opposite - it is multi-valued on purpose. `@Implements` is the producer
 * half of the strategy mechanism and `@Strategy` is the consumer half, so several classes under
 * one key is the mechanism working, not a collision. Inheriting it also matches Java/Spring,
 * where a subclass genuinely is an instance of its base's interfaces.
 *
 * `IocEngine` therefore reads `InterfaceKey` with the chained `getTypedMetadata`. Applying the
 * own-only rule uniformly across that file - the obvious "consistency fix" - would silently
 * shrink every strategy list that relies on inheritance, with nothing else in the suite to
 * notice.
 */
describe('@Implements is inherited, deliberately', () => {
  test('a decorated subclass joins its base class interface registration', async () => {
    @Implements('IGateway')
    @Service('StripeGateway')
    class StripeGateway {
      public charge() {
        return 'stripe';
      }
    }

    // No @Implements of its own - it inherits the interface along with the behaviour.
    @Service('SandboxGateway')
    class SandboxGateway extends StripeGateway {
      public override charge() {
        return 'sandbox';
      }
    }

    const { engine, register } = engineWith([StripeGateway, SandboxGateway]);

    await register();

    const resolved: any = await engine.container.resolve('IGateway');

    expect(Array.isArray(resolved)).toBe(true);
    expect(resolved.map((entry: any) => entry.constructor)).toEqual([StripeGateway, SandboxGateway]);
  });

  test('a @Strategy consumer receives the inherited implementation', async () => {
    @Implements('IClock')
    @Service('SystemClock')
    class SystemClock {
      public now() {
        return 'system';
      }
    }

    @Service('FrozenClock')
    class FrozenClock extends SystemClock {
      public override now() {
        return 'frozen';
      }
    }

    @Service('ClockConsumer')
    class ClockConsumer {
      @Strategy('IClock')
      public clocks: SystemClock[];
    }

    // Through the factory rather than the engineWith helper: the ordering half of the mechanism
    // runs off `InjectableComponent.interface`, which only the real entry points populate
    // (IocApplication reads InterfaceKey off the class, chained, exactly like the scan).
    // The helper hard-codes `interface: null`, so it can register the implementations but never
    // order them before their consumer.
    const logger: any = { info: () => {}, warn: () => {}, error: () => {} };
    const app = await IocApplication.create({
      logger,
      components: [SystemClock, FrozenClock, ClockConsumer],
    });

    await app.start();

    const consumer: any = await app.resolve('ClockConsumer');

    // The end the mechanism exists for: both implementations reach the strategy array.
    expect(consumer.clocks.map((clock: any) => clock.now()).sort()).toEqual(['frozen', 'system']);
  });

  test('the same holds through IocApplication, which reads InterfaceKey itself', async () => {
    @Implements('ISerializer')
    @Service('JsonSerializer')
    class JsonSerializer {
      public format() {
        return 'json';
      }
    }

    @Service('PrettyJsonSerializer')
    class PrettyJsonSerializer extends JsonSerializer {
      public override format() {
        return 'pretty-json';
      }
    }

    const logger: any = { info: () => {}, warn: () => {}, error: () => {} };
    const app = await IocApplication.create({
      logger,
      components: [JsonSerializer, PrettyJsonSerializer],
    });

    await app.start();

    const resolved: any = await app.resolve('ISerializer');

    expect(Array.isArray(resolved)).toBe(true);
    expect(resolved.map((entry: any) => entry.format()).sort()).toEqual(['json', 'pretty-json']);
  });
});
