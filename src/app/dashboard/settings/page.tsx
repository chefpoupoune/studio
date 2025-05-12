
import Link from 'next/link';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import PdfLayoutManager from './components/pdf-layout-manager';

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <SettingsIcon className="w-10 h-10 text-accent" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
            Paramètres de l'Application
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
          <CardTitle>Gestion des Mises en Page PDF</CardTitle>
          <CardDescription>
            Personnalisez l'apparence de vos documents PDF, ajoutez des logos et ajustez les mises en page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PdfLayoutManager />
        </CardContent>
      </Card>

      {/* Placeholder for other settings sections */}
      {/* 
      <Card className="shadow-lg mt-8">
        <CardHeader>
          <CardTitle>Autres Paramètres</CardTitle>
          <CardDescription>
            Configurez d'autres aspects de l'application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">D'autres options de configuration seront disponibles ici à l'avenir.</p>
        </CardContent>
      </Card>
      */}
    </div>
  );
}
