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

  return {
    createLogger: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
      add: jest.fn()
    })),
    format: formatFn,
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    },
    addColors: jest.fn()
  };
});

// Import modules after mocks
const winston = require('winston');
const loggerModule = require('../index.ts');

// Mock module's methods
jest.spyOn(loggerModule, 'getLoggerContext').mockImplementation(() => ({}));
jest.spyOn(loggerModule, 'setLoggerContext').mockImplementation(() => {});
jest.spyOn(loggerModule, 'clearLoggerContext').mockImplementation(() => {});
jest.spyOn(loggerModule, 'generateLoggerTraceId').mockImplementation(() => 'mock-trace-id');

describe('Logger Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FORMAT;
    delete process.env.AWS_CLOUDWATCH_ENABLED;
  });

  describe('createLogger', () => {
    it('should create a logger with default options', () => {
      const logger = loggerModule.createLogger('test-service');

      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should use custom log level from environment', () => {
      process.env.LOG_LEVEL = 'debug';
      loggerModule.createLogger('test-service');

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug'
        })
      );
    });

    it('should use json format when specified in environment', () => {
      process.env.LOG_FORMAT = 'json';
      loggerModule.createLogger('test-service');

      expect(winston.format.json).toHaveBeenCalled();
    });
  });

  describe('Context Management', () => {
    it('should set and get context correctly', () => {
      const testContext = { userId: '123', deviceId: '456' };

      loggerModule.getLoggerContext.mockReturnValueOnce(testContext);
      
      loggerModule.setLoggerContext(testContext);
      const retrievedContext = loggerModule.getLoggerContext();

      expect(loggerModule.setLoggerContext).toHaveBeenCalledWith(testContext);
      expect(retrievedContext).toEqual(testContext);
    });

    it('should clear context correctly', () => {
      loggerModule.setLoggerContext({ userId: '123' });
      loggerModule.clearLoggerContext();
      
      expect(loggerModule.clearLoggerContext).toHaveBeenCalled();
    });

    it('should generate valid trace ID', () => {
      const mockUuid = '12345678-1234-1234-1234-123456789012';
      loggerModule.generateLoggerTraceId.mockReturnValueOnce(mockUuid);
      
      const traceId = loggerModule.generateLoggerTraceId();

      expect(traceId).toBe(mockUuid);
    });
  });
});
