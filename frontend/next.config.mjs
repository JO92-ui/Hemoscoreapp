// FILE: frontend/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow proxying to backend in development — avoids CORS issues if desired.
  // When NEXT_PUBLIC_API_BASE_URL is an external URL, requests go client-side.
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/backend/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
