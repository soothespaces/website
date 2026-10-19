import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const root = path.resolve(import.meta.dirname, "../src");

function resolveFile(absolute) {
  const candidates = [absolute, `${absolute}.ts`, `${absolute}.tsx`, path.join(absolute, "index.ts")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const hit = resolveFile(path.join(root, specifier.slice(2)));
    if (hit) return { url: hit, shortCircuit: true };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const parent = fileURLToPath(context.parentURL);
    if (parent.includes(`${path.sep}src${path.sep}`)) {
      const hit = resolveFile(path.resolve(path.dirname(parent), specifier));
      if (hit) return { url: hit, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".tsx")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: fileURLToPath(url),
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
