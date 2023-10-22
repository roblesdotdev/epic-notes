/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
    'plugin:tailwindcss/recommended',
    '@remix-run/eslint-config',
    '@remix-run/eslint-config/node',
  ],
}
