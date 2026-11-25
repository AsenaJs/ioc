import { ComponentConstants } from '../../constants';
import { defineTypedMetadata, getOwnTypedMetadata } from '../../utils/typedMetadata';
import { assertLegacyDecorator } from './legacyDecorator';

/**
 * A decorator that marks a method to be called when the application starts.
 *
 * Runs during `start()`, after every component has been constructed and wired, so a hook
 * sees the finished graph.
 *
 * Hooks run in registration order, which is the topological order the IoC engine computed:
 * a component's dependencies have already started when its own hook runs. A throwing hook
 * aborts the start and rolls back the components that already started.
 *
 * The hook must return. A component that runs for the process's lifetime should start its
 * loop here and keep the handle for {@link OnStop} - an `@OnStart` that never resolves is an
 * application that never finishes starting.
 *
 * Only singletons take part; a transient is constructed per resolve and has no lifecycle to
 * hang a start hook on.
 *
 * @returns {PropertyDecorator} The property decorator function.
 */
export const OnStart = (): PropertyDecorator => {
  return (target: object, propertyKey: string): void => {
    assertLegacyDecorator('OnStart', propertyKey);

    const hooks: string[] =
      getOwnTypedMetadata<string[]>(ComponentConstants.PostConstructKey, target.constructor) || [];

    if (!hooks.includes(propertyKey)) {
      hooks.push(propertyKey);
    }

    defineTypedMetadata<string[]>(ComponentConstants.PostConstructKey, hooks, target.constructor);
  };
};
