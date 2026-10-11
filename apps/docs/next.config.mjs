import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Workspace packages that publish TypeScript sources
  transpilePackages: ['three', '@tscad/kernel', '@tscad/viewer'],
  serverExternalPackages: ['typescript', 'twoslash'],

  // We lint in the ci workflow anyway
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withMDX(config);
