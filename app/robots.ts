import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: 'https://fixr.nexus/sitemap.xml',
    host: 'https://fixr.nexus',
  };
}
