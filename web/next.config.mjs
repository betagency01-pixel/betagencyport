/** Public website: the designed pages are static files in /public, the API lives in /app/api. */
const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];
export default {
  poweredByHeader: false,
  async rewrites() {
    return { beforeFiles: [
      { source: '/', destination: '/index.html' },
      { source: '/privacy', destination: '/privacy.html' },
    ] };
  },
  async headers() {
    return [
      { source: '/:path*', headers: security },
      { source: '/:file(ebdcafe.mp4|ebdcafe-poster.jpg|favicon.svg|og.jpg)', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] },
    ];
  },
};
