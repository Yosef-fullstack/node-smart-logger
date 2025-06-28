// Импортируем функции для тестирования с правильными именами
const { generateLoggerTraceId, setLoggerContext, getLoggerContext, clearLoggerContext } = require('../index.ts');

describe('Context functions', () => {
    afterEach(() => {
        clearLoggerContext();
    });

    test('generateLoggerTraceId should return a valid UUID', () => {
        const traceId = generateLoggerTraceId();
        expect(typeof traceId).toBe('string');
        expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    test('setLoggerContext should add context data', () => {
        setLoggerContext({ userId: '123' });
        const context = getLoggerContext();
        expect(context).toHaveProperty('userId', '123');
    });

    test('setLoggerContext should merge with existing context', () => {
        setLoggerContext({ userId: '123' });
        setLoggerContext({ requestId: 'abc' });
        const context = getLoggerContext();
        expect(context).toEqual({ userId: '123', requestId: 'abc' });
    });

    test('getLoggerContext should return empty object if no context set', () => {
        const context = getLoggerContext();
        expect(context).toEqual({});
    });

    test('clearLoggerContext should remove all context data', () => {
        setLoggerContext({ userId: '123' });
        clearLoggerContext();
        const context = getLoggerContext();
        expect(context).toEqual({});
    });
});