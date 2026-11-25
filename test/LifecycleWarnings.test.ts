import { beforeEach, describe, expect, test } from 'bun:test';
import { IocApplication, OnStop, Scope, Service } from '../index';
import { silentLogger } from './utils/silentLogger';

const warnings: string[] = [];

const capturingLogger = {
  ...silentLogger,
  warn: (message: string) => {
    warnings.push(message);
  },
};

const createApp = (components: any[]) =>
  IocApplication.create({
    logger: capturingLogger as any,
    components,
  });

describe('lifecycle warnings', () => {
  beforeEach(() => {
    warnings.length = 0;
  });

  test('a transient with @OnStop is called out at boot', async () => {
    @Service({ scope: Scope.PROTOTYPE })
    class PerResolveWorker {
      @OnStop()
      public async close() {}
    }

    await createApp([PerResolveWorker]);

    const warning = warnings.find((message) => message.includes('PerResolveWorker'));

    expect(warning).toContain('transient');
    expect(warning).toContain('@OnStop');
    expect(warning).toContain('never');
  });

  test('a singleton with @OnStop is not', async () => {
    @Service()
    class SingletonWorker {
      @OnStop()
      public async close() {}
    }

    await createApp([SingletonWorker]);

    expect(warnings.filter((message) => message.includes('SingletonWorker'))).toEqual([]);
  });
});
