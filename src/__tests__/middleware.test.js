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

  return {
    createLogger: jest.fn().mockImplementation(() => ({
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
    })),
    format: formatFn,
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    },
    addColors: jest.fn()
  };
});

jest.mock('morgan', () => {
  const mockMorgan = jest.fn().mockImplementation((format, options) => {
    return (req, res, next) => {
      if (options && options.skip && options.skip(req, res)) {
        return next();
      }
      if (options && options.stream && options.stream.write) {
        options.stream.write('mock log message');
      }
      next();
    };
  });
  return mockMorgan;
});

const winston = require('winston');
const morgan = require('morgan');
// Используем require вместо import для модуля
const { createHttpLogger, createErrorLogger } = require('../index.ts');

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
      const middleware = createHttpLogger(logger);
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should skip logging when skipLogging is true', () => {
      const middleware = createHttpLogger(logger, { skipLogging: true });
      
      middleware(mockRequest, mockResponse, nextFunction);
      
      expect(nextFunction).toHaveBeenCalled();
      expect(morgan).not.toHaveBeenCalled();
    });

    it('should add trace headers to response', () => {
      const middleware = createHttpLogger(logger);

      middleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.setHeader).toHaveBeenCalledTimes(2);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Trace-ID', 'mock-trace-id');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', 'mock-trace-id');
    });

    it('should use existing trace ID if present in request', () => {
      const traceId = '12345678-1234-1234-1234-123456789012';
      mockRequest.headers['x-trace-id'] = traceId;
      
      const middleware = createHttpLogger(logger);
      middleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Trace-ID', traceId);
    });
  });

  describe('Error Logger Middleware', () => {
    it('should log errors correctly', () => {
      const errorMiddleware = createErrorLogger(logger);

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

describe('HTTP Middleware', () => {
  let mockLogger;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Сбрасываем переменные окружения
    process.env.NODE_ENV = '';
    
    // Создаем моки для логгера и HTTP запроса/ответа
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      http: jest.fn(),
      log: jest.fn(),
      getContext: jest.fn().mockReturnValue({}),
      setContext: jest.fn(),
      clearContext: jest.fn(),
      generateTraceId: jest.fn().mockReturnValue('mock-trace-id')
    };
    
    mockReq = {
      headers: {},
      originalUrl: '/test',
      method: 'GET',
      body: { test: 'data' },
      params: { id: '123' },
      query: { filter: 'all' }
    };
    
    mockRes = {
      statusCode: 200,
      setHeader: jest.fn(),
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'finish') {
          callback();
        }
        return mockRes;
      })
    };
    
    mockNext = jest.fn();
  });

  describe('createHttpLogger', () => {
    it('should create HTTP logger middleware with default options', () => {
      const middleware = createHttpLogger(mockLogger);
      
      expect(middleware).toBeInstanceOf(Function);
      
      // Вызываем middleware
      middleware(mockReq, mockRes, mockNext);
      
      // Проверяем, что заголовки были установлены
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Trace-ID', expect.any(String));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
      
      // Проверяем, что контекст был установлен
      expect(mockLogger.setContext).toHaveBeenCalled();
      
      // Проверяем, что morgan был вызван
      expect(morgan).toHaveBeenCalled();
      
      // Проверяем, что next был вызван
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should use existing trace and request IDs from headers', () => {
      const traceId = 'existing-trace-id';
      const requestId = 'existing-request-id';
      
      mockReq.headers['x-trace-id'] = traceId;
      mockReq.headers['x-request-id'] = requestId;
      
      const middleware = createHttpLogger(mockLogger);
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Trace-ID', traceId);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', requestId);
      
      expect(mockLogger.setContext).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId,
          requestId
        })
      );
    });
    
    it('should clear context when response is finished', () => {
      const middleware = createHttpLogger(mockLogger);
      middleware(mockReq, mockRes, mockNext);
      
      // Проверяем, что обработчик события 'finish' был добавлен
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
      
      // Проверяем, что clearContext был вызван (так как мы мокаем событие finish)
      expect(mockLogger.clearContext).toHaveBeenCalled();
    });
    
    it('should skip logging with skipLogging option', () => {
      const middleware = createHttpLogger(mockLogger, { skipLogging: true });
      middleware(mockReq, mockRes, mockNext);
      
      // Проверяем, что next был вызван, но morgan не был вызван
      expect(mockNext).toHaveBeenCalled();
      expect(morgan).not.toHaveBeenCalled();
    });
    
    it('should log only auth errors in production with logOnlyAuthErrors option', () => {
      process.env.NODE_ENV = 'production';
      
      const middleware = createHttpLogger(mockLogger, { logOnlyAuthErrors: true });
      middleware(mockReq, mockRes, mockNext);
      
      // Проверяем, что morgan был вызван с опцией skip
      expect(morgan).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          skip: expect.any(Function)
        })
      );
      
      // Проверяем работу функции skip
      const options = morgan.mock.calls[0][1];
      
      // Для обычных статусов должен пропускать логирование
      expect(options.skip(mockReq, { statusCode: 200 })).toBe(true);
      
      // Для 401 и 403 не должен пропускать
      expect(options.skip(mockReq, { statusCode: 401 })).toBe(false);
      expect(options.skip(mockReq, { statusCode: 403 })).toBe(false);
    });
    
    it('should skip all logging in non-production with logOnlyAuthErrors option', () => {
      process.env.NODE_ENV = 'development';
      
      const middleware = createHttpLogger(mockLogger, { logOnlyAuthErrors: true });
      
      // В этом случае middleware должен просто вызывать next
      expect(middleware).toBeInstanceOf(Function);
      
      middleware(mockReq, mockRes, mockNext);
      
      // Проверяем, что next был вызван, но morgan не был вызван
      expect(mockNext).toHaveBeenCalled();
      expect(morgan).not.toHaveBeenCalled();
    });
    
    it('should use custom format when provided', () => {
      const middleware = createHttpLogger(mockLogger, { format: 'tiny' });
      middleware(mockReq, mockRes, mockNext);
      
      // Проверяем, что morgan был вызван с форматом 'tiny'
      expect(morgan).toHaveBeenCalledWith('tiny', expect.any(Object));
    });
  });

  describe('createErrorLogger', () => {
    it('should create error logger middleware', () => {
      const middleware = createErrorLogger(mockLogger);
      
      expect(middleware).toBeInstanceOf(Function);
      
      // Создаем тестовую ошибку
      const error = new Error('Test error');
      
      // Вызываем middleware
      middleware(error, mockReq, mockRes, mockNext);
      
      // Проверяем, что ошибка была залогирована
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Test error'),
        expect.objectContaining({
          error: expect.any(String),
          url: '/test',
          method: 'GET',
          body: { test: 'data' },
          params: { id: '123' },
          query: { filter: 'all' }
        })
      );
      
      // Проверяем, что next был вызван с ошибкой
      expect(mockNext).toHaveBeenCalledWith(error);
    });
    
    it('should include trace and request IDs in error log when available', () => {
      // Устанавливаем контекст с traceId и requestId
      mockLogger.getContext.mockReturnValue({
        traceId: 'test-trace-id',
        requestId: 'test-request-id'
      });
      
      const middleware = createErrorLogger(mockLogger);
      const error = new Error('Test error');
      
      middleware(error, mockReq, mockRes, mockNext);
      
      // Проверяем, что ошибка была залогирована с traceId и requestId
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          traceId: 'test-trace-id',
          requestId: 'test-request-id'
        })
      );
    });
  });
});
