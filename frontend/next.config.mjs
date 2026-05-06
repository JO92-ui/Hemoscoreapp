// FILE: frontend/next.config.mjs
/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_EXPORT === "1";

const nextConfig = {
  reactStrictMode: true,
  // Static export mode: used when building the standalone desktop exe.
  // Rewrites are not supported with static export.
  ...(isExport
    ? { output: "export", trailingSlash: true }
    : {
        async rewrites() {
          const apiBase =
            process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
          return [
            {
              source: "/api/backend/:path*",
              destination: `${apiBase}/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
