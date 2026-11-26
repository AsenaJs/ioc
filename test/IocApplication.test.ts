import { describe, expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import { Container, ICoreServiceNames, Inject, IocApplication, Service } from '../index';
import { createCapturingLogger, silentLogger } from './utils/silentLogger';

describe('IocApplication', () => {
  test('boots with no component source at all', async () => {
    const app = await IocApplication.create({ logger: silentLogger });

    await app.start();

    expect(await app.resolve<Container>(ICoreServiceNames.CONTAINER)).toBe(app.container);

    await app.stop();
  });

  test('resolves by class under the name the component was registered with', async () => {
    @Service('RenamedLedger')
    class Ledger {}

    const app = await IocApplication.create({ logger: silentLogger, components: [Ledger] });

    expect(await app.resolve(Ledger)).toBe(await app.resolve<Ledger>('RenamedLedger'));
  });

  test.each([
    ICoreServiceNames.CONTAINER,
    ICoreServiceNames.LOGGER,
    ICoreServiceNames.IOC_ENGINE,
    ICoreServiceNames.LIFECYCLE_SERVICE,
  ])("refuses to override the container's own '%s', which is wired before overrides are seeded", async (name) => {
    await expect(IocApplication.create({ logger: silentLogger, overrides: { [name]: {} } })).rejects.toThrow(
      `Cannot override '${name}'`,
    );
  });

  test('hands the engine diagnostics to the given logger', async () => {
    const { logger, entries } = createCapturingLogger();

    await IocApplication.create({ logger, sourceFolder: 'test/fixtures/undecoratedScan' });

    const warned = entries.some(
      (entry) => entry.level === 'warn' && entry.message.includes('ScannedForgottenSubclass'),
    );

    expect(warned).toBe(true);
  });

  test('a component can inject the container itself', async () => {
    @Service()
    class Locator {
      @Inject(ICoreServiceNames.CONTAINER)
      public container: Container;
    }

    const app = await IocApplication.create({ logger: silentLogger, components: [Locator] });

    expect((await app.resolve(Locator)).container).toBe(app.container);
  });

  test('an explicit component list never reads a directory, so it works in a compiled binary and from any working directory', async () => {
    @Service()
    class Offline {}

    const readdir = spyOn(fs, 'readdirSync');

    try {
      const app = await IocApplication.create({ logger: silentLogger, components: [Offline] });

      await app.start();
      await app.stop();

      expect(readdir).not.toHaveBeenCalled();
    } finally {
      readdir.mockRestore();
    }
  });

  test("a relative sourceFolder is read from the working directory, which for an installed CLI is somebody else's project", async () => {
    const readdir = spyOn(fs, 'readdirSync');

    try {
      await IocApplication.create({ logger: silentLogger, sourceFolder: 'test/example-app-structure' });

      expect(readdir.mock.calls[0]?.[0]).toBe('test/example-app-structure');
    } finally {
      readdir.mockRestore();
    }
  });
});
