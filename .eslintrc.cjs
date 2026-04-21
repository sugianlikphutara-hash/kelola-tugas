// .eslintrc.cjs (PASTE INI SEMUA)
module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: true 
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['react', 'react-hooks'],
  rules: {
    'no-dupe-keys': 'error',
    'no-dupe-args': 'error', 
    'no-duplicate-imports': 'error',
    'no-unused-vars': 'warn',
    'react/prop-types': 'off', // Skip kalau pake TypeScript
  },
  settings: {
    react: { version: 'detect' },
  },
};