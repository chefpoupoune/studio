
"use client";

import Link from 'next/link';
import { DollarSign, CalendarDays, CalendarRange, CookingPot, UtensilsCrossed } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import CostAnalysisTable from './components/cost-analysis-table';
import AnnualCostAnalysisTable from './components/annual-cost-analysis-table';
import PicnicCostAnalysis from './components/picnic-cost-analysis';
import OccasionalMealCostAnalysis from './components/occasional-meal-cost-analysis'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';

const costManagementTabsConfig = [
  { value: "monthly", label: "Coût de Revient Mensuel", Icon: CalendarDays, component: <CostAnalysisTable /> },
  { value: "annual", label: "Coût de Revient Annuel", Icon: CalendarRange, component: <AnnualCostAnalysisTable /> },
  { value: "picnic", label: "Coût Pique-Nique/Salade", Icon: CookingPot, component: <PicnicCostAnalysis /> },
  { value: "occasional", label: "Coût Repas Occasionnel", Icon: UtensilsCrossed, component: <OccasionalMealCostAnalysis /> },
];

export default function CostManagementPage() {
  const [isClient, setIsClient] = useState(false);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState(costManagementTabsConfig[0].value);

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

  const tabsContentMap: Record<string, React.ReactNode> = {
    "monthly": <Card className="shadow-xl"><CardHeader><CardTitle>Saisie du Coût de Revient Mensuel</CardTitle><CardDescription>Sélectionnez un mois et une année, puis entrez les données pour calculer le coût de revient.</CardDescription></CardHeader><CardContent><CostAnalysisTable /></CardContent></Card>,
    "annual": <Card className="shadow-xl"><CardHeader><CardTitle>Analyse du Coût de Revient Annuel</CardTitle><CardDescription>Visualisez le récapitulatif annuel des coûts de revient, synchronisé avec les données mensuelles.</CardDescription></CardHeader><CardContent><AnnualCostAnalysisTable /></CardContent></Card>,
    "picnic": <Card className="shadow-xl"><CardHeader><CardTitle>Calcul du Coût de Revient Pique-Nique / Salade</CardTitle><CardDescription>Ajoutez les ingrédients pour calculer le coût de revient d'un repas pique-nique ou d'une salade.</CardDescription></CardHeader><CardContent><PicnicCostAnalysis /></CardContent></Card>,
    "occasional": <Card className="shadow-xl"><CardHeader><CardTitle>Calcul du Coût de Revient Repas Occasionnel</CardTitle><CardDescription>Calculez le coût d'un repas (entrée, plat, dessert) pour un nombre donné de personnes.</CardDescription></CardHeader><CardContent><OccasionalMealCostAnalysis /></CardContent></Card>,
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <DollarSign className="w-10 h-10 text-accent" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
            Gestion des Coûts
          </h1>
        </div>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {isMobile ? (
          <div className="mb-4">
            <Label htmlFor="mobile-cost-nav-select" className="text-sm font-medium">Naviguer vers :</Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger id="mobile-cost-nav-select" className="w-full mt-1">
                <SelectValue placeholder="Choisir une section..." />
              </SelectTrigger>
              <SelectContent>
                {costManagementTabsConfig.map(tab => (
                  <SelectItem key={tab.value} value={tab.value} className="text-sm">
                    <span className="flex items-center">
                      <tab.Icon className="mr-2 h-4 w-4" />
                      {tab.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6 bg-card p-1 rounded-lg">
            {costManagementTabsConfig.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1">
                <tab.Icon className="mr-1 sm:mr-2 h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {costManagementTabsConfig.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            {tabsContentMap[tab.value]}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
