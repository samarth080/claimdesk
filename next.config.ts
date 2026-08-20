import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // This repository contains another app at its root. Keep ClaimDesk's build
    // graph and file watching scoped to this project directory.
    root: process.cwd(),
  },
};

export default nextConfig;
