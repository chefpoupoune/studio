
"use client";

import Link from 'next/link';
import { ArrowLeft, DollarSign, CalendarDays, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CostAnalysisTable from './components/cost-analysis-table';
import AnnualCostAnalysisTable from './components/annual-cost-analysis-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React, { useState, useEffect } from 'react';
import type { CostEntry } from './types';

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
      
      <Tabs defaultValue="monthly" className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 mb-6 bg-card p-1 rounded-lg">
          <TabsTrigger value="monthly" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CalendarDays className="mr-1 sm:mr-2 h-4 w-4" /> Coût de Revient Mensuel
          </TabsTrigger>
          <TabsTrigger value="annual" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CalendarRange className="mr-1 sm:mr-2 h-4 w-4" /> Coût de Revient Annuel
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
      </Tabs>
    </div>
  );
}

