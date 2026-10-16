// Production answers on several hostnames (soothespaces.vercel.app plus
// Vercel's team and git-branch aliases). Everything in production should
// live on one of them, so sign-in, cookies and shared links agree.
//
// VERCEL_PROJECT_PRODUCTION_URL is Vercel's shortest production domain
// (soothespaces.vercel.app, or a custom domain once one is added). It is
// only used in production: previews and localhost keep their own origin.
export function canonicalProductionHost(): string | null {
  if (process.env.VERCEL_ENV !== "production") return null;
  return process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null;
}
