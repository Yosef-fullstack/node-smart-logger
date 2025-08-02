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
    moduleNameMapper: {
      // Automatically mock winston-cloudwatch in all tests
        '^winston-cloudwatch$': '<rootDir>/src/__tests__/__mocks__/winston-cloudwatch.js'
    },
    moduleDirectories: ['node_modules', 'src/__tests__/__mocks__'],
    testPathIgnorePatterns: ['/node_modules/', '/__mocks__/'],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    collectCoverageFrom: ['src/**/*.{js,ts}'],
    coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
    testTimeout: 10000,
};
