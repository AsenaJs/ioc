/**
 * Where the container reports what it finds while registering, starting and stopping components.
 *
 * Deliberately narrow, so that any logger with these methods can be passed as it is.
 */
export interface IocLogger {
  /**
   * Logs an informational message.
   * @param message - The message to log.
   * @param meta - Optional metadata to include with the log.
   */
  info: (message: string, meta?: any) => void;

  /**
   * Logs a warning message.
   * @param message - The message to log.
   * @param meta - Optional metadata to include with the log.
   */
  warn: (message: string, meta?: any) => void;

  /**
   * Logs an error message.
   * @param message - The message to log.
   * @param meta - Optional metadata to include with the log.
   */
  error: (message: string, meta?: any) => void;

  /**
   * Logs a debug message.
   *
   * Optional, and callers fall back to silence when it is absent: everything the container
   * sends here is a diagnostic that should stay quiet unless someone is looking.
   *
   * @param message - The message to log.
   * @param meta - Optional metadata to include with the log.
   */
  debug?: (message: string, meta?: any) => void;
}
