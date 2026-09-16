import eslint from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

const commonGlobals = {
  console: "readonly",
  process: "readonly",
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dist-hosted/**",
      "**/site/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.venv/**",
      "**/coverage/**",
      "**/.vite/**",
    ],
  },
  eslint.configs.recommended,
  {
    languageOptions: {
      globals: commonGlobals,
    },
  },
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: commonGlobals,
      parser: tseslint.parser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.ts", "apps/*/vite.config.ts", "types/*/index.d.ts"],
        },
      },
    },
    rules: {
      complexity: ["error", { max: 10, variant: "classic" }],
      "sonarjs/cognitive-complexity": ["error", 15],
      "max-depth": ["warn", 3],
      "max-params": ["error", { max: 3 }],
      "max-lines-per-function": ["error", { max: 140, skipBlankLines: true, skipComments: true }],
    },
  },
);
