/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['@heroicons/react']
  },
};

module.exports = nextConfig;
