
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const inter = Inter({
  variable: '--font-sans',
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
    <html lang="fr" suppressHydrationWarning> 
      <body 
        className={cn(
          inter.variable, 
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
