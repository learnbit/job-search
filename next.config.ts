import type { NextConfig } from "next";

interface WebpackConfigWithResolve {
  readonly resolve: {
    extensionAlias?: Record<string, readonly string[]>;
  };
}

const nextConfig: NextConfig = {
  agentRules: false,
  webpack(config: WebpackConfigWithResolve) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };

    return config;
  },
};

export default nextConfig;
