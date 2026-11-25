import { defineComponent } from '../../../index';

/**
 * A framework-style decorator that does its own work before handing over: the returned
 * function is a frame of this file, sitting between `defineComponent` and the decorated class.
 */
export const Guarded = (name: string): ClassDecorator => {
  const decorate = defineComponent('GUARDED', { name });

  return (target) => {
    if (!name) {
      throw new Error(`@Guarded on ${target.name}: a name is required`);
    }

    decorate(target);
  };
};
