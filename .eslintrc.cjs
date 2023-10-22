/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:prettier/recommended",
    "@remix-run/eslint-config",
    "@remix-run/eslint-config/node",
  ],
};
