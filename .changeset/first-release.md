---
'@asenajs/ioc': minor
---

First release: the AsenaJS IoC container as a package of its own.

- `IocApplication.create()` wires the container, the engine and the lifecycle; `resolve()`, `start()` and `stop()` drive it
- components from an explicit `components` list, a scanned `sourceFolder`, or `imports`
- `@Service`, `@Component`, `@Inject`, `@Implements`, `@Strategy`, `@Value`, `@OnStart`, `@OnStop`, `@PostProcessor`
- `instances` registers values built outside the container by name; `overrides` seeds test doubles
- `defineComponent` with open component kinds, for frameworks that build their own decorators on the container
