import type { NextConfig } from "next";
import { GLOBAL_SECURITY_HEADERS, PII_NO_STORE_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["exceljs"],
  async headers() {
    const piiSources = [
      "/api/submit",
      "/api/submit/:path*",
      "/api/submissions",
      "/api/submissions/:path*",
      "/api/assessor/:path*",
      "/assessor",
      "/assessor/:path*",
      "/drop/:path*",
      "/success",
      "/success/:path*",
    ];
    return [
      {
        source: "/:path*",
        headers: GLOBAL_SECURITY_HEADERS,
      },
      ...piiSources.map((source) => ({
        source,
        headers: PII_NO_STORE_HEADERS,
      })),
    ];
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
