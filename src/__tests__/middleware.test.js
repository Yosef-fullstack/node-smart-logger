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
      http: jest.fn(),
      log: jest.fn()
    })),
    format: formatFn,
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    },
    addColors: jest.fn()
  };
});

// Mock for morgan
jest.mock('morgan', () => {
  const mockMorgan = jest.fn().mockImplementation(() => {
    return (req, res, next) => {
      next();
    };
  });
  return mockMorgan;
});

const winston = require('winston');
const morgan = require('morgan');
const loggerModule = require('../index.ts');

describe('HTTP Logger Middleware', () => {
  let logger;
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create logger with mocks
    logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      http: jest.fn(),
      getContext: jest.fn().mockReturnValue({}),
      setContext: jest.fn(),
      clearContext: jest.fn(),
      generateTraceId: jest.fn().mockReturnValue('mock-trace-id')
    };

    // Create mocks for req, res and next
    mockRequest = {
      method: 'GET',
      url: '/test',
      originalUrl: '/test',
      headers: {},
      ip: '127.0.0.1',
      body: {},
      params: {},
      query: {}
    };

    mockResponse = {
      statusCode: 200,
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'finish') {
          callback();
        }
        return mockResponse;
      })
    };

    nextFunction = jest.fn();
  });

  describe('HTTP Logger', () => {
    it('should create middleware correctly', () => {
      const middleware = loggerModule.createHttpLogger(logger);
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should skip logging when skipLogging is true', () => {
      const middleware = loggerModule.createHttpLogger(logger, { skipLogging: true });
      
      middleware(mockRequest, mockResponse, nextFunction);
      
      expect(nextFunction).toHaveBeenCalled();
      expect(morgan).not.toHaveBeenCalled();
    });

    it('should add trace headers to response', () => {
      const middleware = loggerModule.createHttpLogger(logger);

      middleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.setHeader).toHaveBeenCalledTimes(2);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Trace-ID', 'mock-trace-id');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', 'mock-trace-id');
    });

    it('should use existing trace ID if present in request', () => {
      const traceId = '12345678-1234-1234-1234-123456789012';
      mockRequest.headers['x-trace-id'] = traceId;
      
      const middleware = loggerModule.createHttpLogger(logger);
      middleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Trace-ID', traceId);
    });
  });

  describe('Error Logger Middleware', () => {
    it('should log errors correctly', () => {
      const errorMiddleware = loggerModule.createErrorLogger(logger);

      // Creating test error
      const testError = new Error('Test error');

      // Call middleware
      errorMiddleware(testError, mockRequest, mockResponse, nextFunction);

      // Check if error was logged correctly
      expect(logger.error).toHaveBeenCalled();
      expect(logger.error.mock.calls[0][0]).toContain('Test error');
      expect(logger.error.mock.calls[0][1]).toMatchObject({
        method: 'GET'
      });

      expect(nextFunction).toHaveBeenCalledWith(testError);
    });
  });
});
