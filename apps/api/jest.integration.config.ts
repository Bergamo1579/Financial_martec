import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'test/integration/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/integration/setup.ts'],
  moduleNameMapper: {
    '^@financial-martec/contracts$': '<rootDir>/../../packages/contracts/src',
    '^@financial-martec/contracts/(.*)$': '<rootDir>/../../packages/contracts/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

export default config;
