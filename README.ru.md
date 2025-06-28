# Node Smart Logger

[![npm version](https://img.shields.io/npm/v/@vitaly-yosef/node-smart-logger.svg)](https://www.npmjs.com/package/@vitaly-yosef/node-smart-logger)
[![Downloads](https://img.shields.io/npm/dm/@vitaly-yosef/node-smart-logger.svg)](https://www.npmjs.com/package/@vitaly-yosef/node-smart-logger)
[![Build Status](https://github.com/Yosef-fullstack/node-smart-logger/actions/workflows/main.yml/badge.svg)](https://github.com/Yosef-fullstack/node-smart-logger/actions)
[![Coverage Status](https://coveralls.io/repos/github/Yosef-fullstack/node-smart-logger/badge.svg?branch=master)](https://coveralls.io/github/Yosef-fullstack/node-smart-logger?branch=master)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Универсальный модуль логирования с расширенными функциями, включая структурированное логирование в формате JSON, интеграцию с AWS CloudWatch Logs и контекстное логирование.

## Возможности

- Структурированное логирование в формате JSON
- Гибкий выбор формата логов (текст для разработки, JSON для продакшена)
- Ротация лог-файлов с компрессией
- Интеграция с AWS CloudWatch Logs
- Контекстное логирование (trace ID, request ID, operation ID, device ID, user ID)
- Расширенные уровни логирования и цвета для лучшей видимости и фильтрации
- Логирование метаданных (имя хоста, окружение, имя сервиса)
- Middleware для HTTP-запросов с автоматическим трейсингом
- Middleware для обработки ошибок
- Совместимость с модулями ESM и CommonJS (import/require)

## Установка

```bash
# Используя npm
npm install @vitaly-yosef/node-smart-logger

# Используя yarn
yarn add @vitaly-yosef/node-smart-logger

# Используя pnpm
pnpm add @vitaly-yosef/node-smart-logger
```

## Использование

### Базовое использование

```javascript
import { createLogger } from '@vitaly-yosef/node-smart-logger';

// Создание экземпляра логгера с именем сервиса и путем к лог-файлам
const logger = createLogger('my-service', './logs');

// Логирование на разных уровнях
logger.debug('Отладочное сообщение');
logger.info('Информационное сообщение');
logger.warn('Предупреждение');
logger.error('Сообщение об ошибке');
logger.alert('Критическое предупреждение');
```

### Контекстное логирование

```javascript
import { createLogger, setLoggerContext, clearLoggerContext, generateLoggerTraceId } from '@vitaly-yosef/node-smart-logger';

const logger = createLogger('my-service', './logs');

// Генерация и установка контекста
const traceId = generateLoggerTraceId();
setLoggerContext({ traceId, deviceId: 'device-123' });

// Логи будут содержать контекст
logger.info('Обработка данных устройства');

// Очистка контекста после завершения операции
clearLoggerContext();
```

Дополнительные примеры контекстного логирования.

```javascript
const { createLogger, setLoggerContext, clearLoggerContext } = require('@vitaly-yosef/node-smart-logger');

const logger = createLogger('my-service', './logs');

function processDevice(deviceId, data) {
  setLoggerContext({ 
    operationId: 'process-device',
    deviceId: deviceId
  });
  
  try {
    logger.info(`Обработка данных устройства`); // Лог будет содержать deviceId и operationId
    // ... обработка данных ...
    logger.info(`Данные устройства успешно обработаны`);
    return result;
  } catch (error) {
    logger.error(`Ошибка обработки данных устройства: ${error.message}`);
    throw error;
  } finally {
    // Очистка контекста после завершения операции
    clearLoggerContext();
  }
}
```

Или более удобный способ с использованием метода ```withOperationContext```.

```javascript
const { createLogger } = require('@vitaly-yosef/node-smart-logger');

const logger = createLogger('my-service', './logs');

function processDevice(deviceId, data) {
  return logger.withOperationContext(
    { operationId: 'process-device', deviceId },
    () => {
      logger.info(`Обработка данных устройства`); // с контекстом
      // ... обработка данных ...
      logger.info(`Данные устройства успешно обработаны`); // с контекстом
      return result;
    }
  );
}
```

### HTTP-логгер с middleware для трейсинга

```javascript
import express from 'express';
import { createLogger, createHttpLogger, createErrorLogger } from '@vitaly-yosef/node-smart-logger';

const app = express();
const logger = createLogger('api-service', './logs');

// Middleware для логирования HTTP-запросов с трейсингом
app.use(createHttpLogger(logger));

// Middleware для логирования ошибок
app.use(createErrorLogger(logger));

app.get('/api/devices', (req, res) => {
  // Контекст уже установлен в middleware
  logger.info('Получение списка устройств');
  
  // Добавление дополнительного контекста
  logger.setContext({ userId: req.user?.id });
  
  // Логика обработки запроса
  res.json({ devices: [] });
});

app.listen(3000, () => {
  logger.info('Сервер запущен на порту 3000');
});
```

### Интеграция с AWS CloudWatch Logs

Для включения логирования в AWS CloudWatch установите следующие переменные окружения:

```
AWS_CLOUDWATCH_ENABLED=true
AWS_CLOUDWATCH_GROUP=IoTMonSys-ServiceName
AWS_CLOUDWATCH_STREAM=instance-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

> **Примечание**: При использовании `LOG_FORMAT=text` с `AWS_CLOUDWATCH_ENABLED=true`, ваши локальные логи будут в текстовом формате, но CloudWatch будет получать логи в формате JSON для лучшего анализа и фильтрации.

## Уровни логирования

- `alert`: 0 - Критические ошибки, требующие немедленных действий
- `error`: 1 - Ошибки, нарушающие работу приложения
- `warn`: 2 - Предупреждения, не мешающие работе приложения
- `info`: 3 - Информационные сообщения о работе приложения
- `http`: 4 - Логирование HTTP-запросов
- `debug`: 5 - Отладочная информация

## Форматы логов

Логгер поддерживает два формата вывода, которые можно настроить через переменную окружения `LOG_FORMAT`:

### Текстовый формат (`LOG_FORMAT=text`)

Человекочитаемый формат с цветами в консоли, идеально подходит для разработки:

```log
2025-06-12 17:14:51:1451 [udp-listener] INFO [trace:abc123] [operation:process-data]: Данные устройства успешно обработаны
```

В консоли этот формат отображается с цветами:
- Временная метка: серый
- Имя сервиса (`[udp-listener]`): синий
- Уровень логирования (`INFO`): зеленый для info, желтый для warn, красный для error
- Контекст (`[trace:abc123]`): фиолетовый
- Сообщение: белый

Это делает логи более читаемыми и позволяет быстро выделять важную информацию.

### JSON формат (`LOG_FORMAT=json`)

Машиночитаемый формат, идеально подходит для продакшена и интеграции с CloudWatch:

```json
{
  "timestamp": "2025-06-12T17:14:51.451Z",
  "level": "info",
  "message": "Данные устройства успешно обработаны",
  "service": "udp-listener",
  "hostname": "server-name",
  "environment": "production",
  "traceId": "abc123",
  "operationId": "process-data",
  "deviceId": "device-456"
}
```

> **Важно**: Логи CloudWatch всегда отправляются в формате JSON независимо от настройки `LOG_FORMAT` для обеспечения правильного парсинга и анализа в AWS CloudWatch.

## Тестирование

Проект использует Jest для тестирования. Тесты находятся в директории `src/__tests__`.

### Запуск тестов

```bash
# Запуск всех тестов
npm test

# Запуск тестов с покрытием
npm test -- --coverage
```

### Структура тестов

Тесты структурированы для проверки:
- Основной функциональности логгера
- Управления контекстом
- HTTP middleware
- Middleware обработки ошибок

### Мокирование зависимостей

При написании тестов для кода, использующего этот логгер, вам может потребоваться его мокировать. Вот пример:

```javascript
// Мок модуля логгера
jest.mock('@vitaly-yosef/node-smart-logger', () => {
  return {
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      setContext: jest.fn(),
      getContext: jest.fn(),
      clearContext: jest.fn(),
      generateTraceId: jest.fn()
    }),
    createHttpLogger: jest.fn().mockReturnValue((req, res, next) => next()),
    createErrorLogger: jest.fn().mockReturnValue((err, req, res, next) => next(err))
  };
});
```

## Настройки

Модуль логирования использует следующие переменные окружения:

| Переменная | Описание | Значение по умолчанию |
|------------|----------|----------------------|
| NODE_ENV | Окружение (development/production) | development |
| LOG_FORMAT | Формат логов (text/json) | text для development, json для production |
| AWS_CLOUDWATCH_ENABLED | Включить отправку логов в CloudWatch | false |
| AWS_CLOUDWATCH_GROUP | Имя группы логов CloudWatch | - |
| AWS_CLOUDWATCH_STREAM | Имя потока логов CloudWatch (по умолчанию: hostname-date) | - |
| AWS_REGION | Регион AWS | - |
| AWS_ACCESS_KEY_ID | ID ключа доступа AWS | - |
| AWS_SECRET_ACCESS_KEY | Секретный ключ доступа AWS | - |
 