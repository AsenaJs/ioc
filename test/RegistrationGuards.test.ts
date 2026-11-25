import { describe, expect, test } from 'bun:test';
import { IocApplication, Service } from '../index';
import { silentLogger } from './utils/silentLogger';

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

describe('an explicit component list that yields no component', () => {
  class PlainOne {}

  class PlainTwo {}

  test('fails at create() instead of booting an empty container', async () => {
    await expect(IocApplication.create({ logger: silentLogger, components: [PlainOne, PlainTwo] })).rejects.toThrow(
      'None of the 2 class(es) passed as components is a component: PlainOne, PlainTwo',
    );
  });

  test('names the second installed copy, the cause that cannot be seen from the source', async () => {
    await expect(IocApplication.create({ logger: silentLogger, components: [PlainOne] })).rejects.toThrow(
      'a class decorated through a second installed copy is not recognised',
    );
  });

  test('still boots when at least one listed class is a component', async () => {
    @Service()
    class Real {}

    const app = await IocApplication.create({ logger: silentLogger, components: [PlainOne, Real] });

    expect(await app.resolve(Real)).toBeInstanceOf(Real);
  });
});
