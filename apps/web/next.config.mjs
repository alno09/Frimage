/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

    return [
      {
        source: "/api/preview/:path*",
        destination: `${apiUrl}/api/preview/:path*`,
      },
      {
        source: "/api/download/:path*",
        destination: `${apiUrl}/api/download/:path*`,
      },
      {
        source: "/upload",
        destination: `${apiUrl}/upload`,
      },
    ];
  },
};

export default nextConfig;
