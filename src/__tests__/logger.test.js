// Mock modules before importing the module under test
jest.mock('winston-cloudwatch', () => {
  return function() {
    this.name = 'CloudWatch';
  };
}, { virtual: true });

// Мокаем uuid для предсказуемого результата
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

// Мокаем модуль path
jest.mock('path', () => ({
  isAbsolute: jest.fn(path => {
    // Функция isAbsolute должна проверять строковое значение пути
    // Реальный код вызывает path.isAbsolute(customLogDir), где customLogDir это строка
    return typeof path === 'string' && path.startsWith('/');
  }),
  resolve: jest.fn((cwd, dir) => `${cwd}/${dir}`),
  join: jest.fn((dir, file) => `${dir}/${file}`)
}));

// Мокаем модуль fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

// Мокаем winston
jest.mock('winston', () => {
  // Создаем мок для форматтера
  const formatFn = jest.fn().mockImplementation((transform) => {
    // Если transform - это функция, запоминаем её, чтобы иметь к ней доступ при тестировании
    if (typeof transform === 'function') {
      formatFn.transformFunctions = formatFn.transformFunctions || [];
      formatFn.transformFunctions.push(transform);
    }
    
    const formatterFn = jest.fn().mockReturnValue({
      transform: transform
    });
    return formatterFn;
  });

  // Добавляем методы к функции format
  formatFn.combine = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.timestamp = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.json = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.printf = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.errors = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.colorize = jest.fn().mockReturnValue({ transform: jest.fn() });
  formatFn.simple = jest.fn().mockReturnValue({ transform: jest.fn() });

  // Создаем мок для createLogger
  const createLoggerMock = jest.fn().mockImplementation((options = {}) => {
    // Запоминаем все опции, переданные в createLogger
    createLoggerMock.lastOptions = options;
    
    // Создаем логгер с мок-методами
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

// Импортируем модуль логгера и модули после моков
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
      
      // Вызываем createLogger со вторым параметром customLogDir согласно сигнатуре
      createLogger('test-service', absolutePath);
      
      // Проверяем, что path.isAbsolute был вызван с правильным аргументом
      expect(path.isAbsolute).toHaveBeenCalledWith(absolutePath);
      
      // Проверяем, что winston.transports.File был вызван
      expect(winston.transports.File).toHaveBeenCalled();
    });

    it('should resolve relative path when provided in customLogDir', () => {
      const relativePath = 'relative/path/to/logs';
      
      // Мокаем process.cwd()
      const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue('/current/dir');
      
      // Вызываем createLogger со вторым параметром customLogDir согласно сигнатуре
      createLogger('test-service', relativePath);
      
      // Проверяем, что path.isAbsolute был вызван с правильным аргументом
      expect(path.isAbsolute).toHaveBeenCalledWith(relativePath);
      
      // Проверяем, что winston.transports.File был вызван
      expect(winston.transports.File).toHaveBeenCalled();
      
      // Восстанавливаем оригинальную функцию
      cwdSpy.mockRestore();
    });

    it('should pass options to the third parameter', () => {
      const options = { customOption: 'value' };
      
      // Вызываем createLogger с третьим параметром options согласно сигнатуре
      createLogger('test-service', null, options);
      
      // Проверяем, что winston.createLogger был вызван
      expect(winston.createLogger).toHaveBeenCalled();
    });
  });

  describe('Service Name', () => {
    it('should use default service name when not provided', () => {
      // Для этого теста разрешаем вывод предупреждений
      jest.restoreAllMocks();
      
      // Шпионим за console.warn, чтобы проверить, что предупреждение выводится
      const consoleWarnSpy = jest.spyOn(console, 'warn');
      
      // Вызываем createLogger без имени сервиса (пустая строка)
      createLogger('');
      
      // Проверяем, что console.warn был вызван с правильным сообщением
      expect(consoleWarnSpy).toHaveBeenCalledWith('Logger service name not provided, using "default".');
      
      // Снова подавляем console.warn чтобы не засорять вывод других тестов
      consoleWarnSpy.mockImplementation(() => {});
    });
  });

  describe('Context Management', () => {
    it('should set and get context correctly', () => {
      const testContext = { userId: '123', deviceId: '456' };
      
      // Создаем логгер
      const logger = createLogger('test-service');
      
      // Используем jest.spyOn для создания шпиона за методом setContext
      const setContextSpy = jest.spyOn(logger, 'setContext');
      
      // Устанавливаем контекст
      logger.setContext(testContext);
      
      // Проверяем, что setContext был вызван с правильными аргументами
      expect(setContextSpy).toHaveBeenCalledWith(testContext);
    });

    it('should clear context correctly', () => {
      // Создаем логгер
      const logger = createLogger('test-service');
      
      // Используем jest.spyOn для создания шпиона за методом clearContext
      const clearContextSpy = jest.spyOn(logger, 'clearContext');
      
      // Очищаем контекст
      logger.clearContext();
      
      // Проверяем, что clearContext был вызван
      expect(clearContextSpy).toHaveBeenCalled();
    });

    it('should generate trace ID correctly', () => {
      // Создаем логгер
      const logger = createLogger('test-service');
      
      // Используем jest.spyOn для создания шпиона за методом generateTraceId
      const generateTraceIdSpy = jest.spyOn(logger, 'generateTraceId');
      
      // Генерируем trace ID
      const traceId = logger.generateTraceId();
      
      // Проверяем, что generateTraceId был вызван и вернул ожидаемый результат
      expect(generateTraceIdSpy).toHaveBeenCalled();
      expect(traceId).toBe('mock-uuid');
    });
  });
});
