import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Workspace packages that publish TypeScript sources
  transpilePackages: ['three', '@tscad/viewer'],
  serverExternalPackages: ['typescript', 'twoslash'],

  // The command pages moved from /docs/<command> to /docs/cli/<command>.
  async redirects() {
    return [
      {
        source: '/docs/:command(analyze|dev|export|plugins)',
        destination: '/docs/cli/:command',
        permanent: true,
      },
    ];
  },

  // We lint in the ci workflow anyway
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withMDX(config);
