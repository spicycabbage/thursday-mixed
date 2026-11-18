/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['@heroicons/react'],
    agentUpgrade: 'security',
  },
};

module.exports = nextConfig;
