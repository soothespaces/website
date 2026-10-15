import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/max-w-(?!64\\b|full\\b|none\\b|min\\b|max\\b|fit\\b|\\[min\\(16rem,100%\\)\\])/]",
          message:
            "Page width is PageWidth (--page-width). Do not set another max-width. max-w-64 and max-w-[min(16rem,100%)] are only for the space chip.",
        },
        {
          selector:
            "TemplateElement[value.raw=/max-w-(?!64\\b|full\\b|none\\b|min\\b|max\\b|fit\\b|\\[min\\(16rem,100%\\)\\])/]",
          message:
            "Page width is PageWidth (--page-width). Do not set another max-width. max-w-64 and max-w-[min(16rem,100%)] are only for the space chip.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
