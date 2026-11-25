import { describe, expect, test } from 'bun:test';
import { ICoreServiceNames, Inject, IocApplication, OnStart, OnStop, Service } from '../index';
import { silentLogger } from './utils/silentLogger';

describe('instances', () => {
  test.each([
    ['zero', 0],
    ['an empty string', ''],
    ['false', false],
    ['an empty array', []],
    ['a non-empty array', ['--verbose']],
    ['a function', () => 'called'],
    ['a plain object', { cwd: '/tmp' }],
    ['an object without a prototype', Object.create(null)],
  ])('injects %s as the very value that was registered', async (_label, value) => {
    @Service()
    class Reader {
      @Inject('Setting')
      public setting: unknown;
    }

    const app = await IocApplication.create({
      logger: silentLogger,
      components: [Reader],
      instances: { Setting: value },
    });

    expect((await app.resolve(Reader)).setting).toBe(value);
    expect(await app.resolve<unknown>('Setting')).toBe(value);
  });

  test('is resolvable when the application has no components at all', async () => {
    const app = await IocApplication.create({ logger: silentLogger, instances: { Retries: 3 } });

    expect(await app.resolve<number>('Retries')).toBe(3);
  });

  test.each([
    ['null', null],
    ['undefined', undefined],
  ])('refuses %s at create(), naming the key, instead of failing at the first resolve', async (label, value) => {
    await expect(IocApplication.create({ logger: silentLogger, instances: { Missing: value } })).rejects.toThrow(
      `Cannot register 'Missing' as ${label}`,
    );
  });

  test('a test double under the same name wins, so a test can swap what production wires', async () => {
    const real = { now: () => 1 };
    const double = { now: () => 2 };

    @Service()
    class Timer {
      @Inject('Clock')
      public clock: { now: () => number };
    }

    const app = await IocApplication.create({
      logger: silentLogger,
      components: [Timer],
      instances: { Clock: real },
      overrides: { Clock: double },
    });

    expect((await app.resolve(Timer)).clock).toBe(double);
  });

  test('a component claiming an instance name is refused before anything is constructed', async () => {
    let constructed = 0;

    @Service('Environment')
    class EnvironmentService {
      public constructor() {
        constructed++;
      }
    }

    @Service()
    class Bystander {
      public constructor() {
        constructed++;
      }
    }

    await expect(
      IocApplication.create({
        logger: silentLogger,
        components: [Bystander, EnvironmentService],
        instances: { Environment: { cwd: '/tmp' } },
      }),
    ).rejects.toThrow("Component name 'Environment' (class EnvironmentService) is already registered");

    expect(constructed).toBe(0);
  });

  test.each([
    ICoreServiceNames.CONTAINER,
    ICoreServiceNames.LOGGER,
    ICoreServiceNames.IOC_ENGINE,
    ICoreServiceNames.LIFECYCLE_SERVICE,
  ])("cannot take the container's own name '%s'", async (name) => {
    await expect(IocApplication.create({ logger: silentLogger, instances: { [name]: {} } })).rejects.toThrow(
      `Cannot register instance '${name}'`,
    );
  });

  test('is never started or stopped: whoever built it owns its lifetime', async () => {
    const calls: string[] = [];

    class Connection {
      @OnStart()
      public open(): void {
        calls.push('open');
      }

      @OnStop()
      public close(): void {
        calls.push('close');
      }
    }

    const app = await IocApplication.create({ logger: silentLogger, instances: { Connection: new Connection() } });

    await app.start();
    await app.stop();

    expect(calls).toEqual([]);
  });
});
