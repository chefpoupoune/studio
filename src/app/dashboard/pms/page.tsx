"use client";

import Link from 'next/link';
import { ShieldCheck, SprayCan, Sparkles, Thermometer, Truck, ThermometerSnowflake, ArrowDownUp, Snowflake, Flame } from 'lucide-react'; // Removed ArrowLeft
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React from 'react';
import KitchenCleaningMonitoring from './components/kitchen-cleaning-monitoring';
import RestaurantCleaningMonitoring from './components/restaurant-cleaning-monitoring';
import TemperatureMonitoring from './components/temperature-monitoring';
import ReceptionMonitoring from './components/reception-monitoring';
import ColdChainMonitoring from './components/cold-chain-monitoring';
import TempChangeMonitoring from './components/temp-change-monitoring';
import DefrostingMonitoring from './components/defrosting-monitoring'; 
import FryerOilOverallMonitoring from './components/fryer-oil-overall-monitoring'; 

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
        {/* Back to Dashboard button removed */}
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Tabs defaultValue="kitchen-cleaning" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8 gap-1 mb-6 bg-card p-1 rounded-lg"> 
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
           <TabsTrigger value="defrosting-monitoring" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Snowflake className="mr-1 sm:mr-2 h-4 w-4" /> Suivi Décongélation
          </TabsTrigger>
          <TabsTrigger value="fryer-oil-tracking" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"> 
            <Flame className="mr-1 sm:mr-2 h-4 w-4" /> Suivi Friteuse / Huiles
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
        <TabsContent value="defrosting-monitoring">
            <DefrostingMonitoring />
        </TabsContent>
        <TabsContent value="fryer-oil-tracking"> 
            <FryerOilOverallMonitoring />
        </TabsContent>
      </Tabs>
    </div>
  );
}
