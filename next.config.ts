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
  // Suprimir warnings de hidratação para componentes Radix UI
  onDemandEntries: {
    // Período de cache para páginas em desenvolvimento
    maxInactiveAge: 25 * 1000,
    // Número de páginas que devem ser mantidas simultaneamente
    pagesBufferLength: 2,
  },
  // Configurações experimentais para melhorar hidratação
  experimental: {
    // Otimizar hidratação
    optimizePackageImports: ['@radix-ui/react-dropdown-menu', '@radix-ui/react-collapsible'],
  }
};

export default nextConfig;