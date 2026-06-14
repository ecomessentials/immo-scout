/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.immobilienscout24.de' },
      { protocol: 'https', hostname: '**.ebayimg.com' },
      { protocol: 'https', hostname: '**.immowelt.de' },
      { protocol: 'https', hostname: '**.immonet.de' },
    ],
  },
}

module.exports = nextConfig
