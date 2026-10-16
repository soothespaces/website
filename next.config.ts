import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // /admin/photos uploads photos through a Server Action. The browser
      // shrinks them to under 3.8 MB first (src/features/admin-photos);
      // Vercel caps request bodies at 4.5 MB.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
