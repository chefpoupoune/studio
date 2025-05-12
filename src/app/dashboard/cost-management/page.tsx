
import Link from 'next/link';
import { ArrowLeft, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CostAnalysisTable from './components/cost-analysis-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';

export default function CostManagementPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <DollarSign className="w-10 h-10 text-accent" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
            Gestion des Coûts
          </h1>
        </div>
        <Link href="/dashboard" passHref>
          <Button variant="outline" size="sm" className="group w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Retour au Tableau de Bord
          </Button>
        </Link>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Coût de Revient Mensuel</CardTitle>
          <CardDescription>
            Entrez les données mensuelles pour calculer le coût de revient. Le tableau ci-dessous permet de saisir les informations par fournisseur et par jour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CostAnalysisTable />
        </CardContent>
      </Card>
    </div>
  );
}
