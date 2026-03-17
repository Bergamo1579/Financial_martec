import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { baseIgnores } from '../../packages/config/eslint/base.js';

export default tseslint.config(
  {
    ignores: [...baseIgnores],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    },
  },
);
