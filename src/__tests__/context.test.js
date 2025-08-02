const { generateLoggerTraceId, setLoggerContext, getLoggerContext, clearLoggerContext } = require('../index.ts');

const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

// Helper function to run tests in AsyncLocalStorage context
function runInAsyncContext(context, fn) {
  return new Promise((resolve) => {
    asyncLocalStorage.run(context, () => {
      const result = fn();
      resolve(result);
    });
  });
}

describe('Context functions', () => {
    afterEach(() => {
        clearLoggerContext();
    });

    test('generateLoggerTraceId should return a valid UUID', () => {
        const traceId = generateLoggerTraceId();
        expect(typeof traceId).toBe('string');
        expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
    test('setLoggerContext should add context data', async () => {
        await runInAsyncContext({}, () => {
            setLoggerContext({ userId: '123' });
            const context = getLoggerContext();
            expect(context).toHaveProperty('userId', '123');
        });
    });
    test('setLoggerContext should merge with existing context', async () => {
        await runInAsyncContext({}, () => {
            setLoggerContext({ userId: '123' });
            setLoggerContext({ requestId: 'abc' });
            const context = getLoggerContext();
            expect(context).toEqual({ userId: '123', requestId: 'abc' });
        });
    });
    test('getLoggerContext should return empty object if no context set', async () => {
        await runInAsyncContext({}, () => {
            const context = getLoggerContext();
            expect(context).toEqual({});
        });
    });
    test('clearLoggerContext should remove all context data', async () => {
        await runInAsyncContext({ userId: '123' }, () => {
            clearLoggerContext();
            const context = getLoggerContext();
            expect(context).toEqual({});
        });
    });
});