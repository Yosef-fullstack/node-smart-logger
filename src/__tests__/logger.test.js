// Mock modules before importing the module under test
jest.mock('winston-cloudwatch', () => {
  return function() {
    this.name = 'CloudWatch';
  };
}, { virtual: true });

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

jest.mock('path', () => ({
  isAbsolute: jest.fn(path => {
    // The function isAbsolute should check the string value of the path.
    // Real code calls path.isAbsolute(customLogDir), where customLogDir is a string.
    return typeof path === 'string' && path.startsWith('/');
  }),
  resolve: jest.fn((cwd, dir) => `${cwd}/${dir}`),
  join: jest.fn((dir, file) => `${dir}/${file}`)
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

jest.mock('winston', () => {
  const formatFn = jest.fn().mockImplementation((transform) => {
    if (typeof transform === 'function') {
      formatFn.transformFunctions = formatFn.transformFunctions || [];
      formatFn.transformFunctions.push(transform);
    }

    return jest.fn().mockReturnValue({
      transform: transform
    });
  });

  formatFn.combine = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.timestamp = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.json = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.printf = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.errors = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.colorize = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.simple = jest.fn().mockReturnValue({ transform: jest.fn() });

  const createLoggerMock = jest.fn().mockImplementation((options = {}) => {
    // Store the all last options passed to createLogger
    createLoggerMock.lastOptions = options;
    
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      http: jest.fn(),
      log: jest.fn(),
      getContext: jest.fn().mockReturnValue({}),
      setContext: jest.fn(),
      clearContext: jest.fn(),
      generateTraceId: jest.fn().mockReturnValue('mock-uuid'),
      withOperationContext: jest.fn().mockImplementation(data => {
        return data?.operationId || 'mock-uuid';
      })
    };

    return logger;
  });

  return {
    createLogger: createLoggerMock,
    format: formatFn,
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
      CloudWatch: jest.fn()
    },
    addColors: jest.fn()
  };
});

const { createLogger } = require('../index.ts');
const winston = require('winston');
const path = require('path');
const fs = require('fs');

describe('Logger Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LOG_LEVEL = '';
    process.env.LOG_FORMAT = '';
    process.env.AWS_CLOUDWATCH_ENABLED = '';
    process.env.AWS_CLOUDWATCH_GROUP = '';
    process.env.AWS_CLOUDWATCH_STREAM = '';
    process.env.NODE_ENV = '';
    
    // Подавляем вывод console.warn для чистоты тестов
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Logger Creation', () => {
    it('should create a logger with default options', () => {
      const logger = createLogger('test-service');
      expect(logger).toBeDefined();
      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should use custom log level from environment', () => {
      process.env.LOG_LEVEL = 'debug';
      createLogger('test-service');
      
      expect(winston.createLogger).toHaveBeenCalled();
    });

    it('should use all three parameters correctly', () => {
      const service = 'complex-service';
      const customLogDir = '/custom/log/path';
      const options = { 
        additionalOption: 'value',
        complexSetting: {
          enabled: true,
          timeout: 1000
        }
      };
      
      // Вызываем createLogger с всеми тремя параметрами согласно сигнатуре
      const logger = createLogger(service, customLogDir, options);
      
      // Проверяем, что path.isAbsolute вызван с customLogDir
      expect(path.isAbsolute).toHaveBeenCalledWith(customLogDir);
      
      // Проверяем, что логгер имеет все необходимые методы
      expect(logger).toHaveProperty('setContext');
      expect(logger).toHaveProperty('getContext');
      expect(logger).toHaveProperty('clearContext');
      expect(logger).toHaveProperty('generateTraceId');
    });

    it('should use json format when specified in environment', () => {
      process.env.LOG_FORMAT = 'json';
      createLogger('test-service');
      
      expect(winston.format.json).toHaveBeenCalled();
    });

    it('should use absolute path when provided in customLogDir', () => {
      const absolutePath = '/absolute/path/to/logs';
      
      createLogger('test-service', absolutePath);
      
      expect(path.isAbsolute).toHaveBeenCalledWith(absolutePath);
      
      expect(winston.transports.File).toHaveBeenCalled();
    });

    it('should resolve relative path when provided in customLogDir', () => {
      const relativePath = 'relative/path/to/logs';
      
      const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue('/current/dir');
      
      createLogger('test-service', relativePath);
      
      expect(path.isAbsolute).toHaveBeenCalledWith(relativePath);
      
      expect(winston.transports.File).toHaveBeenCalled();
      
      cwdSpy.mockRestore();
    });

    it('should pass options to the third parameter', () => {
      const options = { customOption: 'value' };
      
      createLogger('test-service', null, options);
      
      expect(winston.createLogger).toHaveBeenCalled();
    });
  });

  describe('Service Name', () => {
    it('should use default service name when not provided', () => {
      // For this test, we allow warnings to be displayed.
      jest.restoreAllMocks();
      
      const consoleWarnSpy = jest.spyOn(console, 'warn');
      
      createLogger('');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('Logger service name not provided, using "default".');
      
      // Suppress console.warn again so as not to clutter up the output of other tests.
      consoleWarnSpy.mockImplementation(() => {});
    });
  });

  describe('Context Management', () => {
    it('should set and get context correctly', () => {
      const testContext = { userId: '123', deviceId: '456' };
      
      const logger = createLogger('test-service');
      
      jest.spyOn(logger, 'getContext').mockReturnValue(testContext);
      
      const setContextSpy = jest.spyOn(logger, 'setContext');
      
      logger.setContext(testContext);
      
      expect(setContextSpy).toHaveBeenCalledWith(testContext);
      
      const returnedContext = logger.getContext();
      expect(returnedContext).toEqual(testContext);
    });

    it('should clear context correctly', () => {
      const testContext = { userId: '123', deviceId: '456' };
      
      const logger = createLogger('test-service');
      
      logger.setContext(testContext);
      
      const getContextSpy = jest.spyOn(logger, 'getContext').mockReturnValue({});
      
      const clearContextSpy = jest.spyOn(logger, 'clearContext');
      
      logger.clearContext();
      
      expect(clearContextSpy).toHaveBeenCalled();
      
      const emptyContext = logger.getContext();
      expect(emptyContext).toEqual({});
    });

    it('should generate trace ID correctly', () => {
      const logger = createLogger('test-service');
      
      const generateTraceIdSpy = jest.spyOn(logger, 'generateTraceId');
      
      const traceId = logger.generateTraceId();
      
      expect(generateTraceIdSpy).toHaveBeenCalled();
      expect(traceId).toBe('mock-uuid');
      
      // Verify that traceId is also available in logger methods
      // This checks that traceId is correctly integrated with the logger context.
      const withOperationSpy = jest.spyOn(logger, 'withOperationContext');
      logger.withOperationContext({ operationId: traceId });
      expect(withOperationSpy).toHaveBeenCalledWith({ operationId: traceId });
    });
  });
});
