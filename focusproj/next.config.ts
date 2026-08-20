import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the root explicitly instead of letting Turbopack walk up the
    // filesystem for a lockfile — it was picking up a stray
    // package-lock.json in C:\Users\amaan, outside this git repo.
    root: import.meta.dirname,
  },
};

export default nextConfig;
