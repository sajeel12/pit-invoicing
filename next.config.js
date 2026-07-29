/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native module; keep it as a runtime require instead of
  // letting Next.js try to bundle its .node binary.
  serverExternalPackages: ["better-sqlite3"],
};

module.exports = nextConfig;
