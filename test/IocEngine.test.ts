import { beforeEach, describe, expect, test } from 'bun:test';
import type { InjectableComponent } from '../index';
import { Component, Container, Inject, IocEngine, Scope } from '../index';
import { ExportedTestService } from './example-app-structure/service/ExportedTestService.test';
import { ExportedTestConsumer } from './example-app-structure/consumer/ExportedTestConsumer.test';

@Component({
  name: 'TestService',
  scope: Scope.SINGLETON,
})
class TestService {
  public getValue(): string {
    return 'test';
  }
}

@Component({
  name: 'TestConsumer',
  scope: Scope.SINGLETON,
})
class TestConsumer {
  @Inject(TestService)
  private testService: TestService;

  public getData(): string {
    return this.testService.getValue();
  }
}

@Component({
  name: 'TestService2',
  scope: Scope.SINGLETON,
})
class TestService2 extends TestService {
  public getValue(): string {
    return 'test';
  }
}

describe('IocEngine', () => {
  let iocEngine: IocEngine;

  beforeEach(() => {
    iocEngine = new IocEngine();
    // Manually inject container for testing (IocEngine is now a core service)
    (iocEngine as any)['_container'] = new Container();
  });

  test('should create instance', () => {
    expect(iocEngine).toBeDefined();
    expect(iocEngine.container).toBeDefined();
  });

  test('should register components manually', async () => {
    const components: InjectableComponent[] = [
      { Class: TestService, interface: null },
      { Class: TestConsumer, interface: null },
    ];

    await iocEngine.searchAndRegister(components);

    const testService = await iocEngine.container.resolve<TestService>(TestService.name);
    const testConsumer = await iocEngine.container.resolve<TestConsumer>(TestConsumer.name);

    expect(testService).toBeInstanceOf(TestService);
    expect(testConsumer).toBeInstanceOf(TestConsumer);
    expect((testConsumer as TestConsumer).getData()).toBe('test');
  });

  test('should register components automatically', async () => {
    iocEngine = new IocEngine();
    (iocEngine as any)['_container'] = new Container();
    iocEngine.setConfig({ sourceFolder: 'test/example-app-structure', rootFile: '' });
    await iocEngine.searchAndRegister();

    const testService = await iocEngine.container.resolve<ExportedTestService>('ExportedTestService');

    const testConsumer = await iocEngine.container.resolve<ExportedTestConsumer>('ExportedTestConsumer');

    expect(testService).toBeInstanceOf(ExportedTestService);
    expect(testConsumer).toBeInstanceOf(ExportedTestConsumer);
    expect((testConsumer as ExportedTestConsumer).getData()).toBe('test');
  });

  test('should throw error when no components provided', async () => {
    try {
      await iocEngine.searchAndRegister();
      expect(true).toBe(false);
    } catch (error) {
      expect(error.message).toBe('No components or configuration found');
    }
  });

  test('should register dependencies correct when extending class', async () => {
    const components: InjectableComponent[] = [
      { Class: TestService2, interface: null },
      { Class: TestConsumer, interface: null },
      { Class: TestService, interface: null },
    ];

    await iocEngine.searchAndRegister(components);

    const testService = await iocEngine.container.resolve<TestService>(TestService.name);
    const testService2 = await iocEngine.container.resolve<TestService2>(TestService2.name);

    expect(testService).toBeInstanceOf(TestService);
    expect(testService2).toBeInstanceOf(TestService2);

    expect((testService2 as TestService2).getValue()).toBe('test');
  });

  test('a late component is reported against the bootstrap call the developer actually wrote, which only the caller knows', () => {
    const warnings: string[] = [];

    (iocEngine as any)['logger'] = { warn: (message: string) => warnings.push(message) };
    (iocEngine as any)['entryFiles'] = new Set([import.meta.path]);

    @Component()
    class DeclaredTooLate {}

    iocEngine.warnAboutLateEntryComponents('Framework.boot()');
    iocEngine.warnAboutLateEntryComponents();

    expect(warnings[0]).toContain('declared after the Framework.boot() call were not registered');
    expect(warnings[0]).toContain('DeclaredTooLate');
    expect(warnings[1]).toContain('declared after the IocApplication.create() call');
  });
});
