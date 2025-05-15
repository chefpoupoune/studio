
"use client";

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, SprayCan, Sparkles, Thermometer, Truck, ThermometerSnowflake, ArrowDownUp, History } from 'lucide-react'; // Added ThermometerSnowflake, ArrowDownUp
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React from 'react';
import KitchenCleaningMonitoring from './components/kitchen-cleaning-monitoring';
import RestaurantCleaningMonitoring from './components/restaurant-cleaning-monitoring';
import TemperatureMonitoring from './components/temperature-monitoring';
import ReceptionMonitoring from './components/reception-monitoring'; // Renamed import
import ColdChainMonitoring from './components/cold-chain-monitoring';
import TempChangeMonitoring from './components/temp-change-monitoring';


export default function PmsPage() {
  const [isClient, setIsClient] = React.useState(false);
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Chargement du PMS...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-10 h-10 text-accent" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
            PMS (Plan de Maîtrise Sanitaire)
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
      
      <Tabs defaultValue="kitchen-cleaning" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-1 mb-6 bg-card p-1 rounded-lg">
          <TabsTrigger value="kitchen-cleaning" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <SprayCan className="mr-1 sm:mr-2 h-4 w-4" /> Suivi Net. Cuisine
          </TabsTrigger>
          <TabsTrigger value="restaurant-cleaning" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Sparkles className="mr-1 sm:mr-2 h-4 w-4" /> Suivi Net. Restaurant
          </TabsTrigger>
          <TabsTrigger value="temperature-monitoring" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Thermometer className="mr-1 sm:mr-2 h-4 w-4" /> Suivi Température
          </TabsTrigger>
          <TabsTrigger value="cold-chain" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ThermometerSnowflake className="mr-1 sm:mr-2 h-4 w-4" /> Liaison Froide
          </TabsTrigger>
          <TabsTrigger value="temp-change" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ArrowDownUp className="mr-1 sm:mr-2 h-4 w-4" /> Baisse/Remise T°
          </TabsTrigger>
          <TabsTrigger value="reception-monitoring" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Truck className="mr-1 sm:mr-2 h-4 w-4" /> Suivi Réception
          </TabsTrigger>
           <TabsTrigger value="historical-records" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <History className="mr-1 sm:mr-2 h-4 w-4" /> Historique Enregistrements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kitchen-cleaning">
          <KitchenCleaningMonitoring />
        </TabsContent>
        <TabsContent value="restaurant-cleaning">
          <RestaurantCleaningMonitoring />
        </TabsContent>
        <TabsContent value="temperature-monitoring">
          <TemperatureMonitoring />
        </TabsContent>
        <TabsContent value="cold-chain">
          <ColdChainMonitoring />
        </TabsContent>
        <TabsContent value="temp-change">
          <TempChangeMonitoring />
        </TabsContent>
        <TabsContent value="reception-monitoring">
          <ReceptionMonitoring />
        </TabsContent>
        <TabsContent value="historical-records">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                    <History className="w-6 h-6 text-primary"/>
                    Historique des Enregistrements PMS
                    </CardTitle>
                    <CardDescription>
                    Consultez les archives de tous les enregistrements PMS. (Fonctionnalité à développer)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-muted-foreground/20 rounded-lg bg-card/50 min-h-[200px]">
                        <History className="w-12 h-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium text-muted-foreground">
                            Section d'historique en cours de développement.
                        </p>
                        <p className="text-sm text-muted-foreground/80 mt-2">
                            Cette section permettra de rechercher et visualiser les anciens enregistrements de tous les modules PMS.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
