
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, CalendarDays, Trash2 } from 'lucide-react';
import type { PicnicMenuWeek, PicnicMenuDayKey } from '../types';
import { PICNIC_MENU_MONTHS, PICNIC_MENU_DAY_KEYS, NUM_PICNIC_ITEM_SLOTS, PICNIC_MENU_DAYS_LABELS } from '../types';
import { format, getYear, getMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addWeeks, addDays, isSameMonth, eachWeekOfInterval, getISOWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PICNIC_WEEKLY_MENUS_STORAGE_KEY = "picnic_weekly_menus_data_v1";

const currentSystemYear = getYear(new Date());
const years = Array.from({ length: 10 }, (_, i) => currentSystemYear - 5 + i);

const createEmptyDailyItems = (): string[] => Array(NUM_PICNIC_ITEM_SLOTS).fill('');

const createEmptyPicnicMenuWeek = (year: number, monthIndex: number, weekInMonth: number, startDate: Date): PicnicMenuWeek => {
  const endDate = endOfWeek(startDate, { weekStartsOn: 1 });
  return {
    id: `${year}-${monthIndex}-${weekInMonth}`,
    year,
    monthIndex,
    weekInMonth,
    startDate: startDate.toISOString(),
    dateRangeDisplay: `${format(startDate, 'dd/MM', { locale: fr })} au ${format(endDate, 'dd/MM', { locale: fr })}`,
    days: PICNIC_MENU_DAY_KEYS.reduce((acc, day) => {
      acc[day] = createEmptyDailyItems();
      return acc;
    }, {} as Record<PicnicMenuDayKey, string[]>),
    weeklyNote: '',
  };
};

export default function PicnicMenu() {
  const [selectedYear, setSelectedYear] = useState<number>(currentSystemYear);
  const [selectedMonthTab, setSelectedMonthTab] = useState<string>(PICNIC_MENU_MONTHS[0].value.toString()); // Mars by default
  const [allPicnicMenuWeeks, setAllPicnicMenuWeeks] = useState<PicnicMenuWeek[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(PICNIC_WEEKLY_MENUS_STORAGE_KEY);
      if (storedData) {
        const parsedData: PicnicMenuWeek[] = JSON.parse(storedData);
        // Ensure days object has all keys and correct number of slots
        const validatedData = parsedData.map(week => ({
          ...week,
          days: PICNIC_MENU_DAY_KEYS.reduce((acc, dayKey) => {
            const items = week.days[dayKey] || []; // Fallback for potentially missing day
            acc[dayKey] = Array.from({ length: NUM_PICNIC_ITEM_SLOTS }, (_, i) => items[i] || '');
            return acc;
          }, {} as Record<PicnicMenuDayKey, string[]>),
        }));
        setAllPicnicMenuWeeks(validatedData);
      }
    } catch (e) {
      console.error("Failed to load picnic menu data:", e);
      toast({ title: "Erreur de chargement des menus Pique Nique", variant: "destructive" });
    }
  }, [toast]);

  const handleSaveMenus = () => {
    try {
      localStorage.setItem(PICNIC_WEEKLY_MENUS_STORAGE_KEY, JSON.stringify(allPicnicMenuWeeks));
      toast({ title: "Menus Pique Nique Enregistrés", description: "Vos modifications ont été sauvegardées." });
    } catch (e) {
      console.error("Failed to save picnic menu data:", e);
      toast({ title: "Erreur de sauvegarde", variant: "destructive" });
    }
  };

  const weeksForSelectedMonth = useMemo(() => {
    const monthIndex = parseInt(selectedMonthTab, 10); // This is already 0-indexed for Date needs if from PICNIC_MENU_MONTHS.value
    const monthStartDate = startOfMonth(new Date(selectedYear, monthIndex));
    const monthEndDate = endOfMonth(monthStartDate);
    
    let currentWeekStartDate = startOfWeek(monthStartDate, { weekStartsOn: 1 });
    const weeks: Array<{ weekInMonth: number; dateRangeDisplay: string; startDate: Date; id: string }> = [];
    let weekCounter = 1;

    while (currentWeekStartDate <= monthEndDate && weeks.length < 5) {
        // Ensure the week starts within the selected month, or at least overlaps with it
        const actualWeekStartForDisplay = currentWeekStartDate < monthStartDate ? monthStartDate : currentWeekStartDate;
        let actualWeekEndForDisplay = endOfWeek(currentWeekStartDate, { weekStartsOn: 1 });
        actualWeekEndForDisplay = actualWeekEndForDisplay > monthEndDate ? monthEndDate : actualWeekEndForDisplay;

        if (actualWeekStartForDisplay <= monthEndDate) { // Only add if the week has days in the current month
             weeks.push({
                weekInMonth: weekCounter,
                startDate: currentWeekStartDate, // Use the true Monday for ID generation
                dateRangeDisplay: `${format(actualWeekStartForDisplay, 'dd/MM')} au ${format(actualWeekEndForDisplay, 'dd/MM')}`,
                id: `${selectedYear}-${monthIndex}-${weekCounter}`,
            });
            weekCounter++;
        }
        currentWeekStartDate = addDays(currentWeekStartDate, 7); // Move to the next Monday
    }
    // Ensure we always have 5 conceptual weeks for consistent UI, even if some are partially outside month
     while (weeks.length < 5) {
        const lastWeekStartDate = weeks.length > 0 ? weeks[weeks.length - 1].startDate : startOfWeek(monthStartDate, { weekStartsOn: 1 });
        const nextWeekStartDate = addDays(lastWeekStartDate, (weeks.length > 0 ? 7 : (weekCounter-1)*7) ); // Ensure next week starts after last
        
        weeks.push({
            weekInMonth: weekCounter,
            startDate: nextWeekStartDate,
            dateRangeDisplay: `${format(nextWeekStartDate, 'dd/MM')} au ${format(endOfWeek(nextWeekStartDate, { weekStartsOn: 1 }), 'dd/MM')}`,
            id: `${selectedYear}-${monthIndex}-${weekCounter}`,
        });
        weekCounter++;
    }
    return weeks.slice(0, 5); // Ensure only 5 weeks
  }, [selectedYear, selectedMonthTab]);

  const displayedWeeklyMenus = useMemo(() => {
    const monthIndex = parseInt(selectedMonthTab, 10);
    return weeksForSelectedMonth.map(weekMeta => {
      const existingMenu = allPicnicMenuWeeks.find(
        menu => menu.year === selectedYear && menu.monthIndex === monthIndex && menu.weekInMonth === weekMeta.weekInMonth
      );
      if (existingMenu) {
        // Ensure dateRangeDisplay is up-to-date if year/month changes for an existing ID structure
        return { ...existingMenu, dateRangeDisplay: weekMeta.dateRangeDisplay };
      }
      return createEmptyPicnicMenuWeek(selectedYear, monthIndex, weekMeta.weekInMonth, weekMeta.startDate);
    });
  }, [weeksForSelectedMonth, allPicnicMenuWeeks, selectedYear, selectedMonthTab]);

  const handleItemChange = (weekId: string, day: PicnicMenuDayKey, itemIndex: number, value: string) => {
    setAllPicnicMenuWeeks(prevMenus =>
      prevMenus.map(weekMenu => {
        if (weekMenu.id === weekId) {
          // Ensure weekMenu.days and weekMenu.days[day] are initialized
          const currentDayItems = weekMenu.days[day] || createEmptyDailyItems();
          const updatedDayItems = [...currentDayItems];
          updatedDayItems[itemIndex] = value;
          return { 
            ...weekMenu, 
            days: { 
              ...weekMenu.days, 
              [day]: updatedDayItems 
            } 
          };
        }
        return weekMenu;
      })
    );
  };

  const handleWeeklyNoteChange = (weekId: string, value: string) => {
     setAllPicnicMenuWeeks(prevMenus =>
      prevMenus.map(weekMenu =>
        weekMenu.id === weekId ? { ...weekMenu, weeklyNote: value } : weekMenu
      )
    );
  };
  
  const handleClearAllMenusForMonth = () => {
    const monthIndex = parseInt(selectedMonthTab, 10);
    setAllPicnicMenuWeeks(prevMenus => 
      prevMenus.filter(menu => !(menu.year === selectedYear && menu.monthIndex === monthIndex))
    );
    toast({ title: `Tous les menus de ${PICNIC_MENU_MONTHS.find(m => m.value.toString() === selectedMonthTab)?.label} ${selectedYear} ont été effacés.`, variant: "destructive" });
  };


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Planification des Menus Pique Nique</CardTitle>
        <CardDescription>
          Définissez les menus pour chaque semaine des mois de Mars à Novembre.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div>
            <Label htmlFor="year-select-picnic-menu">Année</Label>
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
              <SelectTrigger id="year-select-picnic-menu"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex-grow sm:flex-grow-0">
            <Button onClick={handleSaveMenus} className="w-full sm:w-auto">
              <Save className="mr-2 h-4 w-4" /> Sauvegarder Tous les Menus
            </Button>
          </div>
        </div>

        <Tabs value={selectedMonthTab} onValueChange={setSelectedMonthTab} className="w-full">
          <ScrollArea className="whitespace-nowrap">
            <TabsList>
              {PICNIC_MENU_MONTHS.map(month => (
                <TabsTrigger key={month.value} value={month.value.toString()}>{month.label}</TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          {PICNIC_MENU_MONTHS.map(monthConfig => (
            <TabsContent key={monthConfig.value} value={monthConfig.value.toString()} className="mt-4 space-y-6">
              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" /> Effacer Menus de {monthConfig.label} {selectedYear}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                      <AlertDialogDescription>
                        Êtes-vous sûr de vouloir effacer tous les menus pour {monthConfig.label} {selectedYear} ? Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAllMenusForMonth}>Effacer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {displayedWeeklyMenus.filter(wm => wm.monthIndex === monthConfig.value).map((weeklyMenu, weekIdx) => (
                <Card key={weeklyMenu.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 py-3 px-4">
                    <CardTitle className="text-md">
                      Semaine {weeklyMenu.weekInMonth} - {weeklyMenu.dateRangeDisplay}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[800px]">
                        <TableHeader>
                          <TableRow>
                            {PICNIC_MENU_DAY_KEYS.map(dayKey => (
                              <TableHead key={dayKey} className="text-center capitalize bg-orange-400 text-white p-2">
                                {PICNIC_MENU_DAYS_LABELS[dayKey]}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from({ length: NUM_PICNIC_ITEM_SLOTS }).map((_, itemIndex) => (
                            <TableRow key={itemIndex}>
                              {PICNIC_MENU_DAY_KEYS.map(dayKey => (
                                <TableCell key={`${dayKey}-${itemIndex}`} className="p-1">
                                  <Input
                                    type="text"
                                    value={weeklyMenu.days[dayKey]?.[itemIndex] || ''}
                                    onChange={(e) => handleItemChange(weeklyMenu.id, dayKey, itemIndex, e.target.value)}
                                    className="h-8 text-xs"
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-2">
                      <Label htmlFor={`weekly-note-${weeklyMenu.id}`} className="text-xs">Note pour la semaine (Ex: Plage de dates si spécifique)</Label>
                      <Input
                        id={`weekly-note-${weeklyMenu.id}`}
                        type="text"
                        value={weeklyMenu.weeklyNote || ''}
                        onChange={(e) => handleWeeklyNoteChange(weeklyMenu.id, e.target.value)}
                        className="h-8 text-xs mt-1"
                        placeholder="Ex: 19/05 au 23/05"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
