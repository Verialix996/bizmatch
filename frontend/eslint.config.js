// Minimal ESLint flat config — dead-code detection only.
// Frontend is ESM + JSX (React Native). The react plugin's jsx-uses-vars
// rule prevents false "unused" reports for components referenced only in JSX.
const globals = require('globals');
const react = require('eslint-plugin-react');

module.exports = [
  {
    files: ['src/**/*.js', 'App.js'],
    ignores: ['node_modules/**', 'dist/**', '.expo/**'],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, __DEV__: 'readonly' },
    },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'no-unused-vars': ['warn', {
        vars: 'all',
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_|^React$',
      }],
      'no-unreachable': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
];
