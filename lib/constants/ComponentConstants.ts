/**
 * @description Component constants used in the IOC (Inversion of Control) container.
 * All keys are Symbols to prevent naming collisions and external manipulation.
 *
 * A class with static members so that anything built on the container can extend it and keep
 * its own metadata keys beside these, under one name.
 */
export class ComponentConstants {
  // Component metadata keys - Symbol based for uniqueness
  public static readonly NameKey = Symbol('component:name');

  public static readonly ScopeKey = Symbol('component:scope');

  public static readonly InterfaceKey = Symbol('component:interface');

  public static readonly DependencyKey = Symbol('component:dependency');

  public static readonly DependencyClassKey = Symbol('component:dependencyClass');

  public static readonly SoftDependencyKey = Symbol('component:softDependency');

  public static readonly StrategyKey = Symbol('component:strategy');

  public static readonly ExpressionKey = Symbol('component:expression');

  public static readonly ValueKey = Symbol('component:value');

  // Start hooks. The key keeps the old name because @PostConstruct is still a supported alias
  // for @OnStart and both must land in the same list.
  public static readonly PostConstructKey = Symbol('component:postConstruct');

  public static readonly OnStopKey = Symbol('component:onStop');

  public static readonly IOCObjectKey = Symbol('component:iocObject');
}
