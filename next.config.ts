import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  // Otimizações adicionais para performance
  compiler: {
    // Remover console logs em produção
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    // Otimizações de bundle
    optimizeCss: true,
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      'date-fns',
    ],
  },
};

export default bundleAnalyzer(nextConfig);
