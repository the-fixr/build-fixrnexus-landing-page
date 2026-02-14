/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async redirects() {
    return [
      {
        source: '/docs',
        destination: 'https://agent.fixr.nexus/docs',
        permanent: true,
      },
      {
        source: '/llms.txt',
        destination: 'https://agent.fixr.nexus/llms.txt',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
