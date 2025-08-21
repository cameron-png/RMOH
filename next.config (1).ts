
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
        hostname: 'uploadedimagestestbed.giftbit.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_SMTP_CONFIGURED: (!!process.env.SMTP_HOST && !!process.env.SMTP_PORT && !!process.env.SMTP_USER && !!process.env.SMTP_PASS && !!process.env.SMTP_FROM_EMAIL).toString(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // Default is 1mb, increase for image uploads
      // Set a longer timeout for server actions
      serverActionsTimeout: 120000, // 2 minutes
    },
  },
};

export default nextConfig;
