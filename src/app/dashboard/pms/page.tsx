
"use client";

import Link from 'next/link';
import { ShieldCheck, SprayCan, Sparkles, Thermometer, Truck, ThermometerSnowflake, ArrowDownUp, Snowflake, Flame } from 'lucide-react'; 
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';

const pmsTabsConfig = [
  { value: "kitchen-cleaning", label: "Suivi Net. Cuisine", Icon: SprayCan, component: <KitchenCleaningMonitoring /> },
  { value: "restaurant-cleaning", label: "Suivi Net. Restaurant", Icon: Sparkles, component: <RestaurantCleaningMonitoring /> },
  { value: "temperature-monitoring", label: "Suivi Température", Icon: Thermometer, component: <TemperatureMonitoring /> },
  { value: "cold-chain", label: "Liaison Froide", Icon: ThermometerSnowflake, component: <ColdChainMonitoring /> },
  { value: "temp-change", label: "Baisse/Remise T°", Icon: ArrowDownUp, component: <TempChangeMonitoring /> },
  { value: "reception-monitoring", label: "Suivi Réception", Icon: Truck, component: <ReceptionMonitoring /> },
  { value: "defrosting-monitoring", label: "Suivi Décongélation", Icon: Snowflake, component: <DefrostingMonitoring /> },
  { value: "fryer-oil-tracking", label: "Suivi Friteuse / Huiles", Icon: Flame, component: <FryerOilOverallMonitoring /> },
];


export default function PmsPage() {
  const [isClient, setIsClient] = React.useState(false);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = React.useState(pmsTabsConfig[0].value);
  
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
        
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {isMobile ? (
          <div className="mb-4">
            <Label htmlFor="mobile-pms-nav-select" className="text-sm font-medium">Naviguer vers :</Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger id="mobile-pms-nav-select" className="w-full mt-1">
                <SelectValue placeholder="Choisir une section..." />
              </SelectTrigger>
              <SelectContent>
                {pmsTabsConfig.map(tab => (
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
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-8 gap-1 mb-6 bg-card p-1 rounded-lg"> 
            {pmsTabsConfig.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1">
                <tab.Icon className="mr-1 sm:mr-2 h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {pmsTabsConfig.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.component}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
