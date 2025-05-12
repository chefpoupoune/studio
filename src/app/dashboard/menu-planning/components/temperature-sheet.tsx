
"use client";

import React, { useMemo, useState } from 'react';
import type { DailyMenu } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

interface TemperatureEntry {
  receptionTemp?: string;
  serviceTemp?: string;
  correctiveActions?: string;
  visa?: string;
}

// Helper to create a unique key for each input field for local state
const createInputKey = (date: string, field: keyof TemperatureEntry) => `${date}-${field}`;


export default function TemperatureSheet({ year, month, menuData, isLoading }: TemperatureSheetProps) {
  const [temperatureData, setTemperatureData] = useState<Record<string, TemperatureEntry>>({});

  const weeklyGroupedMenus = useMemo(() => {
    return groupMenusByWeek(year, month, menuData);
  }, [year, month, menuData]);

  const handleInputChange = (date: string, field: keyof TemperatureEntry, value: string) => {
    setTemperatureData(prev => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [field]: value,
      }
    }));
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
              Enregistrez les températures pour les plats de cette semaine.
              {week.menus.length === 0 && " (Aucun menu planifié pour cette semaine)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {week.menus.length > 0 ? (
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/20">
                    <TableRow>
                      <TableHead className="w-[80px]">Date</TableHead>
                      <TableHead className="w-[100px]">Jour</TableHead>
                      <TableHead className="min-w-[150px]">Plat Principal</TableHead>
                      <TableHead className="min-w-[120px]">Temp. Réception/Prépa (°C)</TableHead>
                      <TableHead className="min-w-[120px]">Temp. Service (°C)</TableHead>
                      <TableHead className="min-w-[200px]">Actions Correctives</TableHead>
                      <TableHead className="min-w-[100px]">Visa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {week.menus.map(menu => {
                      const currentEntry = temperatureData[menu.date] || {};
                      return (
                        <TableRow key={menu.date}>
                          <TableCell>{format(parseISO(menu.date), "dd/MM", { locale: fr })}</TableCell>
                          <TableCell>{menu.dayName}</TableCell>
                          <TableCell className="text-sm" title={menu.plat}>{menu.plat || "-"}</TableCell>
                          <TableCell className="p-1">
                            <Input 
                              type="text" 
                              placeholder="°C" 
                              className="text-xs h-10" 
                              value={currentEntry.receptionTemp || ''}
                              onChange={(e) => handleInputChange(menu.date, 'receptionTemp', e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input 
                              type="text" 
                              placeholder="°C" 
                              className="text-xs h-10"
                              value={currentEntry.serviceTemp || ''}
                              onChange={(e) => handleInputChange(menu.date, 'serviceTemp', e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Textarea 
                              placeholder="Actions..." 
                              className="text-xs min-h-[40px] h-10" 
                              rows={1}
                              value={currentEntry.correctiveActions || ''}
                              onChange={(e) => handleInputChange(menu.date, 'correctiveActions', e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input 
                              type="text" 
                              placeholder="Initiales" 
                              className="text-xs h-10"
                              value={currentEntry.visa || ''}
                              onChange={(e) => handleInputChange(menu.date, 'visa', e.target.value)}
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
