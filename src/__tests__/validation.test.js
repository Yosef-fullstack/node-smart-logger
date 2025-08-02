const { sanitizeForLogging, validateLoggerContext, validateServiceName, validateLogLevel } = require('../validation.ts');

describe('Validation functions', () => {
  describe('sanitizeForLogging', () => {
    it('should sanitize strings with special characters', () => {
      const input = 'Test string\nwith newlines\rand carriage returns\ttabs\0nulls';
      const expected = 'Test string\\nwith newlines\\rand carriage returns\\ttabs\\0nulls';

      expect(sanitizeForLogging(input)).toBe(expected);
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeForLogging(123)).toBe('123');
      expect(sanitizeForLogging(null)).toBe('null');
      expect(sanitizeForLogging(undefined)).toBe('undefined');
      expect(sanitizeForLogging(true)).toBe('true');
    });

    it('should return empty string for empty input', () => {
      expect(sanitizeForLogging('')).toBe('');
    });
  });

  describe('validateLoggerContext', () => {
    it('should validate and sanitize valid context data', () => {
      const input = {
        traceId: '123e4567-e89b-12d3-a456-426614174000',
        requestId: 'test-request-id',
        operationId: '123e4567-e89b-12d3-a456-426614174001',
        deviceId: 'test-device-id',
        userId: 'test-user-id'
      };

      const result = validateLoggerContext(input);

      expect(result).toEqual({
        traceId: '123e4567-e89b-12d3-a456-426614174000',
        requestId: 'test-request-id',
        operationId: '123e4567-e89b-12d3-a456-426614174001',
        deviceId: 'test-device-id',
        userId: 'test-user-id'
      });
    });

    it('should ignore invalid UUIDs', () => {
      const input = {
        traceId: 'invalid-uuid',
        requestId: 'test-request-id',
        operationId: 'another-invalid-uuid',
        deviceId: 'test-device-id',
        userId: 'test-user-id'
      };

      const result = validateLoggerContext(input);

      expect(result).toEqual({
        requestId: 'test-request-id',
        deviceId: 'test-device-id',
        userId: 'test-user-id'
      });
    });

    it('should sanitize context data', () => {
      const input = {
        traceId: '123e4567-e89b-12d3-a456-426614174000',
        requestId: 'test-request-id\nwith newline',
        operationId: '123e4567-e89b-12d3-a456-426614174001',
        deviceId: 'test-device-id\rwith carriage return',
        userId: 'test-user-id\twith tab'
      };

      const result = validateLoggerContext(input);

      expect(result).toEqual({
        traceId: '123e4567-e89b-12d3-a456-426614174000',
        requestId: 'test-request-id\\nwith newline',
        operationId: '123e4567-e89b-12d3-a456-426614174001',
        deviceId: 'test-device-id\\rwith carriage return',
        userId: 'test-user-id\\twith tab'
      });
    });

    it('should handle empty context', () => {
      const input = {};
      const result = validateLoggerContext(input);

      expect(result).toEqual({});
    });
  });

  describe('validateServiceName', () => {
    it('should validate and sanitize valid service names', () => {
      expect(validateServiceName('test-service')).toBe('test-service');
      expect(validateServiceName('  test-service  ')).toBe('test-service');
    });

    it('should use default for empty service names', () => {
      expect(validateServiceName('')).toBe('default');
      expect(validateServiceName(null)).toBe('default');
      expect(validateServiceName(undefined)).toBe('default');
    });

    it('should truncate long service names', () => {
      const longName = 'a'.repeat(150);
      const result = validateServiceName(longName);

      expect(result.length).toBe(100);
    });

    it('should sanitize service names', () => {
      expect(validateServiceName('test-service\nwith newline')).toBe('test-service\\nwith newline');
    });
  });

  describe('validateLogLevel', () => {
    it('should validate valid log levels', () => {
      expect(validateLogLevel('error')).toBe('error');
      expect(validateLogLevel('warn')).toBe('warn');
      expect(validateLogLevel('info')).toBe('info');
      expect(validateLogLevel('http')).toBe('http');
      expect(validateLogLevel('verbose')).toBe('verbose');
      expect(validateLogLevel('debug')).toBe('debug');
      expect(validateLogLevel('silly')).toBe('silly');
    });

    it('should use default for invalid log levels', () => {
      expect(validateLogLevel('invalid')).toBe('info');
      expect(validateLogLevel('')).toBe('info');
      expect(validateLogLevel(null)).toBe('info');
    });

    it('should handle case insensitive log levels', () => {
      expect(validateLogLevel('ERROR')).toBe('error');
      expect(validateLogLevel('Warn')).toBe('warn');
      expect(validateLogLevel('INFO')).toBe('info');
    });
  });
});
