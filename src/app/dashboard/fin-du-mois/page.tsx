
"use client";

import { useState } from "react";
import dynamic from 'next/dynamic';
import { fr } from "date-fns/locale";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Administratif from "./components/administratif/Administratif";
import Budget from "./components/budget/Budget";
import { Skeleton } from "@/components/ui/skeleton";

// Importation dynamique du composant CloturePms pour éviter le rendu côté serveur
const CloturePms = dynamic(() => import('./components/pms/CloturePms'), {
  ssr: false, // Désactive le rendu côté serveur pour ce composant
  loading: () => <Skeleton className="w-full h-[400px]" />, // Affiche un skeleton pendant le chargement
});

const FinDuMoisPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleMonthChange = (value: string) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(parseInt(value));
    setSelectedDate(newDate);
  };

  const handleYearChange = (value: string) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(parseInt(value));
    setSelectedDate(newDate);
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i.toString(),
    label: format(new Date(2000, i), "MMMM", { locale: fr }),
  }));

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="container mx-auto p-4">
        <div className="bg-card border rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex flex-col items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center">
                        <span className="mr-2">🗓️</span>
                        <span className="border-b-2 border-primary pb-1">Clôture du mois</span>
                    </h1>
                </div>
                <div className="flex items-center space-x-2">
                    <Select onValueChange={handleMonthChange} defaultValue={selectedDate.getMonth().toString()}>
                        <SelectTrigger className="w-[150px] md:w-[180px]">
                            <SelectValue placeholder="Mois" />
                        </SelectTrigger>
                        <SelectContent>
                        {months.map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                            {month.label}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <Select onValueChange={handleYearChange} defaultValue={selectedDate.getFullYear().toString()}>
                        <SelectTrigger className="w-[100px] md:w-[120px]">
                            <SelectValue placeholder="Année" />
                        </SelectTrigger>
                        <SelectContent>
                        {years.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                            {year}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
      </div>

      <Tabs defaultValue="pms">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pms">Clôture PMS</TabsTrigger>
          <TabsTrigger value="administratif">
            Clôture administrative
          </TabsTrigger>
          <TabsTrigger value="budget">Clôture budget</TabsTrigger>
        </TabsList>
        <TabsContent value="pms" className="mt-4">
          <CloturePms selectedDate={selectedDate} />
        </TabsContent>
        <TabsContent value="administratif" className="mt-4">
          <Administratif selectedDate={selectedDate} />
        </TabsContent>
        <TabsContent value="budget" className="mt-4">
          <Budget selectedDate={selectedDate} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinDuMoisPage;
