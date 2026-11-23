import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'vm', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'vm', style: 'kebab-case' }],
    },
  },
  {
    // Zard UI: per CLI kopierter Code mit eigenem Präfix `z-`. Anpassungen an die Design Guideline sind mit `VM-Web:` markiert (bei `zard-cli add -o` erneut einpflegen).
    files: ['src/lib/zard/**'],
    rules: {
      // Zard importiert über die Aliase aus components.json. Der Angular-Compiler braucht das für die *.imports.ts-Sammlungen.
      '@nx/enforce-module-boundaries': 'off',
      '@angular-eslint/directive-selector': 'off',
      '@angular-eslint/component-selector': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@angular-eslint/no-input-rename': 'off',
      '@angular-eslint/no-output-rename': 'off',
    },
  },
];
