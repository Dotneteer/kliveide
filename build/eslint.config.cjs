const tsParser = require("@typescript-eslint/parser");
const reactHooks = require("eslint-plugin-react-hooks");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "out/**",
      "artifacts/**",
      "docs/.next/**",
      "coverage/**"
    ]
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}", "test/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      "react-hooks": reactHooks
    },
    rules: {
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
];
