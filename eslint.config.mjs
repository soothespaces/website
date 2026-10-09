import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const pageWidth = [
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
];

const noRawButton = {
  selector: "JSXOpeningElement[name.name='button']",
  message:
    "Use Button from @/components/ui/button. A Radix trigger can take asChild and render Button.",
};

const noRawSvg = {
  selector: "JSXOpeningElement[name.name='svg']",
  message: "Icons come from @/components/ui/icons. The logo is the only other SVG.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/components/ui/button.tsx",
      "src/components/ui/icons.tsx",
      "src/components/logo.tsx",
    ],
    rules: {
      "no-restricted-syntax": ["error", ...pageWidth, noRawButton, noRawSvg],
    },
  },
  {
    files: ["src/components/ui/button.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...pageWidth, noRawSvg],
    },
  },
  {
    files: ["src/components/ui/icons.tsx", "src/components/logo.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...pageWidth, noRawButton],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/icons.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@radix-ui/react-icons",
              message: "Import icons from @/components/ui/icons.",
            },
            {
              name: "lucide-react",
              message:
                "Icons come from @/components/ui/icons. Do not add another icon library.",
            },
          ],
          patterns: [
            {
              group: ["@heroicons/*", "react-icons", "react-icons/*"],
              message:
                "Icons come from @/components/ui/icons. Do not add another icon library.",
            },
          ],
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
