module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'boundaries'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  settings: {
    'boundaries/elements': [
      { type: 'lib', pattern: 'src/lib/*' },
      { type: 'module', pattern: 'src/modules/*', mode: 'folder' },
      { type: 'app', pattern: 'src/{server,index}.ts', mode: 'file' },
    ],
  },
  rules: {
    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      { allowExpressions: true },
    ],
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'off',

    // Module boundaries: cross-module imports must go through index.ts
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          { from: 'app', allow: ['lib', 'module'] },
          { from: 'lib', allow: ['lib'] },
          {
            from: 'module',
            allow: [
              'lib',
              ['module', { specifier: '*/index' }],
            ],
          },
        ],
      },
    ],

    // General
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-throw-literal': 'error',
    eqeqeq: ['error', 'always'],
    'prefer-const': 'error',
  },
  ignorePatterns: ['dist', 'node_modules', 'migrations', '*.config.ts'],
};
