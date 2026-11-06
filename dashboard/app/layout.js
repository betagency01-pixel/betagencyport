import './globals.css';

export const metadata = {
  title: { default: 'BeT Dashboard', template: '%s · BeT Dashboard' },
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
