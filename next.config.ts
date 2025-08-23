import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
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
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api-testbed.giftbit.com',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'uploadedimagestestbed.giftbit.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Referrer-Policy',
            value: 'no-referrer-when-downgrade',
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // Default is 1mb, increase for image uploads
      // Set a longer timeout for server actions
      serverActionsTimeout: 120000, // 2 minutes
    },
  },
  // Make the API key available on the server-side
  serverRuntimeConfig: {
    giftbitApiKey: process.env.GIFTBIT_API_KEY,
  },
};

export default nextConfig;
