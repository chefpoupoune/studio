
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CurrentDate } from '@/components/current-date';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 selection:bg-accent selection:text-accent-foreground">
      <div className="text-center space-y-8 md:space-y-12 max-w-3xl w-full">
        <CurrentDate />

        <h1 
          className="text-5xl sm:text-6xl md:text-7xl font-serif font-bold text-foreground animate-title-fade-in title-glow"
        >
          Gestion par l'excellence
        </h1>
        
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
    </main>
  );
}

