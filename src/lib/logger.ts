/**
 * Logger Utility
 *
 * Simple logging utility that:
 * - Logs to console in development
 * - Can be extended for production logging (Sentry, CloudWatch, etc.)
 * - Provides consistent logging format across the application
 */

type LogLevel = "info" | "warn" | "error" | "debug";

type LogContext = Record<string, unknown>;

/**
 * Logs a message with optional context
 *
 * @param level - Log level (info, warn, error, debug)
 * @param message - Log message
 * @param context - Optional context object or error
 */
function log(level: LogLevel, message: string, context?: LogContext | Error | unknown): void {
  const timestamp = new Date().toISOString();
  const isDevelopment = process.env.NODE_ENV === "development" || import.meta.env.DEV;

  // In development, log to console
  if (isDevelopment) {
    const logFn = level === "error" ? console.error : level === "warn" ? console.warn : console.info;

    if (context instanceof Error) {
      logFn(`[${timestamp}] [${level.toUpperCase()}] ${message}`, context);
    } else if (context) {
      logFn(`[${timestamp}] [${level.toUpperCase()}] ${message}`, context);
    } else {
      logFn(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }

  // TODO: In production, send to external logging service
  // Example integrations:
  // - Sentry.captureException(error, { extra: context });
  // - CloudWatch.putLogEvents({ logGroupName, logStreamName, logEvents });
  // - Datadog.log(message, { level, context });
}

/**
 * Log an informational message
 */
export function logInfo(message: string, context?: LogContext): void {
  log("info", message, context);
}

/**
 * Log a warning message
 */
export function logWarning(message: string, context?: LogContext): void {
  log("warn", message, context);
}

/**
 * Log an error message
 * Handles both Error objects and plain context
 */
export function logError(message: string, error?: Error | unknown, context?: LogContext): void {
  if (error instanceof Error) {
    log("error", message, error);
  } else if (error !== undefined) {
    // Bezpiecznie serializuj error i context, nawet jeśli są undefined lub nie mają value
    try {
      log("error", message, { error: safeStringify(error), context: context ? safeStringify(context) : undefined });
    } catch {
      log("error", message, { error: String(error), context: String(context) });
    }
  } else {
    log("error", message, context);
  }
}

function safeStringify(obj: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return String(obj);
  }
}

/**
 * Log a debug message (only in development)
 */
export function logDebug(message: string, context?: LogContext): void {
  if (process.env.NODE_ENV === "development" || import.meta.env.DEV) {
    log("debug", message, context);
  }
}
