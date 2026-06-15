/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.ebayimg.com' },
      { protocol: 'https', hostname: '**.kleinanzeigen.de' },
      { protocol: 'https', hostname: '**.immowelt.de' },
    ],
  },
}

module.exports = nextConfig
