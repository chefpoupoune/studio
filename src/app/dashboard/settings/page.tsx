"use client"; // Added "use client" as Tabs is a client component

import Link from 'next/link';
import { ArrowLeft, Settings as SettingsIcon, FileCog, Settings2 as AppSettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PdfLayoutManager from './components/pdf-layout-manager';
import ApplicationSettingsManager from './components/application-settings-manager'; // New import
import React from 'react'; // Import React for useState and useEffect if needed

export default function SettingsPage() {
  // If client-side specific logic is needed (e.g., for localStorage access directly here)
  // const [isClient, setIsClient] = React.useState(false);
  // React.useEffect(() => {
  //   setIsClient(true);
  // }, []);

  // if (!isClient) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <p className="text-lg text-muted-foreground">Chargement des paramètres...</p>
  //     </div>
  //   );
  // }

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
      
      <Tabs defaultValue="pdf-layout" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 mb-6 bg-card p-1 rounded-lg">
          <TabsTrigger value="pdf-layout" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileCog className="mr-1 sm:mr-2 h-4 w-4" /> Mises en Page PDF
          </TabsTrigger>
          <TabsTrigger value="app-settings" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <AppSettingsIcon className="mr-1 sm:mr-2 h-4 w-4" /> Paramètres Application
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pdf-layout">
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
        </TabsContent>

        <TabsContent value="app-settings">
          <ApplicationSettingsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}