import winston from 'winston';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import os from 'os';
import 'winston-cloudwatch';
import { v4 as uuidv4 } from 'uuid';

console.log('--- NODE-SMART-LOGGER MODULE LOADED ---');

// Creating a namespace for storing the logging context
const contextStorage = new Map();

const levels = {
    alert: 0,
    error: 1,
    warn: 2,
    info: 3,
    http: 4,
    debug: 5,
};

const colors = {
    alert: 'red',
    error: 'magenta',
    warn: 'yellow',
    info: 'green',
    http: 'cyan',
    debug: 'blue',
};
winston.addColors(colors);

const level = () => {
    const env = process.env.NODE_ENV || 'development';
    return env === 'development' ? 'debug' : 'info';
};

/**
 * Generates a unique identifier for tracking requests
 * @returns {string} Unique identifier
 */
function generateTraceId() {
    return uuidv4();
}

/**
 * Sets the context for the current request or operation.
 * @param {Object} context - Object with context data.
 */
function setContext(context) {
    const currentContext = contextStorage.get('current') || {};
    contextStorage.set('current', { ...currentContext, ...context });
}

/**
 * Gets the current logging context.
 * @returns {Object} Current logging context
 */
function getContext() {
    return contextStorage.get('current') || {};
}

/**
 * Clears the context for the current request
 */
function clearContext() {
    contextStorage.delete('current');
}

/**
 * Sets the log format based on an environment variable
 * @returns {string} 'text' OR 'json'
 */
const logFormat = () => {
    // By default, use text format for development and json for production.
    const defaultFormat = process.env.NODE_ENV === 'development' ? 'text' : 'json';
    // but it possible to customize that via LOG_FORMAT variable
    return process.env.LOG_FORMAT || defaultFormat;
};

/**
 * @param {string} service
 * @param {string|null} customLogDir
 * @param {Object} options - Additional options for the logger
 * @returns {winston.Logger}
 */
function createLoggerFunction(service, customLogDir = null, options = {}) {
    if (!service) {
        service = 'default';
        console.warn('Logger service name not provided, using "default".');
    }

    const env = process.env.NODE_ENV || 'development';
    const hostname = os.hostname();

    let baseDir;
    if (customLogDir && path.isAbsolute(customLogDir)) {
        baseDir = customLogDir;
    } else if (customLogDir) {
        baseDir = path.resolve(process.cwd(), customLogDir);
    } else {
        baseDir = path.resolve(process.cwd(), 'logs');
    }

    const logDir = path.join(baseDir, service);

    if (!fs.existsSync(logDir)) {
        try {
            fs.mkdirSync(logDir, { recursive: true });
        } catch (err) {
            console.error(`Failed to create log directory ${logDir}:`, err);
        }
    }

    const consoleFormat = logFormat() === 'text' ? winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
        winston.format.colorize({ all: true }),
        winston.format.printf(
            (info) => {
                const context = getContext();
                const traceId = context.traceId || '-';
                const requestId = context.requestId || '-';
                return `${info.timestamp} [${service}] ${info.level} [${traceId}] [${requestId}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`;
            }
        )
    ) : winston.format.json();

    const fileFormat = logFormat() === 'text' ? winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
        winston.format.printf(
            (info) => {
                const context = getContext();
                const traceId = context.traceId || '-';
                const requestId = context.requestId || '-';
                const operationId = context.operationId || '-';
                const deviceId = context.deviceId || '-';
                const userId = context.userId || '-';

                let contextStr = `[trace:${traceId}]`;
                if (operationId !== '-') contextStr += ` [op:${operationId}]`;
                if (deviceId !== '-') contextStr += ` [device:${deviceId}]`;
                if (userId !== '-') contextStr += ` [user:${userId}]`;

                return `${info.timestamp} [${info.service}] ${info.level.toUpperCase()} ${contextStr}: ${info.message}${info.stack ? '\n' + info.stack : ''}`;
            }
        )
    ) : winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
        winston.format.json()
    );

    const cloudwatchFormat = winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    );

    const addMetadata = winston.format((info) => {
        const context = getContext();
        info.service = service;
        info.hostname = hostname;
        info.environment = env;

        if (context.traceId) info.traceId = context.traceId;
        if (context.requestId) info.requestId = context.requestId;
        if (context.userId) info.userId = context.userId;
        if (context.deviceId) info.deviceId = context.deviceId;

        return info;
    });

    const transports = [
        new winston.transports.Console({
            format: consoleFormat,
        }),
    ];

    // Adding file transports
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: winston.format.combine(
                addMetadata(),
                fileFormat
            ),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true,
            zippedArchive: true
        })
    );

    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            format: winston.format.combine(
                addMetadata(),
                fileFormat
            ),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true,
            zippedArchive: true
        })
    );

    // Add CloudWatch transport if configured
    if (process.env.AWS_CLOUDWATCH_ENABLED === 'true') {
        try {
            transports.push(
                new winston.transports.CloudWatch({
                    logGroupName: process.env.AWS_CLOUDWATCH_GROUP || `IoTMonSys-${service}`,
                    logStreamName: process.env.AWS_CLOUDWATCH_STREAM || `${hostname}-${new Date().toISOString().slice(0, 10)}`,
                    awsRegion: process.env.AWS_REGION || 'us-east-1',
                    messageFormatter: ({ level, message, ...meta }) => {
                        return JSON.stringify({
                            level,
                            message,
                            ...meta,
                            timestamp: new Date().toISOString()
                        });
                    },
                    format: winston.format.combine(
                        addMetadata(),
                        cloudwatchFormat
                    ),
                })
            );
        } catch (err) {
            console.error('Failed to initialize CloudWatch transport:', err);
        }
    }

    const logger = winston.createLogger({
        level: level(),
        levels,
        format: winston.format.combine(
            winston.format.errors({ stack: true }),
            addMetadata()
        ),
        transports,
        exitOnError: false,
    });

    // Extending the logger with methods for working with context
    logger.setContext = setContext;
    logger.getContext = getContext;
    logger.clearContext = clearContext;
    logger.generateTraceId = generateTraceId;

    // Adding a convenient method for creating an operational context
    logger.withOperationContext = function(contextData = {}) {
        const operationId = contextData.operationId || uuidv4();
        setContext({ ...contextData, operationId });
        return operationId;
    };

    return logger;
}

/**
 * Creates middleware for logging HTTP requests.
 * Using Morgan for logging HTTP-requests, sends output to the provided Winston-logger.
 * @param {winston.Logger} loggerInstance - Instance of Winston logger, built by createLogger.
 * @param {object} [options={}] - Options.
 * @param {'combined' | 'common' | 'dev' | 'short' | 'tiny' | string} [options.format] - Logs Morgan format. By default: 'dev' for development, 'combined' for production.
 * @param {boolean} [options.logOnlyAuthErrors=false] - When flag is true, logs just answers with status code 401/403 (only in production).
 * @returns {Function} - Morgan middleware.
 */
function createHttpLoggerMiddleware(loggerInstance, options = {}) {
    const env = process.env.NODE_ENV || 'development';
    const defaultFormat = env === 'development' ? 'dev' : 'combined';
    const format = options.format || defaultFormat;
    const logOnlyAuthErrors = options.logOnlyAuthErrors || false;

    // Creating middleware to add traceId and requestId to the request
    const traceMiddleware = (req, res, next) => {
        const traceId = req.headers['x-trace-id'] || loggerInstance.generateTraceId();
        const requestId = req.headers['x-request-id'] || loggerInstance.generateTraceId();

        // Set the context for the current request
        loggerInstance.setContext({ traceId, requestId });

        res.setHeader('X-Trace-ID', traceId);
        res.setHeader('X-Request-ID', requestId);

        res.on('finish', () => {
            loggerInstance.clearContext();
        });

        next();
    };

    const morganOptions = {
        stream: {
            write: (message) => {
                const level = logOnlyAuthErrors ? 'warn' : 'http';
                loggerInstance[level](message.trim());
            },
        },
    };

    if (logOnlyAuthErrors && env === 'production') {
        morganOptions.skip = (req, res) => res.statusCode !== 401 && res.statusCode !== 403;
    } else if (logOnlyAuthErrors && env !== 'production') {
        return (req, res, next) => next();
    }

    // Combining middleware for tracing with morgan
    return (req, res, next) => {
        traceMiddleware(req, res, () => {
            morgan(format, morganOptions)(req, res, next);
        });
    };
}

/**
 * Creates middleware for error handling and logging
 * @param {winston.Logger} loggerInstance - Instance of Winston logger
 * @returns {Function} - Error handling middleware
 */
function createErrorLoggerMiddleware(loggerInstance) {
    return (err, req, res, next) => {
        const context = loggerInstance.getContext();
        const traceId = context.traceId || '-';
        const requestId = context.requestId || '-';

        loggerInstance.error(`Error processing request: ${err.message}`, {
            error: err.stack,
            url: req.originalUrl,
            method: req.method,
            body: req.body,
            params: req.params,
            query: req.query,
            traceId,
            requestId
        });

        next(err);
    };
}

const loggerLibrary = {
    createLogger: createLoggerFunction,
    createHttpLoggerMiddleware: createHttpLoggerMiddleware,
    createErrorLoggerMiddleware: createErrorLoggerMiddleware,
    setContext,
    getContext,
    clearContext,
    generateTraceId
};

export const createHttpLogger = loggerLibrary.createHttpLoggerMiddleware;
export const createLogger = loggerLibrary.createLogger;
export const createErrorLogger = loggerLibrary.createErrorLoggerMiddleware;
export const getLoggerContext = loggerLibrary.getContext;
export const setLoggerContext = loggerLibrary.setContext;
export const clearLoggerContext = loggerLibrary.clearContext;
export const generateLoggerTraceId = loggerLibrary.generateTraceId;
export default loggerLibrary;