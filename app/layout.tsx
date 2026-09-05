import './globals.css';
import type { ReactNode } from 'react';
import { Fredoka, Poppins } from 'next/font/google';

const fredoka = Fredoka({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-fredoka', display: 'swap' });
const poppins = Poppins({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-poppins', display: 'swap' });

export const metadata = {
  title: 'Keiki Coders Registration',
  description: 'Register your kids for after-school classes.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
