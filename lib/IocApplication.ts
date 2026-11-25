import { Container } from './Container';
import { IocEngine } from './IocEngine';
import { ComponentConstants } from './constants';
import { LifecycleService } from './lifecycle';
import type { LifecycleState } from './lifecycle';
import type { IocLogger } from './logger';
import { type Class, ICoreServiceNames, type InjectableComponent } from './types';
import { getTypedMetadata } from './utils/typedMetadata';

/**
 * Options for {@link IocApplication.create}.
 *
 * A non-empty `components` list wins and disables the scan, otherwise `sourceFolder` is
 * scanned. `imports` is always added on top of whichever one applied.
 */
export interface IocApplicationOptions {
  /** Explicit component classes. When non-empty, `sourceFolder` is not scanned. */
  components?: Class[];

  /**
   * Components handed in by packages, in addition to `components` or the scan. Every entry
   * must carry its own component decorator; the list is flattened one level.
   */
  imports?: (Class | readonly Class[])[];

  /**
   * Folder scanned for decorated classes. A relative path is resolved against the working
   * directory, so a program that can be started from anywhere has to pass an absolute one.
   */
  sourceFolder?: string;

  /**
   * Entry file to keep out of the scan. The running module (`Bun.main`) is always excluded,
   * so this is only needed when the declared entry differs from the file being executed.
   */
  rootFile?: string;

  /** Milliseconds a scanned file may take to import before a warning is logged. 0 disables. */
  importTimeout?: number;

  /** Receives the engine's diagnostics. Defaults to the console, without debug output. */
  logger?: IocLogger;

  /**
   * Values built outside the container, keyed by the name components inject them under:
   * `@Inject('Environment')`. Any value except `null` and `undefined`. They are registered
   * before the components, take no part in the start/stop lifecycle, and a component that
   * claims the same name is an error.
   */
  instances?: Record<string, unknown>;

  /**
   * Test doubles keyed by name, seeded before anything else. The component registered under
   * that name is never constructed, and an entry of `instances` under it is ignored.
   */
  overrides?: Record<string, object>;
}

const consoleLogger: IocLogger = {
  info: (message, meta) => (meta === undefined ? console.info(message) : console.info(message, meta)),
  warn: (message, meta) => (meta === undefined ? console.warn(message) : console.warn(message, meta)),
  error: (message, meta) => (meta === undefined ? console.error(message) : console.error(message, meta)),
};

/**
 * The IoC container wired up on its own: container, engine and lifecycle.
 *
 * `create()` registers and constructs every component. Start hooks are deferred until
 * {@link IocApplication.start}, so a hook always sees the finished graph; `stop()` runs the
 * stop hooks in reverse order.
 */
export class IocApplication {
  private constructor(
    private readonly _container: Container,
    private readonly engine: IocEngine,
    private readonly lifecycle: LifecycleService,
  ) {}

  /**
   * Build the container and register every component.
   *
   * @param {IocApplicationOptions} options - Component sources, logger, instances and overrides
   * @returns {Promise<IocApplication>} The application, constructed but not started
   */
  public static async create(options: IocApplicationOptions = {}): Promise<IocApplication> {
    const { components, imports, sourceFolder, rootFile, importTimeout, instances, overrides } = options;
    const container = new Container();

    await container.registerInstance(ICoreServiceNames.CONTAINER, container);
    await container.registerInstance(ICoreServiceNames.LOGGER, options.logger ?? consoleLogger);
    await container.register(ICoreServiceNames.IOC_ENGINE, IocEngine, true);
    await container.register(ICoreServiceNames.LIFECYCLE_SERVICE, LifecycleService, true);

    const engine = (await container.resolve<IocEngine>(ICoreServiceNames.IOC_ENGINE)) as IocEngine;
    const lifecycle = (await container.resolve<LifecycleService>(
      ICoreServiceNames.LIFECYCLE_SERVICE,
    )) as LifecycleService;

    for (const [name, instance] of Object.entries(overrides ?? {})) {
      if (container.has(name)) {
        throw new Error(
          `Cannot override '${name}' - it is one of the container's own services and has already ` + 'been wired.',
        );
      }

      container.overrideInstance(name, instance);
    }

    for (const [name, instance] of Object.entries(instances ?? {})) {
      if (container.isOverridden(name)) {
        continue;
      }

      if (container.has(name)) {
        throw new Error(
          `Cannot register instance '${name}' - the name belongs to one of the container's own services.`,
        );
      }

      await container.registerInstance(name, instance);
    }

    if (sourceFolder) {
      engine.setConfig({ sourceFolder, rootFile, importTimeout });
    }

    const importClasses = imports?.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]));

    if (components?.length) {
      const injectables: InjectableComponent[] = components.map((component) => ({
        Class: component,
        interface: getTypedMetadata<string>(ComponentConstants.InterfaceKey, component),
      }));

      await engine.searchAndRegister(injectables, importClasses);
    } else if (sourceFolder || importClasses?.length) {
      await engine.searchAndRegister(undefined, importClasses);
    }

    return new IocApplication(container, engine, lifecycle);
  }

  /**
   * Resolve a component by name or by class.
   *
   * @param {string | Class<T>} key - Component name, or the decorated class
   * @returns {Promise<T>} The component
   */
  public async resolve<T>(key: string | Class<T>): Promise<T> {
    const name = typeof key === 'string' ? key : getTypedMetadata<string>(ComponentConstants.NameKey, key) || key.name;

    return (await this._container.resolve<T>(name)) as T;
  }

  /**
   * Run every pending start hook, dependencies first.
   *
   * @returns {Promise<void>}
   * @throws When a hook fails, after rolling back the components that already started
   */
  public async start(): Promise<void> {
    this.engine.warnAboutLateEntryComponents();

    await this.lifecycle.start();
  }

  /**
   * Run stop hooks for everything that started, in reverse order.
   *
   * @param {number} hookTimeout - Per-hook ceiling in milliseconds
   * @returns {Promise<number>} How many hooks threw, rejected or ran out of time
   */
  public async stop(hookTimeout?: number): Promise<number> {
    return this.lifecycle.stop(hookTimeout);
  }

  public get container(): Container {
    return this._container;
  }

  public get state(): LifecycleState {
    return this.lifecycle.state;
  }
}
