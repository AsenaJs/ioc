/**
 * @description The names the container's own services are registered under.
 * Components inject them by these names, e.g. `@Inject(ICoreServiceNames.CONTAINER)`.
 */
export enum ICoreServiceNames {
  CONTAINER = 'Container',
  LOGGER = 'IocLogger',
  IOC_ENGINE = 'IocEngine',
  LIFECYCLE_SERVICE = 'LifecycleService',
}
