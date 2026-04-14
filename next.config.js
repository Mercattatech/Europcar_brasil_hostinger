/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' gera um bundle Node.js autossuficiente — necessário para Docker/Coolify.
  output: 'standalone',
  // Next.js 14: usa experimental.serverComponentsExternalPackages (renomeado para serverExternalPackages no Next.js 15)
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
};

module.exports = nextConfig;
