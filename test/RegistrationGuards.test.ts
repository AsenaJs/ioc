import { describe, expect, test } from 'bun:test';
import { IocApplication, Service } from '../index';
import { createCapturingLogger, silentLogger } from './utils/silentLogger';

describe("a component named like one of the container's own services", () => {
  test('is refused when the name is given explicitly', async () => {
    @Service('Container')
    class Impostor {}

    await expect(IocApplication.create({ logger: silentLogger, components: [Impostor] })).rejects.toThrow(
      "Component name 'Container' (class Impostor) is already registered",
    );
  });

  test('is refused when the name comes from the class, which is the easy one to hit by accident', async () => {
    @Service()
    class LifecycleService {}

    await expect(IocApplication.create({ logger: silentLogger, components: [LifecycleService] })).rejects.toThrow(
      "Component name 'LifecycleService' (class LifecycleService) is already registered",
    );
  });
});

describe('an explicit component list with a class that is not a component', () => {
  class PlainOne {}

  class PlainTwo {}

  test('fails at create() instead of booting an empty container', async () => {
    await expect(IocApplication.create({ logger: silentLogger, components: [PlainOne, PlainTwo] })).rejects.toThrow(
      "'PlainOne' is listed in components but carries no component decorator (@Service, @Component, ...).",
    );
  });

  test('names the second installed copy, the cause that cannot be seen from the source', async () => {
    await expect(IocApplication.create({ logger: silentLogger, components: [PlainOne] })).rejects.toThrow(
      'a class decorated through a second installed copy is not recognised',
    );
  });

  test('fails at create() even when the other listed classes are components', async () => {
    @Service()
    class Real {}

    await expect(IocApplication.create({ logger: silentLogger, components: [Real, PlainOne] })).rejects.toThrow(
      "'PlainOne' is listed in components but carries no component decorator",
    );
  });

  test('names the undecorated class instead of dropping it silently', async () => {
    @Service('one')
    class One {}

    class Plain {}

    const { logger, entries } = createCapturingLogger();

    await expect(IocApplication.create({ logger, components: [One, Plain] })).rejects.toThrow(
      "'Plain' is listed in components but carries no component decorator (@Service, @Component, ...).",
    );
    expect(entries).toEqual([]);
  });
});
