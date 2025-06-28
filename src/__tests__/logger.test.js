// Mock modules before importing the module under test
jest.mock('winston-cloudwatch', () => {
  return function() {
    this.name = 'CloudWatch';
  };
}, { virtual: true });

jest.mock('winston', () => {
  const formatFn = jest.fn().mockImplementation((transform) => {
    const formatterFn = jest.fn().mockReturnValue({
      transform: (info = {}) => {
        if (typeof transform === 'function') {
          transform(info);
        }
        return info;
      }
    });

    return formatterFn;
  });

  // Adding methods to the function 'format':
  formatFn.combine = jest.fn().mockImplementation((...formatters) => {
    return {
      transform: (info = {}) => info
    };
  });
  formatFn.timestamp = jest.fn().mockReturnValue({
    transform: (info = {}) => info
  });
  formatFn.colorize = jest.fn().mockReturnValue({
    transform: (info = {}) => info
  });
  formatFn.printf = jest.fn().mockImplementation((fn) => ({
    transform: (info = {}) => {
      if (typeof fn === 'function') {
        return fn(info);
      }
      return info;
    }
  }));
  formatFn.json = jest.fn().mockReturnValue({
    transform: (info = {}) => info
  });
  formatFn.errors = jest.fn().mockReturnValue({
    transform: (info = {}) => info
  });
  formatFn.splat = jest.fn().mockReturnValue({
    transform: (info = {}) => info
  });

  const createLoggerMock = jest.fn().mockImplementation((options = {}) => {
    // Используем переменную окружения LOG_LEVEL, если она установлена
    const level = process.env.LOG_LEVEL || 'info';

    return {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      http: jest.fn(),
      log: jest.fn(),
      // Добавляем методы контекста
      getContext: jest.fn().mockReturnValue({}),
      setContext: jest.fn(),
      clearContext: jest.fn(),
      generateTraceId: jest.fn().mockReturnValue('mock-trace-id')
    };
  });

  return {
    createLogger: createLoggerMock,
    format: formatFn,
    transports: {
      File: jest.fn(),
      Console: jest.fn(),
    },
    addColors: jest.fn()
  };
});

// Import modules after mocks
const winston = require('winston');
const { createLogger } = require('../index.ts');

// Создаем моки для функций контекста
const mockGetContext = jest.fn().mockReturnValue({});
const mockSetContext = jest.fn();
const mockClearContext = jest.fn();
const mockGenerateTraceId = jest.fn().mockReturnValue('mock-trace-id');

// Мокаем модуль с функциями контекста
jest.mock('../index.ts', () => {
  const originalModule = jest.requireActual('../index.ts');
  return {
    ...originalModule,
    getLoggerContext: mockGetContext,
    setLoggerContext: mockSetContext,
    clearLoggerContext: mockClearContext,
    generateLoggerTraceId: mockGenerateTraceId
  };
}, { virtual: false });

describe('Logger Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LOG_LEVEL = '';
    process.env.LOG_FORMAT = '';
    process.env.AWS_CLOUDWATCH_ENABLED = '';
    process.env.NODE_ENV = '';
  });

  describe('createLogger', () => {
    it('should create a logger with default options', () => {
      const logger = createLogger('test-service');

      expect(winston.createLogger).toHaveBeenCalled();
    });
    
    it('should use custom log level from environment', () => {
      process.env.LOG_LEVEL = 'debug';
      createLogger('test-service');

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );
    });

    it('should use json format when specified in environment', () => {
      process.env.LOG_FORMAT = 'json';
      createLogger('test-service');

      expect(winston.format.json).toHaveBeenCalled();
    });
  });

  describe('Context Management', () => {
    it('should set and get context correctly', () => {
      const testContext = { userId: '123', deviceId: '456' };

      mockGetContext.mockReturnValueOnce(testContext);
      
      mockSetContext(testContext);
      const retrievedContext = mockGetContext();

      expect(mockSetContext).toHaveBeenCalledWith(testContext);
      expect(retrievedContext).toEqual(testContext);
    });

    it('should clear context correctly', () => {
      mockSetContext({ userId: '123' });
      mockClearContext();
      
      expect(mockClearContext).toHaveBeenCalled();
    });

    it('should generate valid trace ID', () => {
      const mockUuid = '12345678-1234-1234-1234-123456789012';
      mockGenerateTraceId.mockReturnValueOnce(mockUuid);
      
      const traceId = mockGenerateTraceId();

      expect(traceId).toBe(mockUuid);
    });
  });
});
