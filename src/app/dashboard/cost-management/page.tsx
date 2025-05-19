"use client";

import Link from 'next/link';
import { DollarSign, CalendarDays, CalendarRange, CookingPot, UtensilsCrossed } from 'lucide-react'; // Removed ArrowLeft
import { Button } from '@/components/ui/button';
import CostAnalysisTable from './components/cost-analysis-table';
import AnnualCostAnalysisTable from './components/annual-cost-analysis-table';
import PicnicCostAnalysis from './components/picnic-cost-analysis';
import OccasionalMealCostAnalysis from './components/occasional-meal-cost-analysis'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React, { useState, useEffect } from 'react';

export default function CostManagementPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);


  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Chargement de la gestion des coûts...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <DollarSign className="w-10 h-10 text-accent" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
            Gestion des Coûts
          </h1>
        </div>
        {/* Back to Dashboard button removed */}
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Tabs defaultValue="monthly" className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6 bg-card p-1 rounded-lg">
          <TabsTrigger value="monthly" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CalendarDays className="mr-1 sm:mr-2 h-4 w-4" /> Coût de Revient Mensuel
          </TabsTrigger>
          <TabsTrigger value="annual" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CalendarRange className="mr-1 sm:mr-2 h-4 w-4" /> Coût de Revient Annuel
          </TabsTrigger>
          <TabsTrigger value="picnic" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CookingPot className="mr-1 sm:mr-2 h-4 w-4" /> Coût Pique-Nique/Salade
          </TabsTrigger>
          <TabsTrigger value="occasional" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <UtensilsCrossed className="mr-1 sm:mr-2 h-4 w-4" /> Coût Repas Occasionnel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Saisie du Coût de Revient Mensuel</CardTitle>
              <CardDescription>
                Sélectionnez un mois et une année, puis entrez les données pour calculer le coût de revient.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CostAnalysisTable />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="annual">
           <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Analyse du Coût de Revient Annuel</CardTitle>
              <CardDescription>
                Visualisez le récapitulatif annuel des coûts de revient, synchronisé avec les données mensuelles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnnualCostAnalysisTable />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="picnic">
           <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Calcul du Coût de Revient Pique-Nique / Salade</CardTitle>
              <CardDescription>
                Ajoutez les ingrédients pour calculer le coût de revient d'un repas pique-nique ou d'une salade.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PicnicCostAnalysis />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="occasional">
           <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Calcul du Coût de Revient Repas Occasionnel</CardTitle>
              <CardDescription>
                Calculez le coût d'un repas (entrée, plat, dessert) pour un nombre donné de personnes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OccasionalMealCostAnalysis />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}