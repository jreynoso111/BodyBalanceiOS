import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Buddy Balance | Shared Balance Tracking</title>
        <meta name="theme-color" content="#6366F1" />
        <meta
          name="description"
          content="Buddy Balance helps friends, families, and trusted contacts track shared balances, payments, and lending history with clarity."
        />
        <meta property="og:title" content="Buddy Balance" />
        <meta
          property="og:description"
          content="Shared balance tracking for friends, families, and trusted contacts."
        />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Buddy Balance" />
        <meta name="apple-mobile-web-app-title" content="Buddy Balance" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
html {
  background: #f6f8ff;
}
body {
  background-color: #f6f8ff;
  color: #0f172a;
}
a {
  color: inherit;
  text-decoration: none;
}`;
