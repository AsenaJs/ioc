# @asenajs/ioc

## 0.2.0

### Minor Changes

- 3d82730: Clearer answers from the container at three edges.

  - `Container.resolveAll(kind)` returns an empty array when no component has that kind
  - a failing `@OnStart` (or `@PostConstruct`) hook throws an exported `StartHookError`; its `component` and `hook` fields name the failing method and `cause` holds the original error
  - `IocApplication.create()` fails when a class listed in `components` carries no component decorator, naming the class; a scanned `sourceFolder` skips undecorated classes

## 0.1.0

### Minor Changes

- 2432f81: First release: the AsenaJS IoC container as a package of its own.

  - `IocApplication.create()` wires the container, the engine and the lifecycle; `resolve()`, `start()` and `stop()` drive it
  - components from an explicit `components` list, a scanned `sourceFolder`, or `imports`
  - `@Service`, `@Component`, `@Inject`, `@Implements`, `@Strategy`, `@Value`, `@OnStart`, `@OnStop`, `@PostProcessor`
  - `instances` registers values built outside the container by name; `overrides` seeds test doubles
  - `defineComponent` with open component kinds, for frameworks that build their own decorators on the container
