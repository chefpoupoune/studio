
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
    // Ensure resolve.alias exists
    config.resolve.alias = config.resolve.alias || {};

    // Add custom aliases
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    config.resolve.alias['@/components'] = path.resolve(__dirname, 'src/components');
    config.resolve.alias['@/hooks'] = path.resolve(__dirname, 'src/hooks');
    config.resolve.alias['@/lib'] = path.resolve(__dirname, 'src/lib');
    config.resolve.alias['@/config'] = path.resolve(__dirname, 'src/config');
    // You can add more aliases here if needed, e.g.,
    // config.resolve.alias['@/app'] = path.resolve(__dirname, 'src/app');
    
    return config;
  },
};

export default nextConfig;

