// Minimal ESLint flat config — dead-code detection only (no style opinions).
// Backend is CommonJS Node.
const globals = require('globals');

module.exports = [
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', {
        vars: 'all',
        args: 'after-used',
        argsIgnorePattern: '^_|^next$|^req$|^res$',
        varsIgnorePattern: '^_',
      }],
      'no-unreachable': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
];
