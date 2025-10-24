import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // Configurações experimentais para melhorar hidratação
  experimental: {
    // Otimizar hidratação
    optimizePackageImports: ['@radix-ui/react-dropdown-menu', '@radix-ui/react-collapsible'],
  },
  // Configuração do Turbopack (Next.js 15+) - vazia para compatibilidade
  turbopack: {},
  // Configurações para Prisma (webpack fallback)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        '@prisma/client': 'commonjs @prisma/client',
      });
    }
    return config;
  },
};

export default nextConfig;