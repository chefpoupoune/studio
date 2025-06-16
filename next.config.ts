
import type {NextConfig} from 'next';
import path from 'path'; // Import path module

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Added for better compatibility with containerized deployments
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false, // Set to true if this is a permanent change
      },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add custom aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/components': path.resolve(__dirname, 'src/components'),
      '@/hooks': path.resolve(__dirname, 'src/hooks'),
      '@/lib': path.resolve(__dirname, 'src/lib'),
      '@/config': path.resolve(__dirname, 'src/config'),
      // You can add more aliases here if needed, e.g.,
      // '@/app': path.resolve(__dirname, 'src/app'),
    };
    return config;
  },
};

export default nextConfig;
