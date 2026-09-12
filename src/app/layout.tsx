import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/contexts/AuthContext'; // Mise à jour de l'import

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
  description: 'Application de gestion de la cuisine de Brebières par l’excellence.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className="dark"> 
      <body 
        className={cn(
          inter.variable, 
          playfairDisplay.variable, 
          "font-sans antialiased bg-background text-foreground"
        )}
      >
        <AuthProvider> {/* Remplacement par AuthProvider */}
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
