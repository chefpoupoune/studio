
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Save, Trash2 } from 'lucide-react';
import type { PicnicWeekData, DailyCounts, PicnicRowKey, DisplayRowConfig } from '../types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const DAYS_OF_WEEK: (keyof DailyCounts)[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
const DAY_LABELS: Record<keyof DailyCounts, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
};

const PICNIC_DATA_STORAGE_KEY = "picnic_nb_pn_data_v1";

const initialRowData = (): DailyCounts => ({
  lundi: '', mardi: '', mercredi: '', jeudi: '', vendredi: ''
});

const createInitialPicnicWeekData = (): PicnicWeekData => ({
  gatien: initialRowData(),
  cedric: initialRowData(),
  dominique: initialRowData(),
  maxime_l: initialRowData(),
  nicolas: initialRowData(),
  maxime_h: initialRowData(),
  philipe: initialRowData(),
  plus: initialRowData(),
  autre: initialRowData(),
  nb_bagette: initialRowData(),
  total_glaciere: initialRowData(),
});

const DISPLAY_ROWS_CONFIG: DisplayRowConfig[] = [
  { id: 'gatien', label: 'Gatien', bgColor: 'bg-yellow-300', textColor: 'text-black', isInputRow: true, isESATContributor: true, isTotalContributor: true },
  { id: 'cedric', label: 'Cedric', bgColor: 'bg-green-500', textColor: 'text-white', isInputRow: true, isESATContributor: true, isTotalContributor: true },
  { id: 'dominique', label: 'Dominique', bgColor: 'bg-white', textColor: 'text-black', isInputRow: true, isESATContributor: true, isTotalContributor: true },
  { id: 'maxime_l', label: 'Maxime L', bgColor: 'bg-red-500', textColor: 'text-white', isInputRow: true, isESATContributor: true, isTotalContributor: true },
  { id: 'nicolas', label: 'Nicolas', bgColor: 'bg-black', textColor: 'text-white', isInputRow: true, isESATContributor: true, isTotalContributor: true },
  { id: 'maxime_h', label: 'Maxime H', bgColor: 'bg-blue-500', textColor: 'text-white', isInputRow: true, isESATContributor: true, isTotalContributor: true },
  { id: 'philipe', label: 'Philipe', bgColor: 'bg-orange-500', textColor: 'text-black', isInputRow: true, isESATContributor: true, isTotalContributor: true },
  { id: 'plus', label: 'PLUS', bgColor: 'bg-pink-500', textColor: 'text-white', isInputRow: true, isESATContributor: false, isTotalContributor: true },
  { id: 'autre', label: 'autre', bgColor: 'bg-purple-600', textColor: 'text-white', isInputRow: true, isESATContributor: false, isTotalContributor: true },
  { id: 'total_global', label: 'TOTAL', bgColor: 'bg-orange-300', textColor: 'text-black', isInputRow: false },
  { id: 'nb_bagette', label: 'NB de bagette', bgColor: 'bg-purple-600', textColor: 'text-white', isInputRow: true },
  { id: 'total_glaciere', label: 'total glacière', bgColor: 'bg-orange-500', textColor: 'text-black', isInputRow: true },
];


export default function NumberOfPicnics() {
  const [picnicData, setPicnicData] = useState<PicnicWeekData>(createInitialPicnicWeekData());
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(PICNIC_DATA_STORAGE_KEY);
      if (storedData) {
        setPicnicData(JSON.parse(storedData));
      }
    } catch (e) {
      console.error("Failed to load picnic data from localStorage", e);
      toast({ title: "Erreur de chargement", description: "Données de pique-nique corrompues.", variant: "destructive" });
    }
  }, [toast]);

  const saveData = useCallback(() => {
    try {
      localStorage.setItem(PICNIC_DATA_STORAGE_KEY, JSON.stringify(picnicData));
      toast({ title: "Données sauvegardées", description: "Les nombres de pique-niques ont été enregistrés." });
    } catch (e) {
      console.error("Failed to save picnic data to localStorage", e);
      toast({ title: "Erreur de sauvegarde", variant: "destructive" });
    }
  }, [picnicData, toast]);
  
  const clearData = () => {
    if(confirm("Êtes-vous sûr de vouloir effacer toutes les données de cette semaine ?")) {
        setPicnicData(createInitialPicnicWeekData());
        localStorage.removeItem(PICNIC_DATA_STORAGE_KEY);
        toast({ title: "Données effacées", variant: "destructive"});
    }
  };

  const handleInputChange = (rowId: PicnicRowKey, day: keyof DailyCounts, value: string) => {
    const numericValue = value === '' ? '' : parseInt(value, 10);
    if (value === '' || (!isNaN(numericValue) && numericValue >= 0)) {
      setPicnicData(prevData => ({
        ...prevData,
        [rowId]: {
          ...prevData[rowId],
          [day]: value === '' ? '' : numericValue,
        }
      }));
    }
  };

  const calculateDailyTotal = useCallback((day: keyof DailyCounts, type: 'global'): number => {
    let sum = 0;
    for (const rowConfig of DISPLAY_ROWS_CONFIG) {
      if (rowConfig.isInputRow) {
        if (type === 'global' && rowConfig.isTotalContributor) {
          sum += Number(picnicData[rowConfig.id as PicnicRowKey]?.[day]) || 0;
        }
      }
    }
    return sum;
  }, [picnicData]);

  const dailyGlobalTotals = useMemo(() => {
    return DAYS_OF_WEEK.reduce((acc, day) => {
      acc[day] = calculateDailyTotal(day, 'global');
      return acc;
    }, {} as Record<keyof DailyCounts, number>);
  }, [calculateDailyTotal]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Nombre de Pique-Niques (NB PN) pour la Semaine</CardTitle>
        <CardDescription>
          Saisissez le nombre de pique-niques prévus pour chaque catégorie et chaque jour. Les totaux sont calculés automatiquement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-md">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] min-w-[180px] sticky left-0 z-10 bg-card">Catégorie</TableHead>
                {DAYS_OF_WEEK.map(day => (
                  <TableHead key={day} className="text-center bg-orange-300 text-black capitalize min-w-[100px]">
                    {DAY_LABELS[day]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {DISPLAY_ROWS_CONFIG.map(rowConfig => (
                <TableRow key={rowConfig.id}>
                  <TableCell className={cn("font-medium sticky left-0 z-10", rowConfig.bgColor, rowConfig.textColor)}>
                    {rowConfig.label}
                  </TableCell>
                  {DAYS_OF_WEEK.map(day => (
                    <TableCell key={`${rowConfig.id}-${day}`} className="p-1 text-center">
                      {rowConfig.isInputRow ? (
                        <Input
                          type="number"
                          min="0"
                          value={picnicData[rowConfig.id as PicnicRowKey]?.[day] ?? ''}
                          onChange={(e) => handleInputChange(rowConfig.id as PicnicRowKey, day, e.target.value)}
                          className={cn("h-8 text-center tabular-nums", rowConfig.bgColor, rowConfig.textColor, "placeholder:text-gray-500")}
                          placeholder="0"
                        />
                      ) : rowConfig.id === 'total_global' ? ( 
                        <span className="font-semibold tabular-nums">{dailyGlobalTotals[day]}</span>
                      ) : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-6 flex justify-end space-x-2">
            <Button variant="outline" onClick={clearData}>
                <Trash2 className="mr-2 h-4 w-4" />
                Effacer Données Semaine
            </Button>
            <Button onClick={saveData}>
                <Save className="mr-2 h-4 w-4" />
                Sauvegarder Données
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
