// Types (interface) for logger context
interface LoggerContext {
  traceId?: string;
  requestId?: string;
  operationId?: string;
  deviceId?: string;
  userId?: string;
  [key: string]: any;
}

/**
 * Validates and sanitizes a string to prevent log injection
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeForLogging(input: string): string {
  if (typeof input !== 'string') {
    return String(input);
  }

  // Remove or replace characters that could be used for log injection
  return input
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\0/g, '\\0');
}

/**
 * Validates logger context data
 * @param context - Context data to validate
 * @returns Validated context data
 */
export function validateLoggerContext(context: Partial<LoggerContext>): LoggerContext {
  const validatedContext: LoggerContext = {};

  if (context.traceId) {
    // Validate UUID format
    if (typeof context.traceId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(context.traceId)) {
      validatedContext.traceId = sanitizeForLogging(context.traceId);
    }
  }

  if (context.requestId) {
    // requestId can be any string, but we should sanitize it
    if (typeof context.requestId === 'string') {
      validatedContext.requestId = sanitizeForLogging(context.requestId);
    }
  }

  if (context.operationId) {
    // Validate UUID format
    if (typeof context.operationId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(context.operationId)) {
      validatedContext.operationId = sanitizeForLogging(context.operationId);
    }
  }

  if (context.deviceId) {
    // deviceId can be any string, but we should sanitize it
    if (typeof context.deviceId === 'string') {
      validatedContext.deviceId = sanitizeForLogging(context.deviceId);
    }
  }

  if (context.userId) {
    // userId can be any string, but we should sanitize it
    if (typeof context.userId === 'string') {
      validatedContext.userId = sanitizeForLogging(context.userId);
    }
  }

  return validatedContext;
}

/**
 * Validates service name
 * @param service - Service name to validate
 * @returns Validated service name
 */
export function validateServiceName(service: string): string {
  if (typeof service !== 'string' || service.trim() === '') {
    return 'default';
  }

  // Limit service name length and sanitize
  const trimmedService = service.trim();
  return sanitizeForLogging(trimmedService.substring(0, 100));
}

/**
 * Validates log level
 * @param level - Log level to validate
 * @returns Validated log level
 */
export function validateLogLevel(level: string): string {
  const validLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

  if (typeof level !== 'string') {
    return 'info';
  }

  const lowerLevel = level.toLowerCase();
  return validLevels.includes(lowerLevel) ? lowerLevel : 'info';
}
