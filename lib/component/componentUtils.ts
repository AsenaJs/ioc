import type { Class, ComponentKind, ComponentParams, Dependencies, Strategies } from '../types';
import { ComponentConstants } from '../constants';
import { defineTypedMetadata, getOwnTypedMetadata } from '../utils/typedMetadata';
import { Scope } from './Scope';
import { registerDeclaredComponent } from './componentRegistry';

/**
 * Builds the class decorator behind every component decorator, the built-in ones included.
 *
 * A string `params` is the component name. A decorator whose own string argument means something
 * else has to turn it into an object before calling this.
 *
 * A decorator that wraps the returned one in a function of its own puts that function's stack
 * frame where the declaring file is looked for - see `skipDeclarationFramesUnder`.
 *
 * @param {ComponentKind} componentType - The kind to mark the class as, readable through `Container.resolveAll`
 * @param {ComponentParams | string} params - Name and scope, or just the name
 * @param {Function} extra - Runs on the class once it carries its name and scope
 * @returns {ClassDecorator} - The class decorator for the component.
 */
export const defineComponent = <T extends ComponentParams>(
  componentType: ComponentKind,
  params: T | string,
  extra?: (target: Function) => void,
): ClassDecorator => {
  return (target: Function) => {
    const { scope = Scope.SINGLETON, name = target.name } = paramsGenerator(params);

    defineTypedMetadata<boolean>(componentType, true, target);

    defineTypedMetadata<boolean>(ComponentConstants.IOCObjectKey, true, target);

    // Records the declaring file too, so components written directly in the entry
    // file stay discoverable - the scan has to skip that file (see componentRegistry)
    registerDeclaredComponent(target as Class);

    defineTypedMetadata<Scope>(ComponentConstants.ScopeKey, scope, target);

    defineTypedMetadata<string>(ComponentConstants.NameKey, name, target);

    if (extra) {
      extra(target);
    }

    if (getOwnTypedMetadata<Dependencies>(ComponentConstants.DependencyKey, target) === undefined) {
      defineTypedMetadata<Dependencies>(ComponentConstants.DependencyKey, {}, target);
    }

    if (getOwnTypedMetadata<Strategies>(ComponentConstants.StrategyKey, target) === undefined) {
      defineTypedMetadata<Strategies>(ComponentConstants.StrategyKey, {}, target);
    }
  };
};

const paramsGenerator = (params: ComponentParams | string): ComponentParams => {
  const defaultParam: ComponentParams = { name: undefined, scope: undefined };

  return typeof params === 'string' ? { name: params } : params || defaultParam;
};
