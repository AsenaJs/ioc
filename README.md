<p width="%100" align="center">
  <img src="https://avatars.githubusercontent.com/u/179836938?s=200&v=4" width="150" align="center"/>
</p>

# @asenajs/ioc

[![Version](https://img.shields.io/npm/v/@asenajs/ioc.svg)](https://github.com/AsenaJs/ioc)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Bun Version](https://img.shields.io/badge/Bun-1.4%2B-blueviolet)](https://bun.sh)

An IoC container for Bun: components declared with decorators, field-based dependency injection,
and a start/stop lifecycle. It knows nothing about what the components are for - a CLI, a worker
and a framework all sit on the same container.

## Installation

```bash
bun add @asenajs/ioc
```

## Requirements

- Bun >= 1.4
- A `tsconfig.json` with `experimentalDecorators` enabled. `emitDecoratorMetadata` is not needed:
  every injection names its dependency explicitly.

Bun 1.4.5 picks the decorator dialect for TypeScript it runs from source from the `tsconfig.json`
in the working directory, not from the one beside the file. Run from anywhere else, the same
source gets standard decorators, and the first `@Inject`, `@Strategy`, `@Value`, `@OnStart` or
`@OnStop` throws an error that says so. Anything started from another directory has to ship built
output (`tsc`, `bun build` or `bun build --compile`), where the decorators are already compiled,
or be started with `bun --tsconfig-override=<path>`.

## Usage

```typescript
import { Inject, IocApplication, OnStart, OnStop, Service } from '@asenajs/ioc';

@Service()
class Database {
  @OnStart()
  public open(): void {}

  @OnStop()
  public close(): void {}
}

@Service()
class UserService {
  @Inject(Database)
  private database: Database;
}

const app = await IocApplication.create({ components: [Database, UserService] });

await app.start();

const users = await app.resolve(UserService);

await app.stop();
```

`create()` constructs every singleton and wires its fields. Their start hooks are held back until
`start()`, so a hook sees the finished graph; `stop()` runs the stop hooks in reverse order.

Three kinds of component run their start hooks at construction instead: a `@PostProcessor`, the
components it depends on, and anything with `Scope.PROTOTYPE`. A prototype-scoped component is
built per resolve and never stopped.

Components are constructed with `new Class()` and no arguments, and their fields are wired after
the constructor returns: an injected field is `undefined` inside the constructor and in a field
initializer. Work that needs a dependency belongs in an `@OnStart` method. A class that takes
constructor arguments is not a component - build it with `new` where it is used.

## Component sources

| Option         | Behaviour                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `components`   | Explicit classes. When non-empty, nothing is scanned and the file system is never touched. A list in which no class is a component fails `create()`. |
| `sourceFolder` | Folder scanned for decorated classes, plus those declared in the entry file above the `create()` call. |
| `imports`      | Always added on top of whichever of the two applied.                                                   |

```typescript
const app = await IocApplication.create({ sourceFolder: 'src' });
```

The scan imports every `.ts`/`.js` file under the folder, so the folder has to exist at runtime
and hold nothing that must not run. A relative `sourceFolder` is resolved against the working
directory.

### Command-line programs

Use `components`. It is the only source that works in every way a CLI is shipped:

| Shipped as                          | `components` | `sourceFolder`                                                            |
| ----------------------------------- | ------------ | ------------------------------------------------------------------------- |
| `tsc` output, installed as a `bin`  | works        | only with an absolute path (`import.meta.dir`); `'src'` is the user's src |
| `bun build` bundle                  | works        | no source files to scan                                                   |
| `bun build --compile` binary        | works        | no source files to scan                                                   |

A CLI started in somebody else's project that scans a relative folder imports *their* files.

```typescript
@Service()
@Implements('Command')
class BuildCommand {
  public command(): Command { ... }
}

@Service()
class Cli {
  @Strategy('Command')
  private commands: { command: () => Command }[];
}

const app = await IocApplication.create({ components: [Cli, BuildCommand] });
```

`--help`, `--version` and a `process.exit()` inside a command end the process before `stop()`
runs. Parse in a `try`/`finally` around `stop()`, and let the parser throw instead of exiting
(`exitOverride()` in commander).

### Names and minification

A component is registered under the name given to its decorator, or under its class name. Minifying
identifiers renames classes, so with `bun build --minify`:

- `@Inject(UserService)` and `app.resolve(UserService)` keep working - the name is read from the
  class, whatever it became.
- `@Inject('UserService')`, `app.resolve('UserService')` and `overrides: { UserService: ... }` only
  work when the component was named explicitly: `@Service('UserService')`.

`--minify-whitespace --minify-syntax` leaves names alone.

## Decorators

| Decorator                     | Purpose                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `@Service()` / `@Component()` | Mark a class as a component. Singleton unless scoped.      |
| `@Inject(ClassOrName)`        | Inject a single dependency into a field.                   |
| `@Implements('Key')`          | Register the component under an interface key as well.     |
| `@Strategy('Key')`            | Inject every implementation of an interface key, as array. |
| `@Value('ENV_NAME', options)` | Inject a value from `process.env`.                         |
| `@OnStart()` / `@OnStop()`    | Lifecycle hooks, run by `start()` and `stop()`.            |
| `@PostProcessor()`            | Inspect or wrap every component after it is constructed.   |

## Pre-built instances

Values that are built outside the container - the environment, a clock, parsed arguments - go in
by name through `instances` and are injected like any component:

```typescript
@Service()
class DeployCommand {
  @Inject('Environment')
  private environment: NodeJS.ProcessEnv;

  @Inject('Now')
  private now: () => number;
}

const app = await IocApplication.create({
  components: [DeployCommand],
  instances: { Environment: process.env, Now: Date.now, Verbose: false },
});
```

- Any value except `null` and `undefined` is accepted: objects, functions, strings, numbers,
  booleans, arrays. An optional value is left out of the record, not registered as `undefined`.
- Instances are registered before the components and are never started or stopped: whoever built
  one owns its lifetime.
- A component that claims the name of an instance, or of one of the container's own services,
  fails `create()`.

## Test doubles

```typescript
const app = await IocApplication.create({
  components: [Database, UserService],
  instances: { Now: Date.now },
  overrides: { Database: fakeDatabase, Now: () => 0 },
});
```

`overrides` replaces whatever is registered under a name. A component under an overridden name is
never constructed, an instance under it is ignored, and every dependent receives the double.
Overrides have to be objects or functions.

## The container's own services

Registered by `IocApplication` under these names and injectable like any component:

| `ICoreServiceNames` | Name                 | What                                     |
| ------------------- | -------------------- | ---------------------------------------- |
| `CONTAINER`         | `'Container'`        | The `Container` itself.                  |
| `LOGGER`            | `'IocLogger'`        | The `logger` option, or the console.     |
| `IOC_ENGINE`        | `'IocEngine'`        | Discovers and registers components.      |
| `LIFECYCLE_SERVICE` | `'LifecycleService'` | Runs the start and stop hooks.           |

## Building on the container

`IocApplication` is one way to wire the pieces; a framework that needs more registers them itself
and drives `Container`, `IocEngine` and `LifecycleService` directly.

- **Component kinds.** `defineComponent(kind, params, extra)` is what `@Service` is made of. The
  kind is any string or symbol, and `container.resolveAll(kind)` returns every component of it. A
  string `params` is the component name; a decorator whose string argument means something else
  passes an object.
- **Metadata keys.** `ComponentConstants` is a class of static symbols, so `class MyConstants
  extends ComponentConstants` keeps a framework's keys beside the container's. The keys are plain
  `Symbol()`s: two installed copies of this package do not see each other's components, so a
  framework re-exporting these decorators should depend on the package as a peer.
- **Core services.** `@CoreService(name)` marks infrastructure that is registered by hand with
  `container.register(name, Class, true)` before the components that inject it.
- **Wrapping decorators.** A decorator that wraps the one `defineComponent` returns in its own
  function must call `skipDeclarationFramesUnder(directory)` once for the directory it lives in,
  or components declared in the entry file are attributed to it and not found.
- **Wording.** `warnAboutLateEntryComponents(bootstrapCall)` and the protected
  `Container.injectedFieldHint` let the framework name its own entry point and test utilities in
  the two messages that would otherwise name `IocApplication`.
