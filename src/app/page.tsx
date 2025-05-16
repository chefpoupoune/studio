
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CurrentDate } from '@/components/current-date';
import { ArrowRight } from 'lucide-react';
// Removed Image import as it's no longer used

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 selection:bg-accent selection:text-accent-foreground">
      {/* Section 1: Title and Date (Top-ish) */}
      <div className="w-full text-center pt-12 sm:pt-16 md:pt-20">
        <h1 
          className="text-5xl sm:text-6xl md:text-7xl font-serif font-bold text-foreground animate-title-fade-in title-glow"
        >
          Gestion par l'excellence
        </h1>
        <div className="mt-4 md:mt-6"> {/* Add margin top for spacing */}
          <CurrentDate />
        </div>
      </div>

      {/* Section 2: Homepage Image - REMOVED */}
      {/* 
      <div className="my-8 md:my-12">
        <Image
          src="https://placehold.co/600x400.png" 
          alt="Excellence in Restaurant Management"
          width={600}
          height={400}
          className="rounded-lg shadow-lg"
          data-ai-hint="restaurant management" 
        />
      </div>
      */}

      {/* Section 3: Button (Centered in remaining space) */}
      {/* This outer div takes up remaining vertical space and centers its child vertically and horizontally */}
      <div className="flex-grow flex flex-col items-center justify-center w-full pb-12"> 
        <div className="text-center space-y-6 md:space-y-8 py-8"> {/* Container for button, with vertical spacing and padding */}
          <Link href="/dashboard" passHref>
            <Button 
              size="lg" 
              className="text-lg px-8 py-6 rounded-lg shadow-lg hover:shadow-accent/30 transform hover:scale-105 transition-all duration-300 ease-out group"
            >
              Bon courage
              <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

