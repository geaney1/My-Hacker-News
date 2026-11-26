// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    // Lints the templates written inside TypeScript files too.
    processor: angular.createProcessor(),
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],

      // The project rules in CLAUDE.md.
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      // An underscore is not a letter: it marks a value that is not used.
      'id-length': ['error', { min: 2, properties: 'never', exceptions: ['_'] }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: null,
          leadingUnderscore: 'forbid',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: ":function[returnType.typeAnnotation.type='TSVoidKeyword']",
          message: 'Leave out the void return type: it is inferred.',
        },
        {
          selector: ":function[async=true][returnType.typeAnnotation.typeName.name='Promise']",
          message: 'Leave out the Promise return type of an async function: it is inferred.',
        },
      ],

      // A leading underscore marks a parameter that is only there to hold its position.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
