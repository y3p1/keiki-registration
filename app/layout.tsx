import type { ReactNode } from 'react';

export const metadata = {
  title: 'Keiki Coders Registration',
  description: 'Register your kids for after-school classes.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
