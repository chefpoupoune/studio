
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Archive, Settings, FileSpreadsheet, Users, ClipboardList, DollarSign, BookOpenText, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WeeklyMenuSummary from './components/WeeklyMenuSummary';
import OngoingTasksSummary from './components/OngoingTasksSummary';
import EmployeeHoursSummary from './components/EmployeeHoursSummary'; // New Import
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
        </div>        <div className="lg:col-span-1">
          <OngoingTasksSummary />
        </div>
        <div className="lg:col-span-1"> {/* New Bubble */}
          <EmployeeHoursSummary />
        </div>
      </div>

      <p className="mb-6 text-md text-muted-foreground max-w-2xl">
        Utilisez la barre de navigation latérale pour accéder aux différentes sections de l'application.
      </p>

      {/* La grille de navigation a été supprimée d'ici */}
      
    </div>
  );
}

// Le composant DashboardCard n'est plus nécessaire ici s'il n'est plus utilisé sur cette page.
// Si DashboardCard est utilisé ailleurs, il peut rester, sinon il peut être supprimé de ce fichier.
// Pour l'instant, je le laisse commenté au cas où.
/*
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
*/
