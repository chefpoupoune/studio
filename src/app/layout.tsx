
import type { Metadata } from 'next';
import { Geist } from 'next/font/google'; // Keep only Geist Sans if Geist_Mono is not explicitly used for body
import { Playfair_Display } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  // Removed Geist_Mono from direct application to body if not primary mono
});

// If Geist_Mono is needed for specific components, it can be imported and used there
// or added as a variable like '--font-mono' if tailwind.config.ts is set up for it.
// For simplicity, if it's not the main mono, we don't force it on the body.

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
    // Apply dark theme by default to html tag if needed, or manage via JS in ApplicationSettingsManager
    // For now, assuming system preference or a JS-managed theme
    <html lang="fr" suppressHydrationWarning> 
      <body 
        className={cn(
          geistSans.variable, 
          playfairDisplay.variable, 
          "font-sans antialiased bg-background text-foreground" // Removed geistMono.variable if not primary mono for body
        )}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
