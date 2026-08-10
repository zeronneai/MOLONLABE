import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Both origins render: legacy Cloudinary catalog shots and new
    // Supabase Storage uploads. next/image optimizes either.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dsprn0ew4/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
