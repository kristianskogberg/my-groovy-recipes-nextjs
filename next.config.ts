import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: supabaseUrl
    ? {
        remotePatterns: [
          new URL(
            "/storage/v1/object/public/recipe-images/**",
            supabaseUrl,
          ),
        ],
      }
    : undefined,
};

export default withNextIntl(nextConfig);
