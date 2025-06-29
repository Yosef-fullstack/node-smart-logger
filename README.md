# Node Smart Logger

[![npm version](https://img.shields.io/npm/v/@vitaly-yosef/node-smart-logger.svg)](https://www.npmjs.com/package/@vitaly-yosef/node-smart-logger)
[![Downloads](https://img.shields.io/npm/dm/@vitaly-yosef/node-smart-logger.svg)](https://www.npmjs.com/package/@vitaly-yosef/node-smart-logger)
[![Build Status](https://github.com/Yosef-fullstack/node-smart-logger/actions/workflows/main.yml/badge.svg)](https://github.com/Yosef-fullstack/node-smart-logger/actions)
[![Coverage Status](https://coveralls.io/repos/github/Yosef-fullstack/node-smart-logger/badge.svg?branch=master)](https://coveralls.io/github/Yosef-fullstack/node-smart-logger?branch=master)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Universal logging module with advanced features, including structured JSON logging, AWS CloudWatch Logs integration, and contextual logging.

# Node Smart Logger

A universal logger (initially created as a module for one of my project) with advanced features, including structured logging in JSON format, integration with AWS CloudWatch Logs, and contextual logging. It can be used as for ESM projects, also as for CommonJS projects.

## Features

- Structured logging in JSON format
- Flexible log format selection (text for development, JSON for production)
- Log file rotation with compression
- AWS CloudWatch Logs integration
- Contextual logging (trace ID, request ID, operation ID, device ID, user ID)
- Enhanced logging levels and colors for better visibility and filtering
- Metadata logging (hostname, environment, service name)
- Middleware for HTTP-requests with automated tracing
- Error handling middleware
- Compatible with both ESM and CommonJS modules (import/require)

## Installation

```bash
# Using npm
npm install @vitaly-yosef/node-smart-logger

# Using yarn
yarn add @vitaly-yosef/node-smart-logger

# Using pnpm
pnpm add @vitaly-yosef/node-smart-logger
```

## Usage

### Basic usage

```javascript
import { createLogger } from '@vitaly-yosef/node-smart-logger';

// Create a logger instance with a service name and log file path. 
const logger = createLogger('my-service', './logs');

// Different levels logging
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
logger.alert('Critical alert');
```

### Contextual logging

```javascript
import { createLogger, setLoggerContext, clearLoggerContext, generateLoggerTraceId } from '@vitaly-yosef/node-smart-logger';

const logger = createLogger('my-service', './logs');

// Generation and setting context
const traceId = generateLoggerTraceId();
setLoggerContext({ traceId, deviceId: 'device-123' });

// Logs will contain the context. 
logger.info('Processing device data');

// Clear context after operation finished
clearLoggerContext();
```

Additional examples for contextual logging.

```javascript
const { createLogger, setLoggerContext, clearLoggerContext } = require('@vitaly-yosef/node-smart-logger');

const logger = createLogger('my-service', './logs');

function processDevice(deviceId, data) {
  setLoggerContext({ 
    operationId: 'process-device',
    deviceId: deviceId
  });
  
  try {
    logger.info(`Processing device data`); // Log will contain the deviceId ab=nd the operationId
    // ... data processing ...
    logger.info(`Device data processed successfully`);
    return result;
  } catch (error) {
    logger.error(`Error processing device data: ${error.message}`);
    throw error;
  } finally {
    // Clear context after operation finished
    clearLoggerContext();
  }
}
```

Or a more convenient way using ```withOperationContext``` method.

```javascript
const { createLogger } = require('@vitaly-yosef/node-smart-logger');

const logger = createLogger('my-service', './logs');

function processDevice(deviceId, data) {
  return logger.withOperationContext(
    { operationId: 'process-device', deviceId },
    () => {
      logger.info(`Processing device data`); // with context
      // ... data processing ...
      logger.info(`Device data processed successfully`); // with context
      return result;
    }
  );
}
```

### HTTP-logger with tracing middleware.

```javascript
import express from 'express';
import { createLogger, createHttpLogger, createErrorLogger } from '@vitaly-yosef/node-smart-logger';

const app = express();
const logger = createLogger('api-service', './logs');

// Middleware for logging HTTP-requests with tracing
app.use(createHttpLogger(logger));

// Middleware for logging errors 
app.use(createErrorLogger(logger));

app.get('/api/devices', (req, res) => {
  // Context already sets in middleware. 
  logger.info('Fetching devices');
  
  // Additional context adding
  logger.setContext({ userId: req.user?.id });
  
  // Request processing logic
  res.json({ devices: [] });
});

app.listen(3000, () => {
  logger.info('Server started on port 3000');
});
```

### Integration with AWS CloudWatch Logs.

To enable logging to AWS CloudWatch, set the following environment variables:

```
AWS_CLOUDWATCH_ENABLED=true
AWS_CLOUDWATCH_GROUP=IoTMonSys-ServiceName
AWS_CLOUDWATCH_STREAM=instance-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

> **Note**: When using `LOG_FORMAT=text` with `AWS_CLOUDWATCH_ENABLED=true`, your local logs will be in text format, but CloudWatch will still receive JSON-formatted logs for better analysis and filtering.

## Logging levels

- `alert`: 0 - Critical errors requiring immediate activities
- `error`: 1 - Errors that disrupt the operation of the application
- `warn`: 2 - Warnings that do not interfere with application operation
- `info`: 3 - Information messages about the application's operation
- `http`: 4 - Logging HTTP requests
- `debug`: 5 - Debugging information

## Log Formats

The logger supports two output formats that can be configured via the `LOG_FORMAT` environment variable:

### Text Format (`LOG_FORMAT=text`)

Human-readable format with colors in console, ideal for development:

```log
2025-06-12 17:14:51:1451 [udp-listener] INFO [trace:abc123] [operation:process-data]: Device data processed successfully
```

In the console, this format is displayed with colors:
- Timestamp: gray
- Service name (`[udp-listener]`): blue
- Logging level (`INFO`): green for info, yellow for warn, red for error
- Context (`[trace:abc123]`): purple
- Message: white

This makes the logs more readable and allows you to quickly highlight important information.

### JSON Format (`LOG_FORMAT=json`)

Machine-readable format, ideal for production and CloudWatch integration:

```json
{
  "timestamp": "2025-06-12T17:14:51.451Z",
  "level": "info",
  "message": "Device data processed successfully",
  "service": "udp-listener",
  "hostname": "server-name",
  "environment": "production",
  "traceId": "abc123",
  "operationId": "process-data",
  "deviceId": "device-456"
}
```

> **Important**: CloudWatch logs are always sent in JSON format regardless of the `LOG_FORMAT` setting to ensure proper parsing and analysis in AWS CloudWatch.

## Testing

The project uses Jest for testing. Tests are located in the `src/__tests__` directory.

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

The tests are structured to validate:
- Core logger functionality
- Context management
- HTTP middleware
- Error handling middleware

### Mocking Dependencies

When writing tests for code that uses this logger, you may need to mock it. Here's an example:

```javascript
// Mock the logger module
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

## Settings

The logging module uses the following environment variables:

| Variable | Description | Default value |
|------------|----------|----------------------|
| NODE_ENV | Environment (development/production) | development |
| LOG_FORMAT | Log format (text/json) | text for development, json for production |
| AWS_CLOUDWATCH_ENABLED | Enable sending logs to CloudWatch | false |
| AWS_CLOUDWATCH_GROUP | CloudWatch log group name | - |
| AWS_CLOUDWATCH_STREAM | CloudWatch log stream name (default: hostname-date) | - |
| AWS_REGION | AWS region | - |
| AWS_ACCESS_KEY_ID | AWS access key ID | - |
| AWS_SECRET_ACCESS_KEY | AWS secret access key | - |
 