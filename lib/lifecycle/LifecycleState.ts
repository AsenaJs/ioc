/**
 * @description Where the application is in its start/stop cycle.
 *
 * Runtime state: it goes back and forth, anything reporting readiness reads it, and `stop()`
 * uses it to decide what may be torn down.
 */
export enum LifecycleState {
  /** Constructed, `start()` not called yet. */
  NEW = 'NEW',
  /** Inside `start()` - start hooks are running. */
  STARTING = 'STARTING',
  /** Every start hook completed; the application is running. */
  STARTED = 'STARTED',
  /** Inside `stop()` - already draining, so no longer ready for work. */
  STOPPING = 'STOPPING',
  /** Stopped. Stop hooks have run for everything that started. */
  STOPPED = 'STOPPED',
  /** A start hook threw. Whatever had started was rolled back. */
  FAILED = 'FAILED',
}
