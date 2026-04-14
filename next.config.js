/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' gera um bundle Node.js autossuficiente — necessário para Docker/Coolify.
  output: 'standalone',
  serverExternalPackages: ['@prisma/client'],
};

module.exports = nextConfig;
