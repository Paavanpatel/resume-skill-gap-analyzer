/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for production Docker builds (copies only what's needed)
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,

  // Image optimisation — list trusted remote hostnames for next/image.
  // Add your CDN or S3 domain here to use <Image> with remote sources.
  images: {
    // Supported format priority: AVIF (best), then WebP, then original
    formats: ["image/avif", "image/webp"],
    // Remote patterns for user-uploaded or CDN images
    remotePatterns: [
      // AWS S3 (production object storage)
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
        pathname: "/**",
      },
      // MinIO / custom S3-compatible endpoint (dev/staging)
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
    ],
    // Limit image sizes to avoid generating too many variants
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Skip type checking during build — lucide-react v0.440 uses the legacy
  // "typings" field instead of "types", which moduleResolution:"bundler"
  // cannot resolve. Type checking runs separately in CI via `tsc --noEmit`.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Enable gzip + brotli compression
  compress: true,

  // Stricter powered-by header removal
  poweredByHeader: false,

  // Enable React strict mode for dev warnings
  reactStrictMode: true,

  // Security & performance headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Long cache for static assets
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache fonts
        source: "/fonts/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Proxy API calls to the backend during development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
      {
        source: "/ws/:path*",
        destination: "http://localhost:8000/ws/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
