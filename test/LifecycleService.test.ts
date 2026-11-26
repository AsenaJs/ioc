import { beforeEach, describe, expect, test } from 'bun:test';
import {
  ICoreServiceNames,
  Inject,
  IocApplication,
  LifecycleState,
  OnStart,
  OnStop,
  PostConstruct,
  PostProcessor,
  Service,
  StartHookError,
} from '../index';
import type { IocLogger, LifecycleService } from '../index';
import { createCapturingLogger, silentLogger } from './utils/silentLogger';

const events: string[] = [];

const createApp = (components: any[], logger: IocLogger = silentLogger) =>
  IocApplication.create({ logger, components });

describe('lifecycle hooks', () => {
  beforeEach(() => {
    events.length = 0;
  });

  describe('ordering', () => {
    @Service()
    class Database {
      @OnStart()
      public async open() {
        events.push('database:start');
      }

      @OnStop()
      public async close() {
        events.push('database:stop');
      }
    }

    @Service()
    class Repository {
      @Inject(Database)
      private database: Database;

      @OnStart()
      public async warm() {
        events.push(`repository:start(${this.database ? 'wired' : 'unwired'})`);
      }

      @OnStop()
      public async flush() {
        events.push('repository:stop');
      }
    }

    test('starts dependencies first and stops them last', async () => {
      // Declared dependent-first on purpose: the order that matters is the topological one the
      // IoC engine computes, not the order the components were handed in.
      const app = await createApp([Repository, Database]);

      await app.start();

      expect(events).toEqual(['database:start', 'repository:start(wired)']);

      await app.stop();

      expect(events).toEqual(['database:start', 'repository:start(wired)', 'repository:stop', 'database:stop']);
    });

    test('runs no hook before start()', async () => {
      await createApp([Repository, Database]);

      expect(events).toEqual([]);
    });
  });

  describe('@PostConstruct alias', () => {
    @Service()
    class Legacy {
      @PostConstruct()
      public async init() {
        events.push('legacy:start');
      }
    }

    test('still runs, on the same schedule as @OnStart', async () => {
      const app = await createApp([Legacy]);

      expect(events).toEqual([]);

      await app.start();

      expect(events).toEqual(['legacy:start']);

      await app.stop();
    });
  });

  describe('a start hook that throws', () => {
    @Service()
    class Healthy {
      @OnStart()
      public async open() {
        events.push('healthy:start');
      }

      @OnStop()
      public async close() {
        events.push('healthy:stop');
      }
    }

    @Service()
    class Broken {
      @Inject(Healthy)
      private healthy: Healthy;

      @OnStart()
      public async open() {
        events.push('broken:start');
        throw new Error('cannot reach the thing');
      }

      @OnStop()
      public async close() {
        events.push('broken:stop');
      }
    }

    test('aborts the boot, naming the hook and keeping the cause', async () => {
      const app = await createApp([Healthy, Broken]);

      const start = app.start();

      await expect(start).rejects.toThrow("@OnStart hook 'Broken.open()' failed");
      await expect(start).rejects.toHaveProperty('cause.message', 'cannot reach the thing');
    });

    test('rejects with a StartHookError carrying the component, the hook and the cause', async () => {
      const app = await createApp([Healthy, Broken]);

      const error = await app.start().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StartHookError);
      expect(error).toMatchObject({
        name: 'StartHookError',
        component: 'Broken',
        hook: 'open',
        message: "@OnStart hook 'Broken.open()' failed",
      });
      expect((error as StartHookError).cause).toBeInstanceOf(Error);
      expect(((error as StartHookError).cause as Error).message).toBe('cannot reach the thing');
    });

    test('rejects with a StartHookError for a failing @PostConstruct as well', async () => {
      const cause = new Error('legacy init failed');

      @Service()
      class LegacyBroken {
        @PostConstruct()
        public init() {
          throw cause;
        }
      }

      const app = await createApp([LegacyBroken]);

      const error = await app.start().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StartHookError);
      expect(error).toMatchObject({ component: 'LegacyBroken', hook: 'init' });
      expect((error as StartHookError).cause).toBe(cause);
    });

    test('logs the hook and the cause message', async () => {
      const { logger, entries } = createCapturingLogger();
      const app = await createApp([Healthy, Broken], logger);

      await expect(app.start()).rejects.toThrow();

      const errors = entries.filter((entry) => entry.level === 'error').map((entry) => entry.message);

      expect(errors).toContainEqual(
        expect.stringContaining(
          "failed to start: @OnStart hook 'Broken.open()' failed: cannot reach the thing - rolling back 1",
        ),
      );
    });

    test('rolls back the components that already started', async () => {
      const app = await createApp([Healthy, Broken]);

      await expect(app.start()).rejects.toThrow();

      // Healthy started, so it is stopped. Broken's own @OnStop does not run: its start hook
      // threw, so it never counted as started.
      expect(events).toEqual(['healthy:start', 'broken:start', 'healthy:stop']);
    });

    test('leaves the lifecycle in FAILED', async () => {
      const app = await createApp([Healthy, Broken]);

      await expect(app.start()).rejects.toThrow();

      const lifecycle = await app.resolve<LifecycleService>(ICoreServiceNames.LIFECYCLE_SERVICE);

      expect(lifecycle.state).toBe(LifecycleState.FAILED);
    });

    test('does not run a rolled-back hook again on stop()', async () => {
      const app = await createApp([Healthy, Broken]);

      await expect(app.start()).rejects.toThrow();

      events.length = 0;
      await app.stop();

      expect(events).toEqual([]);
    });
  });

  describe('a stop hook that misbehaves', () => {
    @Service()
    class First {
      @OnStop()
      public async close() {
        events.push('first:stop');
      }
    }

    @Service()
    class Exploding {
      @Inject(First)
      private first: First;

      @OnStop()
      public async close() {
        events.push('exploding:stop');
        throw new Error('nope');
      }
    }

    @Service()
    class Hanging {
      @Inject(Exploding)
      private exploding: Exploding;

      @OnStop()
      public async close() {
        events.push('hanging:stop');

        return new Promise<void>(() => {});
      }
    }

    test('does not stop the rest of the shutdown', async () => {
      const app = await createApp([First, Exploding, Hanging]);

      await app.start();
      events.length = 0;

      await app.stop(50);

      // Every hook was given its turn, in reverse order, despite one throwing and one hanging.
      expect(events).toEqual(['hanging:stop', 'exploding:stop', 'first:stop']);
    });

    // The count is what turns a signal stop into exit 1: stop() itself resolves either way.
    test('stop() reports how many hooks threw, rejected or timed out', async () => {
      const app = await createApp([First, Exploding, Hanging]);
      const lifecycle = await app.resolve<LifecycleService>(ICoreServiceNames.LIFECYCLE_SERVICE);

      await app.start();

      expect(await lifecycle.stop(50)).toBe(2);
      expect(await lifecycle.stop(50)).toBe(0);
    });

    test('stop() reports 0 when every hook finished', async () => {
      const app = await createApp([First]);
      const lifecycle = await app.resolve<LifecycleService>(ICoreServiceNames.LIFECYCLE_SERVICE);

      await app.start();

      expect(await lifecycle.stop()).toBe(0);
    });

    test('logs the cause chain of a failed stop hook', async () => {
      @Service()
      class Wrapping {
        @OnStop()
        public async close() {
          throw new Error('close failed', { cause: new Error('socket gone') });
        }
      }

      const { logger, entries } = createCapturingLogger();
      const app = await createApp([Wrapping], logger);

      await app.start();
      await app.stop();

      const errors = entries.filter((entry) => entry.level === 'error').map((entry) => entry.message);

      expect(errors).toContainEqual(
        expect.stringContaining(
          "@OnStop hook 'Wrapping.close()' failed, continuing shutdown: close failed: socket gone",
        ),
      );
    });

    test('logs a non-Error thrown by a stop hook', async () => {
      @Service()
      class ThrowsString {
        @OnStop()
        public close() {
          throw 'raw string reason';
        }
      }

      const { logger, entries } = createCapturingLogger();
      const app = await createApp([ThrowsString], logger);

      await app.start();
      await app.stop();

      const errors = entries.filter((entry) => entry.level === 'error').map((entry) => entry.message);

      expect(errors).toContainEqual(expect.stringContaining('continuing shutdown: raw string reason'));
    });
  });

  describe('stop() without a successful start', () => {
    @Service()
    class NeverStarted {
      @OnStop()
      public async close() {
        events.push('never-started:stop');
      }
    }

    test('runs nothing when start() was never called', async () => {
      const app = await createApp([NeverStarted]);

      await app.stop();

      expect(events).toEqual([]);
    });

    test('still stops a post-processor, which starts at construction', async () => {
      // The rule is per component, not "nothing runs on an application that never started". A
      // post-processor's start hook fires during the scan - it has to, because postProcess()
      // reads what it sets up - so by the time create() returns it has already acquired
      // whatever it acquires. The otel processor builds its tracer and meter providers there.
      // A boot that fails before start() must still release them.
      @PostProcessor({ name: 'AcquiringProcessor' })
      class AcquiringProcessor {
        public postProcess<T>(instance: T): T {
          return instance;
        }

        @OnStop()
        public release() {
          events.push('postprocessor:stop');
        }
      }

      const app = await createApp([AcquiringProcessor, NeverStarted]);

      await app.stop();

      // The ordinary component never started, so it is not stopped. The post-processor did.
      expect(events).toEqual(['postprocessor:stop']);
    });

    test('is idempotent', async () => {
      const app = await createApp([NeverStarted]);

      await app.start();
      events.length = 0;

      await app.stop();
      await app.stop();

      expect(events).toEqual(['never-started:stop']);
    });

    test('runs concurrent stops as one shutdown', async () => {
      const app = await createApp([NeverStarted]);

      await app.start();
      events.length = 0;

      await Promise.all([app.stop(), app.stop(), app.stop()]);

      expect(events).toEqual(['never-started:stop']);
    });
  });

  describe('state', () => {
    @Service()
    class Plain {}

    test('walks NEW -> STARTED -> STOPPED', async () => {
      const app = await createApp([Plain]);
      const lifecycle = await app.resolve<LifecycleService>(ICoreServiceNames.LIFECYCLE_SERVICE);

      expect(lifecycle.state).toBe(LifecycleState.NEW);

      await app.start();
      expect(lifecycle.state).toBe(LifecycleState.STARTED);

      await app.stop();
      expect(lifecycle.state).toBe(LifecycleState.STOPPED);
    });
  });

  describe('app.resolve()', () => {
    @Service()
    class Resolvable {
      public readonly marker = 'resolved';
    }

    test('reaches a component without going through coreContainer', async () => {
      const app = await createApp([Resolvable]);

      await app.start();

      expect(await app.resolve<Resolvable>('Resolvable')).toHaveProperty('marker', 'resolved');

      await app.stop();
    });
  });
});
