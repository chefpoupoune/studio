
"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { DailyMenu, MenuField } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CalendarRange, AlertCircle, ThermometerIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { groupMenusByWeek, type WeekData } from '../utils';
import { useToast } from '@/hooks/use-toast';

interface MealItemTemperatureInput {
  tempService1?: string;
  tempService2?: string;
  tempService3?: string;
}

interface DailyLogInput {
  personnel?: string;
  correctiveActions?: string;
}

const mealPartsOrder: MenuField[] = ['entree', 'plat', 'feculent', 'legume', 'sauce', 'dessert'];

const mealPartDisplayNames: Record<MenuField, string> = {
  entree: "Entrée",
  plat: "Plat Principal",
  feculent: "Féculent",
  legume: "Légume",
  sauce: "Sauce",
  dessert: "Dessert",
};

interface TemperatureSheetProps {
  year: number;
  month: number; // 0-indexed
  menuData: DailyMenu[];
  isLoading: boolean;
}

export default function TemperatureSheet({ year, month, menuData, isLoading: pageLoading }: TemperatureSheetProps) {
  const [mealItemTemperatures, setMealItemTemperatures] = useState<Record<string, MealItemTemperatureInput>>({}); // Key: date_mealPart
  const [dailyLogData, setDailyLogData] = useState<Record<string, DailyLogInput>>({}); // Key: date
  const [isComponentLoading, setIsComponentLoading] = useState(true);
  const { toast } = useToast();

  const getMealItemTempsKey = useCallback(() => `temperature_sheet_meal_item_temps_${year}_${month}`, [year, month]);
  const getDailyLogKey = useCallback(() => `temperature_sheet_daily_log_data_${year}_${month}`, [year, month]);

  useEffect(() => {
    setIsComponentLoading(true);
    try {
      const storedMealTemps = localStorage.getItem(getMealItemTempsKey());
      if (storedMealTemps) setMealItemTemperatures(JSON.parse(storedMealTemps));
      else setMealItemTemperatures({});

      const storedDailyLog = localStorage.getItem(getDailyLogKey());
      if (storedDailyLog) setDailyLogData(JSON.parse(storedDailyLog));
      else setDailyLogData({});

    } catch (error) {
      console.error("Error loading temperature data from localStorage:", error);
      toast({ title: "Erreur de chargement", description: "Données de température corrompues.", variant: "destructive" });
      setMealItemTemperatures({});
      setDailyLogData({});
    }
    setIsComponentLoading(false);
  }, [year, month, getMealItemTempsKey, getDailyLogKey, toast]);

  useEffect(() => {
    if (!isComponentLoading) {
      localStorage.setItem(getMealItemTempsKey(), JSON.stringify(mealItemTemperatures));
    }
  }, [mealItemTemperatures, isComponentLoading, getMealItemTempsKey]);

  useEffect(() => {
    if (!isComponentLoading) {
      localStorage.setItem(getDailyLogKey(), JSON.stringify(dailyLogData));
    }
  }, [dailyLogData, isComponentLoading, getDailyLogKey]);


  const weeklyGroupedMenus = useMemo(() => {
    return groupMenusByWeek(year, month, menuData);
  }, [year, month, menuData]);

  const handleMealItemTempChange = (date: string, mealPart: MenuField, field: keyof MealItemTemperatureInput, value: string) => {
    const key = `${date}_${mealPart}`;
    setMealItemTemperatures(prev => ({
        ...prev,
        [key]: { ...(prev[key] || {}), [field]: value }
    }));
  };

  const handleDailyLogChange = (date: string, field: keyof DailyLogInput, value: string) => {
    setDailyLogData(prev => ({
        ...prev,
        [date]: { ...(prev[date] || {}), [field]: value }
    }));
  };
  
  const currentCombinedLoadingState = pageLoading || isComponentLoading;


  if (currentCombinedLoadingState) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Chargement des fiches de température...</span>
      </div>
    );
  }

  if (weeklyGroupedMenus.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
          <CalendarRange className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
              Aucune semaine à afficher pour {format(new Date(year, month), "MMMM yyyy", { locale: fr })}.
          </p>
          <p className="text-xs text-muted-foreground/70">
              Vérifiez que des menus sont planifiés pour ce mois.
          </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {weeklyGroupedMenus.map((week, index) => (
        <Card key={index} className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <ThermometerIcon className="w-5 h-5 text-primary"/>
                Semaine {week.weekNumberInMonth}: {format(week.startDate, "dd LLLL", { locale: fr })} - {format(week.endDate, "dd LLLL yyyy", { locale: fr })}
            </CardTitle>
            <CardDescription>
              Enregistrez les températures et le personnel pour les plats de cette semaine.
              {week.menus.length === 0 && " (Aucun menu planifié pour cette semaine)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {week.menus.length > 0 ? (
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/20 z-10">
                    <TableRow>
                      <TableHead className="w-[100px] min-w-[100px]">Jour</TableHead>
                      <TableHead className="min-w-[200px] w-[250px]">Plat Concerné</TableHead>
                      <TableHead className="min-w-[120px] w-[120px] text-center">Temp. 1er Serv. (11h45)</TableHead>
                      <TableHead className="min-w-[120px] w-[120px] text-center">Temp. 2ème Serv. (12h45)</TableHead>
                      <TableHead className="min-w-[120px] w-[120px] text-center">Temp. 3ème Serv. (13h)</TableHead>
                      <TableHead className="min-w-[120px] w-[120px]">Personnel</TableHead>
                      <TableHead className="min-w-[200px] w-[200px]">Actions Correctives / Observations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {week.menus.flatMap(menu => {
                      const dailyInputs = dailyLogData[menu.date] || {};
                      return mealPartsOrder.map(mealPartKey => {
                        const mealItemName = menu[mealPartKey];
                        if (!mealItemName || mealItemName.trim() === "") return null;

                        const itemTempKey = `${menu.date}_${mealPartKey}`;
                        const itemTempInputs = mealItemTemperatures[itemTempKey] || {};

                        return (
                          <TableRow key={`${menu.date}-${mealPartKey}`} className={menu.isWeekend ? "bg-muted/30 opacity-70" : ""}>
                            <TableCell className="font-medium align-top py-2">
                               {format(parseISO(menu.date), "E dd/MM", { locale: fr })}
                               {menu.isHoliday && menu.holidayName && (
                                  <span className="block text-xs text-amber-600 dark:text-amber-400 truncate" title={menu.holidayName}>
                                      {menu.holidayName}
                                  </span>
                              )}
                            </TableCell>
                            <TableCell className="align-top py-2 text-xs" title={mealItemName}>
                              <span className="font-semibold block">{mealPartDisplayNames[mealPartKey]}:</span>
                              {mealItemName}
                            </TableCell>
                            <TableCell className="p-1 align-top">
                              <Input 
                                type="text" 
                                placeholder="°C" 
                                className="text-xs h-10 text-center" 
                                value={itemTempInputs.tempService1 || ''}
                                onChange={(e) => handleMealItemTempChange(menu.date, mealPartKey, 'tempService1', e.target.value)}
                                disabled={menu.isWeekend}
                              />
                            </TableCell>
                            <TableCell className="p-1 align-top">
                              <Input 
                                type="text" 
                                placeholder="°C" 
                                className="text-xs h-10 text-center"
                                value={itemTempInputs.tempService2 || ''}
                                onChange={(e) => handleMealItemTempChange(menu.date, mealPartKey, 'tempService2', e.target.value)}
                                disabled={menu.isWeekend}
                              />
                            </TableCell>
                             <TableCell className="p-1 align-top">
                              <Input 
                                type="text" 
                                placeholder="°C" 
                                className="text-xs h-10 text-center"
                                value={itemTempInputs.tempService3 || ''}
                                onChange={(e) => handleMealItemTempChange(menu.date, mealPartKey, 'tempService3', e.target.value)}
                                disabled={menu.isWeekend}
                              />
                            </TableCell>
                            <TableCell className="p-1 align-top">
                              <Input 
                                type="text" 
                                placeholder="Initiales" 
                                className="text-xs h-10"
                                value={dailyInputs.personnel || ''}
                                onChange={(e) => handleDailyLogChange(menu.date, 'personnel', e.target.value)}
                                disabled={menu.isWeekend}
                              />
                            </TableCell>
                            <TableCell className="p-1 align-top">
                              <Textarea 
                                placeholder="Actions/Observations..." 
                                className="text-xs min-h-[40px] h-auto" 
                                rows={2}
                                value={dailyInputs.correctiveActions || ''}
                                onChange={(e) => handleDailyLogChange(menu.date, 'correctiveActions', e.target.value)}
                                disabled={menu.isWeekend}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      }).filter(Boolean); // Remove null entries for empty meal parts
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground flex items-center justify-center gap-2">
                <AlertCircle className="w-5 h-5" /> Aucun menu planifié à afficher pour cette semaine.
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
