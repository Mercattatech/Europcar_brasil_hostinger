/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' gera um bundle Node.js autossuficiente — necessário para Docker/Coolify.
  output: 'standalone',
  // Next.js 14: usa experimental.serverComponentsExternalPackages (renomeado para serverExternalPackages no Next.js 15)
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Evita que erros de tipo bloqueiem o build em produção
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
