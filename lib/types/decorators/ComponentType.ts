/**
 * The component kinds this package defines itself.
 */
export enum ComponentType {
  COMPONENT = 'COMPONENT',
  SERVICE = 'SERVICE',
  POST_PROCESSOR = 'POST_PROCESSOR',
}

/**
 * What marks a class as one kind of component. The set is open: anything built on the container
 * passes its own strings or symbols to `defineComponent` and reads them back with
 * `Container.resolveAll`.
 */
export type ComponentKind = string | symbol;
