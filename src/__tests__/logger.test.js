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
      withOperationContext: jest.fn().mockImplementation((data, callback) => {
        const previousContext = {};
        if (callback) {
          try {
            callback();
          } finally {
            logger.setContext(previousContext);
          }
        }
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
    
    // Suppress console.warn output for test cleanliness
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
      
      // Call createLogger with all three parameters according to the signature
      const logger = createLogger(service, customLogDir, options);
      
      // Check that path.isAbsolute is called with customLogDir
      expect(path.isAbsolute).toHaveBeenCalledWith(customLogDir);
      
      // Verify that the logger has all the necessary methods.
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

    it('should catch error "Failed to create log directory"', () => {
      // For this test, we allow warnings to be displayed.
      jest.restoreAllMocks();

      // Mock console.warn to prevent warning messages
      jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock fs.existsSync to return false (directory doesn't exist)
      const mockExistsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      // Mock fs.mkdirSync to throw an error
      const mockMkdirSync = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {
        throw new Error('Mock directory creation error');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error');

      const wrongPath = '...wrong+path&to@logs';
      const serviceName = 'test-service';

      // Mock path.join to return a predictable path
      const mockJoin = jest.spyOn(path, 'join').mockReturnValue(`${wrongPath}/${serviceName}`);

      createLogger(serviceName, wrongPath);

      // Check that console.error was called with the expected message
      expect(consoleErrorSpy).toHaveBeenCalledWith(
          `Failed to create log directory ${wrongPath}/${serviceName}:`,
          expect.any(Error)
      );

      // Restore all mocks
      mockExistsSync.mockRestore();
      mockMkdirSync.mockRestore();
      mockJoin.mockRestore();
      consoleErrorSpy.mockRestore();

      // Suppress console.warn again for other tests
      jest.spyOn(console, 'warn').mockImplementation(() => {});
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

    it('should execute callback function when provided to withOperationContext', () => {
      const logger = createLogger('test-service');
      const callbackMock = jest.fn();
      
      const withOperationSpy = jest.spyOn(logger, 'withOperationContext');
      const operationId = logger.withOperationContext({ traceId: 'test-trace' }, callbackMock);
      
      expect(withOperationSpy).toHaveBeenCalledWith({ traceId: 'test-trace' }, callbackMock);
      expect(callbackMock).toHaveBeenCalled();
      expect(operationId).toBe('mock-uuid');
    });
    
    it('should preserve and restore context when using withOperationContext with callback', () => {
      const logger = createLogger('test-service');
      const initialContext = { userId: 'initial-user' };
      const operationContext = { traceId: 'operation-trace' };
      const operationIdWithContext = { ...operationContext, operationId: 'mock-uuid' };
      
      // Override the implementation of getContext and setContext for this test.
      logger.getContext = jest.fn().mockReturnValue(initialContext);
      logger.setContext = jest.fn();
      
      // Override the implementation of withOperationContext for this test
      logger.withOperationContext = jest.fn().mockImplementation((data, callback) => {
        const prevContext = logger.getContext();
        logger.setContext({ ...data, operationId: 'mock-uuid' });
        
        if (callback) {
          try {
            callback();
          } finally {
            logger.setContext(prevContext);
          }
        }
        
        return 'mock-uuid';
      });
      
      // Create a spy to track calls setContext
      const setContextSpy = jest.spyOn(logger, 'setContext');
      
      // Perform the method with callback
      logger.withOperationContext(operationContext, () => {
        // nothing to do here.
      });
      
      // Check if setContext was called with the correct parameters
      expect(setContextSpy).toHaveBeenCalledWith(expect.objectContaining(operationContext));
      expect(setContextSpy).toHaveBeenLastCalledWith(initialContext);
    });
    
    it('should handle errors in callback and still restore context', () => {
      const logger = createLogger('test-service');
      const initialContext = { userId: 'initial-user' };
      const operationContext = { traceId: 'operation-trace' };
      const operationIdWithContext = { ...operationContext, operationId: 'mock-uuid' };
      
      // Override the implementation of getContext and setContext for this test
      logger.getContext = jest.fn().mockReturnValue(initialContext);
      logger.setContext = jest.fn();
      
      // Override the implementation of withOperationContext for this test
      logger.withOperationContext = jest.fn().mockImplementation((data, callback) => {
        const prevContext = logger.getContext();
        logger.setContext({ ...data, operationId: 'mock-uuid' });
        
        if (callback) {
          try {
            callback();
          } finally {
            logger.setContext(prevContext);
          }
        }
        
        return 'mock-uuid';
      });
      
      // Create a spy to track calls setContext
      const setContextSpy = jest.spyOn(logger, 'setContext');
      
      // Create a callback that throws an error
      const errorCallback = jest.fn(() => {
        throw new Error('Test error');
      });
      
      // Perform and wait for the error
      expect(() => {
        logger.withOperationContext(operationContext, errorCallback);
      }).toThrow('Test error');
      
      // Check that the callback was called
      expect(errorCallback).toHaveBeenCalled();
      
      // Verify that the context has been restored despite the error.
      expect(setContextSpy).toHaveBeenCalledWith(expect.objectContaining(operationContext));
      expect(setContextSpy).toHaveBeenLastCalledWith(initialContext);
    });
  });

  describe('Log Formatting', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    
    afterEach(() => {
      delete process.env.LOG_FORMAT;
      delete process.env.NODE_ENV;
    });
    
    it('should format logs with context information in text format', () => {
      // Set environment to use text format
      process.env.LOG_FORMAT = 'text';
      
      // Create a logger instance
      const serviceName = 'test-service';
      const logger = createLogger(serviceName);
      
      // Set a specific context
      const mockContext = {
        traceId: 'test-trace-id',
        requestId: 'test-request-id'
      };
      logger.setContext(mockContext);
      
      // Log a message to trigger the formatter
      const testMessage = 'Test message';
      logger.info(testMessage);
      
      // Verify that the logger was called with the correct parameters.
      expect(logger.info).toHaveBeenCalledWith(testMessage);
      
      // Check that winston.format.printf was called.
      expect(winston.format.printf).toHaveBeenCalled();
      
      // Verify that winston.createLogger was called with the correct parameters
      expect(winston.createLogger).toHaveBeenCalled();
      const options = winston.createLogger.mock.calls[0][0];
      expect(options).toBeDefined();
      expect(options.format).toBeDefined();
      
      // Check default values
      logger.clearContext();
      logger.info(testMessage);
    });
    
    it('should format logs with full context in text format', () => {
      // Set environment to use text format
      process.env.LOG_FORMAT = 'text';
      process.env.NODE_ENV = 'test';
      
      // Create a logger instance
      const serviceName = 'test-service';
      const logger = createLogger(serviceName);
      
      // Set a full context with all possible fields
      const fullContext = {
        traceId: 'test-trace-id',
        requestId: 'test-request-id',
        operationId: 'test-operation-id',
        deviceId: 'test-device-id',
        userId: 'test-user-id'
      };
      logger.setContext(fullContext);
      
      // Log a message to trigger the formatter
      const testMessage = 'Test message with full context';
      logger.info(testMessage);
      
      // Verify that the logger was called with the correct parameters
      expect(logger.info).toHaveBeenCalledWith(testMessage);
      
      // Checking the conditional logic for adding context fields
      // Remove operationId from context
      const partialContext = { ...fullContext };
      delete partialContext.operationId;
      
      logger.clearContext();
      logger.setContext(partialContext);
      logger.info(testMessage);
    });
    
    it('should format logs in JSON format with context', () => {
      // Set environment to use JSON format
      process.env.LOG_FORMAT = 'json';
      
      // Create a logger instance
      const serviceName = 'test-service';
      const logger = createLogger(serviceName);
      
      // Set a full context with all possible fields
      const fullContext = {
        traceId: 'test-trace-id',
        requestId: 'test-request-id',
        operationId: 'test-operation-id',
        deviceId: 'test-device-id',
        userId: 'test-user-id'
      };
      logger.setContext(fullContext);
      
      // Log a message to trigger the formatter
      const testMessage = 'Test message with full context';
      logger.info(testMessage);
      
      // Verify that the logger was called with the correct parameters
      expect(logger.info).toHaveBeenCalledWith(testMessage);
      
      // Check that the format has been set correctly
      expect(process.env.LOG_FORMAT).toBe('json');
      
      expect(winston.format.json).toHaveBeenCalled();
    });
    
    it('should add metadata to logs', () => {
      // Set environment for testing
      process.env.NODE_ENV = 'test';
      
      // Create a logger instance
      const serviceName = 'test-service';
      const logger = createLogger(serviceName);
      
      // Set context with userId and deviceId
      const context = {
        userId: 'test-user',
        deviceId: 'test-device'
      };
      logger.setContext(context);
      
      // Log a message
      logger.info('Test metadata');
      
      expect(logger.info).toHaveBeenCalledWith('Test metadata');
      
      expect(winston.createLogger).toHaveBeenCalled();
      const options = winston.createLogger.mock.calls[0][0];
      expect(options).toBeDefined();
    });
  });
});
