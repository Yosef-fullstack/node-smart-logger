/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            useESM: false,
        }],
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    // Автоматически мокировать winston-cloudwatch во всех тестах
    moduleNameMapper: {
        '^winston-cloudwatch$': '<rootDir>/src/__tests__/__mocks__/winston-cloudwatch.js'
    },
    // Указываем директорию с моками
    moduleDirectories: ['node_modules', 'src/__tests__/__mocks__'],
    // Исключаем директорию __mocks__ из тестов
    testPathIgnorePatterns: ['/node_modules/', '/__mocks__/']
};
