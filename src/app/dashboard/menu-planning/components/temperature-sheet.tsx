
"use client";

import React, { useMemo, useState } from 'react';
import type { DailyMenu } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Keep for potential corrective actions
import { Loader2, CalendarRange, AlertCircle, ThermometerIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { groupMenusByWeek, type WeekData } from '../utils';

interface TemperatureSheetProps {
  year: number;
  month: number; // 0-indexed
  menuData: DailyMenu[];
  isLoading: boolean;
}

interface TemperatureDayInput {
  tempService1?: string;
  tempService2?: string;
  tempService3?: string;
  personnel?: string;
  correctiveActions?: string; // Optional: if needed
}

export default function TemperatureSheet({ year, month, menuData, isLoading }: TemperatureSheetProps) {
  const [temperatureInputs, setTemperatureInputs] = useState<Record<string, TemperatureDayInput>>({});

  const weeklyGroupedMenus = useMemo(() => {
    return groupMenusByWeek(year, month, menuData);
  }, [year, month, menuData]);

  const handleInputChange = (date: string, field: keyof TemperatureDayInput, value: string) => {
    setTemperatureInputs(prev => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [field]: value,
      }
    }));
  };

  const renderMenuCellContent = (menu: DailyMenu) => {
    const items = [
      menu.entree,
      menu.plat,
      menu.feculent,
      menu.legume,
      menu.sauce,
      menu.dessert,
    ].filter(item => item && item.trim() !== "");

    if (items.length === 0) return <span className="text-muted-foreground text-xs italic">Aucun menu</span>;
    
    return (
      <div className="text-xs space-y-0.5">
        {items.map((item, idx) => (
          <div key={idx} className="truncate" title={item}>{item}</div>
        ))}
      </div>
    );
  };


  if (isLoading) {
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
                      <TableHead className="min-w-[200px] w-[250px]">Menu</TableHead>
                      <TableHead className="min-w-[150px] w-[150px] text-center">Température 1er Service 11h45 (°C)</TableHead>
                      <TableHead className="min-w-[150px] w-[150px] text-center">Température 2ème Service 12h45 (°C)</TableHead>
                      <TableHead className="min-w-[150px] w-[150px] text-center">Température 3ème Service 13h (°C)</TableHead>
                      <TableHead className="min-w-[120px] w-[120px]">Personnel</TableHead>
                      <TableHead className="min-w-[200px] w-[200px]">Actions Correctives / Observations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {week.menus.map(menu => {
                      const currentInputs = temperatureInputs[menu.date] || {};
                      return (
                        <TableRow key={menu.date} className={menu.isWeekend ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium align-top">
                            {menu.dayName}
                            <span className="block text-xs text-muted-foreground">{format(parseISO(menu.date), "dd/MM", { locale: fr })}</span>
                             {menu.isHoliday && menu.holidayName && (
                                <span className="block text-xs text-amber-600 dark:text-amber-400 truncate" title={menu.holidayName}>
                                    {menu.holidayName}
                                </span>
                            )}
                          </TableCell>
                          <TableCell className="align-top py-2">
                            {renderMenuCellContent(menu)}
                          </TableCell>
                          <TableCell className="p-1 align-top">
                            <Input 
                              type="text" 
                              placeholder="°C" 
                              className="text-xs h-10 text-center" 
                              value={currentInputs.tempService1 || ''}
                              onChange={(e) => handleInputChange(menu.date, 'tempService1', e.target.value)}
                              disabled={menu.isWeekend}
                            />
                          </TableCell>
                          <TableCell className="p-1 align-top">
                            <Input 
                              type="text" 
                              placeholder="°C" 
                              className="text-xs h-10 text-center"
                              value={currentInputs.tempService2 || ''}
                              onChange={(e) => handleInputChange(menu.date, 'tempService2', e.target.value)}
                              disabled={menu.isWeekend}
                            />
                          </TableCell>
                           <TableCell className="p-1 align-top">
                            <Input 
                              type="text" 
                              placeholder="°C" 
                              className="text-xs h-10 text-center"
                              value={currentInputs.tempService3 || ''}
                              onChange={(e) => handleInputChange(menu.date, 'tempService3', e.target.value)}
                              disabled={menu.isWeekend}
                            />
                          </TableCell>
                          <TableCell className="p-1 align-top">
                            <Input 
                              type="text" 
                              placeholder="Initiales" 
                              className="text-xs h-10"
                              value={currentInputs.personnel || ''}
                              onChange={(e) => handleInputChange(menu.date, 'personnel', e.target.value)}
                              disabled={menu.isWeekend}
                            />
                          </TableCell>
                          <TableCell className="p-1 align-top">
                            <Textarea 
                              placeholder="Actions/Observations..." 
                              className="text-xs min-h-[40px] h-auto" 
                              rows={2}
                              value={currentInputs.correctiveActions || ''}
                              onChange={(e) => handleInputChange(menu.date, 'correctiveActions', e.target.value)}
                              disabled={menu.isWeekend}
                            />
                          </TableCell>
                        </TableRow>
                      );
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

