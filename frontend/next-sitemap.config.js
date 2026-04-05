/** @type {import('next-sitemap').IConfig} */
const config = {
  // Replace with your production domain via the SITE_URL env var.
  // The env var is set in .env.production and injected at build time.
  siteUrl: process.env.SITE_URL || "https://yourdomain.com",

  // Write the sitemap(s) to the /public directory so they're served
  // as static files by the Next.js server without any API route.
  outDir: "public",

  // Generate a robots.txt alongside the sitemap
  generateRobotsTxt: true,

  // Only public-facing pages go in the sitemap.
  // Auth, dashboard, admin, and user-specific pages are excluded.
  exclude: [
    "/dashboard",
    "/dashboard/*",
    "/analysis/*",
    "/history",
    "/settings",
    "/admin",
    "/admin/*",
    "/maintenance",
    "/verify-email",
    "/reset-password",
    "/forgot-password",
  ],

  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        // Public marketing/auth pages
        allow: ["/", "/pricing", "/login", "/register"],
        // Private app pages
        disallow: [
          "/dashboard",
          "/analysis",
          "/history",
          "/settings",
          "/admin",
          "/api",
          "/maintenance",
        ],
      },
    ],
    // Link to the generated sitemap from robots.txt
    additionalSitemaps: [],
  },

  // Page-level priority overrides
  priority: 0.7,
  changefreq: "weekly",

  transform: async (config, path) => {
    const priorityMap = {
      "/": 1.0,
      "/pricing": 0.9,
      "/login": 0.6,
      "/register": 0.7,
    };

    return {
      loc: path,
      changefreq: config.changefreq,
      priority: priorityMap[path] ?? config.priority,
      lastmod: new Date().toISOString(),
    };
  },
};

module.exports = config;
