// Adds install-to-home-screen tags (iOS + Android) to the exported web build.
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'dist/index.html';
const tags = `
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#1B5E32" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="AUI Athletics" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="description" content="Al Akhawayn University Athletics — teams, facilities, bookings and performance." />
  </head>`;
let html = readFileSync(file, 'utf8');
if (!html.includes('rel="manifest"')) html = html.replace('</head>', tags);
html = html.replace(/<title>.*?<\/title>/, '<title>AUI Athletics</title>');
html = html.replace('width=device-width, initial-scale=1', 'width=device-width, initial-scale=1, viewport-fit=cover');
writeFileSync(file, html);
console.log('PWA tags added to', file);
