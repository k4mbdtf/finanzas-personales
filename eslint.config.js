// ESLint (configuración plana). `npm run lint` lo corre; también el CI.
//  * typescript-eslint: errores típicos de TS (sin chequeo de tipos, para que sea rápido;
//    los tipos ya los revisa `tsc`).
//  * react-hooks: solo las reglas clásicas (hooks siempre en el mismo orden y dependencias
//    completas en useEffect/useMemo/useCallback, y también en useQuery). Las reglas del
//    React Compiler que trae la v7 no aplican: la app no usa el compilador.
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'dist-e2e', 'node_modules', 'test-results', 'playwright-report'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': ['error', { additionalHooks: '^useQuery$' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Configuración y pruebas de punta a punta (Node).
    files: ['vite.config.ts', 'playwright.config.ts', 'e2e/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    // Scripts locales y configuración (Node, JS puro).
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['public/sw.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.serviceworker },
  },
)
