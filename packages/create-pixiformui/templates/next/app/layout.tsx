import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PIXIFORM_SKELETON_CSS } from 'pixiformui/ssr';
import './globals.css';

export const metadata: Metadata = {
  title: '{{name}}',
  description: 'A secure sign-up form built with PixiFormUI and Next.js.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Styles for the server-rendered placeholder shown until the form mounts. */}
        <style dangerouslySetInnerHTML={{ __html: PIXIFORM_SKELETON_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
