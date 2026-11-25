/**
 * Fail with an explanation when a field or method decorator of this package is applied as a
 * standard (TC39) decorator.
 *
 * In that dialect the second argument is a context object instead of the member name, and the
 * first is `undefined` for a field and the function itself for a method. A field decorator then
 * dies on `target.constructor`, and a method decorator writes its metadata onto `Function` and
 * the hook is silently never run.
 *
 * @param {string} decorator - The decorator's name, for the message
 * @param {unknown} propertyKey - The second argument the decorator was called with
 * @returns {void}
 * @throws When the decorator was called with a decorator context
 */
export const assertLegacyDecorator = (decorator: string, propertyKey: unknown): void => {
  if (typeof propertyKey !== 'object' || propertyKey === null || !('kind' in propertyKey)) {
    return;
  }

  throw new Error(
    `@${decorator} was applied as a standard (TC39) decorator, but @asenajs/ioc needs legacy decorators: ` +
      'set "experimentalDecorators": true in tsconfig.json. Bun takes that setting from the tsconfig.json ' +
      'of the working directory when it runs TypeScript from source, so a program started from another ' +
      'directory has to ship built output or be started with --tsconfig-override.',
  );
};
