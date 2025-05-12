import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Playfair_Display } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const playfairDisplay = Playfair_Display({
  variable: '--font-playfair-display',
  subsets: ['latin'],
  weight: ['400', '700', '900'], 
});

export const metadata: Metadata = {
  title: 'Excellence Dashboard',
  description: 'Application de gestion par l’excellence.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body 
        className={cn(
          geistSans.variable, 
          geistMono.variable, 
          playfairDisplay.variable, 
          "font-sans antialiased bg-background text-foreground"
        )}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
