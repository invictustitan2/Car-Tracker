import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Cloudflare Workers globals
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        addEventListener: 'readonly',
        // Add any other Cloudflare Workers globals as needed
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
