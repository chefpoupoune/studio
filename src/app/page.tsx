import Image from 'next/image';
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
          Excellence Dashboard
        </h1>

        <div 
          className="relative w-full aspect-[16/10] md:aspect-[16/9] max-w-2xl mx-auto rounded-xl overflow-hidden shadow-2xl border-2 border-transparent hover:border-accent transition-all duration-300 group"
          data-ai-hint="restaurant interior elegant"
        >
          <Image
            src="https://picsum.photos/seed/restaurantExcellence/1200/750"
            alt="Image illustrant l'excellence en restauration"
            layout="fill"
            objectFit="cover"
            className="transform group-hover:scale-105 transition-transform duration-500 ease-out"
            priority
          />
           <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-70 group-hover:opacity-50 transition-opacity duration-300"></div>
        </div>
        
        <Link href="/dashboard" passHref>
          <Button 
            size="lg" 
            className="text-lg px-8 py-6 rounded-lg shadow-lg hover:shadow-accent/30 transform hover:scale-105 transition-all duration-300 ease-out group"
          >
            Accéder au tableau de bord
            <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        </Link>
      </div>
    </main>
  );
}
