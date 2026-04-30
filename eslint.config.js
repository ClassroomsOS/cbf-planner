import js from '@eslint/js'
import globals from 'globals'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  // Archivos a ignorar
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      'supabase/**',
      '**/__snapshots__/**',
    ],
  },

  // Configuración base JS
  js.configs.recommended,

  // Configuración React
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // ── React core ───────────────────────────────────────────────────────
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',       // Vite no requiere import React
      'react/prop-types': 'off',              // Sin TypeScript, prop-types es opcional
      'react/no-unescaped-entities': 'warn',  // Ruido en texto español con apóstrofes

      // ── React Hooks — estos son bugs reales, no style ────────────────────
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ── React Refresh (HMR) ──────────────────────────────────────────────
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // ── Calidad general ──────────────────────────────────────────────────
      'no-unused-vars': ['warn', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-undef': 'error',
      'no-duplicate-imports': 'error',

      // ── Seguridad ────────────────────────────────────────────────────────
      'no-eval': 'error',
      'no-implied-eval': 'error',

      // ── Buenas prácticas ─────────────────────────────────────────────────
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },

  // Archivos de test — reglas más relajadas
  {
    files: ['src/**/*.test.{js,jsx}'],
    rules: {
      'no-console': 'off',
    },
  },
]
