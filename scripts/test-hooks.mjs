// Lets `node --test` load TypeScript the way the app imports it:
// extensionless relative paths and `@/` → src/. Type-only imports are
// stripped by Node before they resolve.

const SRC = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return resolveBare(new URL(specifier.slice(2), SRC).href, context, nextResolve);
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return resolveBare(new URL(specifier, context.parentURL).href, context, nextResolve);
  }
  return nextResolve(specifier, context);
}

async function resolveBare(href, context, nextResolve) {
  if (/\.(tsx?|jsx?|json|mjs|cjs|node)$/.test(href)) {
    return nextResolve(href, context);
  }
  try {
    return await nextResolve(`${href}.ts`, context);
  } catch {
    return nextResolve(`${href}.tsx`, context);
  }
}
