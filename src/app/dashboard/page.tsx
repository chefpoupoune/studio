
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Archive, Settings, FileSpreadsheet, Users, ClipboardList, DollarSign, BookOpenText, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WeeklyMenuSummary from './components/WeeklyMenuSummary';
import OngoingTasksSummary from './components/OngoingTasksSummary';
import { CurrentDate } from '@/components/current-date';


export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground title-glow mb-1">
          Tableau de Bord Principal
        </h1>
        <CurrentDate />
      </div>

      <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <WeeklyMenuSummary />
        </div>
        <div className="lg:col-span-1">
          <OngoingTasksSummary />
        </div>
        {/* Placeholder pour une future 3ème "bulle" si besoin */}
        {/* <div className="lg:col-span-1 bg-card rounded-lg shadow-lg p-6"> <p className="text-muted-foreground">Autre info...</p></div> */}
      </div>

      <p className="mb-6 text-md text-muted-foreground max-w-2xl">
        Naviguez vers les différentes sections pour gérer votre établissement.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <DashboardCard
          title="Gestion des Stocks Entretien"
          description="Gérez produits, stocks, inventaires et commandes."
          href="/dashboard/inventory"
          icon={<Archive className="w-7 h-7 text-primary" />}
        />
         <DashboardCard
          title="Avantages en Nature"
          description="Suivi mensuel des avantages et export PDF."
          href="/dashboard/benefits"
          icon={<FileSpreadsheet className="w-7 h-7 text-primary" />}
        />
        <DashboardCard
          title="Suivi des Heures Brigade"
          description="Gérez heures, absences et générez des relevés."
          href="/dashboard/time-tracking"
          icon={<Users className="w-7 h-7 text-primary" />}
        />
        <DashboardCard
          title="Gestion des Tâches & Problèmes"
          description="Suivez tâches, problèmes et leur avancement."
          href="/dashboard/task-management"
          icon={<ClipboardList className="w-7 h-7 text-primary" />}
        />
        <DashboardCard
          title="Gestion des Coûts"
          description="Analysez les coûts de revient et gérez les dépenses."
          href="/dashboard/cost-management"
          icon={<DollarSign className="w-7 h-7 text-primary" />}
        />
        <DashboardCard
          title="Planification des Menus"
          description="Planifiez les menus et générez des fiches de commande."
          href="/dashboard/menu-planning"
          icon={<BookOpenText className="w-7 h-7 text-primary" />}
        />
         <DashboardCard
          title="PMS"
          description="Gérez nettoyage, températures et livraisons."
          href="/dashboard/pms"
          icon={<ShieldCheck className="w-7 h-7 text-primary" />}
        />
        <DashboardCard
          title="Paramètres"
          description="Configurez les PDF et paramètres de l'app."
          href="/dashboard/settings"
          icon={<Settings className="w-7 h-7 text-primary" />}
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
        : 'hover:shadow-xl hover:border-primary/50 hover:scale-[1.01] bg-card'
      }`}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2.5">
        <div className="space-y-0.5">
          <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </CardTitle>
        </div>
        <div className="p-1.5 bg-primary/10 rounded-md group-hover:bg-primary/15 transition-colors">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="flex-grow pt-1">
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  if (disabled) {
    return <div className="cursor-not-allowed h-full">{cardContent}</div>;
  }

  return <Link href={href} className="h-full block">{cardContent}</Link>;
}
