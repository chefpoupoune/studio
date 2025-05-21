
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Archive, Settings, FileSpreadsheet, Users, ClipboardList, DollarSign, BookOpenText, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WeeklyMenuSummary from './components/WeeklyMenuSummary';
import OngoingTasksSummary from './components/OngoingTasksSummary';
import EmployeeHoursSummary from './components/EmployeeHoursSummary';
import PendingPurchaseOrdersSummary from './components/PendingPurchaseOrdersSummary'; // New Import
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

      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6"> {/* Changed grid layout */}
        <WeeklyMenuSummary />
        <OngoingTasksSummary />
        <EmployeeHoursSummary />
        <PendingPurchaseOrdersSummary /> {/* Added new summary component */}
      </div>

      <p className="mb-6 text-md text-muted-foreground max-w-2xl">
        Utilisez la barre de navigation latérale pour accéder aux différentes sections de l'application.
      </p>
      
    </div>
  );
}
