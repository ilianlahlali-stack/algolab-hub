import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages entièrement dynamiques (données par utilisateur) : pas besoin du cache de composants.
  cacheComponents: false,
};

export default nextConfig;
