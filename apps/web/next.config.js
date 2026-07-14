/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/v1/:path*', // Proxy to Python API
      },
    ]
  },
};

module.exports = nextConfig;
