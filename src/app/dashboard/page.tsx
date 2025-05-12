import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8 text-center">
      <LayoutDashboard className="w-16 h-16 mb-6 text-accent" />
      <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-foreground title-glow">
        Tableau de Bord
      </h1>
      <p className="mb-10 text-lg md:text-xl text-muted-foreground max-w-md">
        Bienvenue sur votre tableau de bord. Cet espace est en cours de construction pour vous offrir une gestion d'excellence.
      </p>
      <Link href="/" passHref>
        <Button variant="outline" size="lg" className="group">
          <ArrowLeft className="mr-2 h-5 w-5 transition-transform duration-300 group-hover:-translate-x-1" />
          Retour à l'accueil
        </Button>
      </Link>
    </div>
  );
}
