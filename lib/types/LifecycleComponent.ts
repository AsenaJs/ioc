import type { Class } from './Class';

/**
 * Whether the container runs start hooks during construction or hands them to LifecycleService.
 *
 * @see Container.setStartHookMode
 */
export type StartHookMode = 'immediate' | 'deferred';

/**
 * A singleton taking part in the start/stop lifecycle.
 *
 * Recorded in registration order, which the IoC engine topologically sorted, so walking the
 * list forwards starts dependencies before dependents and walking it backwards stops dependents
 * before the dependencies they still need.
 */
export interface LifecycleComponent {
  /** The key it was registered under - used to name the component in logs. */
  key: string;
  /** The post-processed instance, i.e. the one every dependent was injected with. */
  instance: any;
  Class: Class;
  /**
   * Its start hooks have completed.
   *
   * The gate for stopping: a component that never started has nothing to unwind, and a
   * `stop()` on an application that failed halfway through its start must not call stop hooks for the
   * components that never got their turn.
   */
  started: boolean;
}
