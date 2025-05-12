
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LayoutDashboard, Archive, Settings, PackageSearch, FileSpreadsheet, Users, ClipboardList, DollarSign, BookOpenText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen p-4 md:p-8 bg-gradient-to-br from-background to-muted/30">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <LayoutDashboard className="w-10 h-10 text-accent" />
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground title-glow">
            Tableau de Bord Principal
          </h1>
        </div>
        <Link href="/" passHref>
          <Button variant="outline" size="sm" className="group bg-card hover:bg-card/80">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Accueil
          </Button>
        </Link>
      </div>

      <p className="mb-10 text-lg md:text-xl text-muted-foreground max-w-2xl">
        Bienvenue sur votre tableau de bord. Naviguez vers les différentes sections pour gérer votre établissement avec excellence.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard
          title="Gestion des Stocks Entretien"
          description="Gérez vos produits, mouvements de stock, inventaires et bons de commande."
          href="/dashboard/inventory"
          icon={<Archive className="w-8 h-8 text-primary" />}
        />
         <DashboardCard
          title="Avantages en Nature"
          description="Gérez les avantages en nature mensuels via des fichiers Excel et exportez en PDF."
          href="/dashboard/benefits"
          icon={<FileSpreadsheet className="w-8 h-8 text-primary" />}
        />
        <DashboardCard
          title="Suivi des Heures Brigade"
          description="Gérez les heures de votre personnel, absences et générez des relevés PDF."
          href="/dashboard/time-tracking"
          icon={<Users className="w-8 h-8 text-primary" />}
        />
        <DashboardCard
          title="Gestion des Tâches & Problèmes"
          description="Suivez les tâches, problèmes et leur avancement avec un historique daté."
          href="/dashboard/task-management"
          icon={<ClipboardList className="w-8 h-8 text-primary" />}
        />
        <DashboardCard
          title="Gestion des Coûts"
          description="Analysez les coûts de revient mensuels et gérez les dépenses."
          href="/dashboard/cost-management"
          icon={<DollarSign className="w-8 h-8 text-primary" />}
        />
        <DashboardCard
          title="Rubrique Menus"
          description="Planifiez les menus hebdomadaires/mensuels et générez des fiches de commande."
          href="/dashboard/menu-planning"
          icon={<BookOpenText className="w-8 h-8 text-primary" />}
        />
        <DashboardCard
          title="Paramètres"
          description="Configurez les mises en page PDF et autres paramètres de l'application."
          href="/dashboard/settings"
          icon={<Settings className="w-8 h-8 text-primary" />}
        />
      </div>
    </div>
  );
}

interface DashboardCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

function DashboardCard({ title, description, href, icon, disabled }: DashboardCardProps) {
  const cardContent = (
    <Card 
      className={`h-full flex flex-col transition-all duration-300 ease-out group ${
        disabled 
        ? 'opacity-60 cursor-not-allowed bg-card/50' 
        : 'hover:shadow-xl hover:border-primary/70 hover:scale-[1.02] bg-card'
      }`}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </CardTitle>
        </div>
        <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  if (disabled) {
    return <div className="cursor-not-allowed h-full">{cardContent}</div>;
  }

  return <Link href={href} className="h-full block">{cardContent}</Link>;
}
