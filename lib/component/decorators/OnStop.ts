import { ComponentConstants } from '../../constants';
import { defineTypedMetadata, getOwnTypedMetadata } from '../../utils/typedMetadata';
import { assertLegacyDecorator } from './legacyDecorator';

/**
 * A decorator that marks a method to be called when the application stops.
 *
 * The counterpart to {@link OnStart}. Runs during `stop()`, in the reverse of start
 * order, so a component still has its dependencies while it releases its own resources.
 *
 * A hook that throws or exceeds the shutdown timeout is logged and skipped - shutdown
 * continues. One component failing to let go must not strand the rest.
 *
 * Only components whose start hook completed are stopped. A `stop()` on an application that
 * never started, or that failed while starting, runs nothing that never ran.
 *
 * @returns {PropertyDecorator} The property decorator function.
 */
export const OnStop = (): PropertyDecorator => {
  return (target: object, propertyKey: string): void => {
    assertLegacyDecorator('OnStop', propertyKey);

    const hooks: string[] = getOwnTypedMetadata<string[]>(ComponentConstants.OnStopKey, target.constructor) || [];

    if (!hooks.includes(propertyKey)) {
      hooks.push(propertyKey);
    }

    defineTypedMetadata<string[]>(ComponentConstants.OnStopKey, hooks, target.constructor);
  };
};
