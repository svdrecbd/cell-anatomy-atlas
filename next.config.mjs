/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  htmlLimitedBots: /.*/,
  devIndicators: false,
  webpack(configuration, { isServer }) {
    if (isServer) configuration.externals.push("cloudflare:workers");
    return configuration;
  },
};

export default nextConfig;
