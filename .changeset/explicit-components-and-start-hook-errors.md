---
'@asenajs/ioc': minor
---

Clearer answers from the container at three edges.

- `Container.resolveAll(kind)` returns an empty array when no component has that kind
- a failing `@OnStart` (or `@PostConstruct`) hook throws an exported `StartHookError`; its `component` and `hook` fields name the failing method and `cause` holds the original error
- `IocApplication.create()` fails when a class listed in `components` carries no component decorator, naming the class; a scanned `sourceFolder` skips undecorated classes
