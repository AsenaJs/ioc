import type { IocLogger } from '../../index';

/**
 * An IocLogger that discards everything.
 *
 * The default logger for test apps: the engine's warnings about the fixtures do not belong in
 * test output.
 */
const noop = (): void => {
  // Intentionally empty - the whole point is to keep test output clean
};

export const silentLogger: IocLogger = {
  info: noop,
  warn: noop,
  error: noop,
};

/**
 * A single captured log line.
 */
export interface CapturedLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  meta?: any;
}

/**
 * Creates a silent logger that also records every call, so tests can assert on warnings.
 *
 * @returns The logger plus the array it appends to (live, not a copy)
 *
 * @example
 * ```typescript
 * const { logger, entries } = createCapturingLogger();
 * const app = await IocApplication.create({ components: [PerResolveWorker], logger });
 *
 * expect(entries.some((e) => e.level === 'warn' && e.message.includes('is transient'))).toBe(true);
 * ```
 */
export function createCapturingLogger(): { logger: IocLogger; entries: CapturedLogEntry[] } {
  const entries: CapturedLogEntry[] = [];

  return {
    entries,
    logger: {
      info: (message: string, meta?: any) => {
        entries.push({ level: 'info', message, meta });
      },
      warn: (message: string, meta?: any) => {
        entries.push({ level: 'warn', message, meta });
      },
      error: (message: string, meta?: any) => {
        entries.push({ level: 'error', message, meta });
      },
    },
  };
}
