import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/settings", "/plans/", "/share/", "/compare"] }],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
