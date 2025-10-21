import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Fix for multiple lockfiles warning
  outputFileTracingRoot: path.join(__dirname),
}

export default nextConfig
