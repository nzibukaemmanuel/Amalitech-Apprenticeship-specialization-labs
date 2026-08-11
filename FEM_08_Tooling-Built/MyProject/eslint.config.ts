import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser },

    rules: {
      'no-unused-vars': 'error',
      eqeqeq: 'warn',
    },
  },

  tseslint.configs.recommended,

  prettier,
]);

//This tells ESLint to check JavaScript and TypeScript files and use recommended rules.