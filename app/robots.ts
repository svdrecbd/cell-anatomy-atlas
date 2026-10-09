import type { MetadataRoute } from "next";
import { PUBLIC_SITE_ORIGIN } from "../lib/search-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${PUBLIC_SITE_ORIGIN}/sitemap.xml`
  };
}
