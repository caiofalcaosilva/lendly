const withNextIntl = require('next-intl/plugin')('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      // Local dev only: without R2 configured, the API serves uploads
      // over plain http from API_PUBLIC_URL (default localhost:8000, or a
      // LAN IP when testing from a phone) — production always uses R2's
      // https URL, covered by the rule above.
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: '192.168.*.*' },
    ],
  },
}
module.exports = withNextIntl(nextConfig)
