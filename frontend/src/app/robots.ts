import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

/** Index login only; keep landing + authenticated app out of search. */
export default function robots(): MetadataRoute.Robots {
  const origin = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      disallow: "/",
      allow: ["/login", "/fr/login"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
