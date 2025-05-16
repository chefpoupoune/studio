
import Link from 'next/link';
import { ArrowLeft, FileSpreadsheet, Users } from 'lucide-react'; // Added Users icon
import { Button } from '@/components/ui/button';
import BenefitTrackingTable from './components/excel-benefit-manager'; // Path is still similar for now
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';

export default function BenefitsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <FileSpreadsheet className="w-10 h-10 text-accent" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
            Gestion des Avantages en Nature
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
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Suivi Mensuel des Avantages en Nature</CardTitle>
          <CardDescription>
            Sélectionnez un mois et une année, puis remplissez le tableau de suivi. Les données sont sauvegardées automatiquement. 
            (La gestion des employés pour cette section sera ajoutée prochainement.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BenefitTrackingTable />
        </CardContent>
      </Card>
    </div>
  );
}
    
