import type { MetadataRoute } from "next";

// QA-073: a real robots file. Admin, account and sign-in pages also set
// noindex on their own HTML.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admins-only", "/auth/", "/api/", "/settings", "/login", "/styleguide"],
    },
  };
}
