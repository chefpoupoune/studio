
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
import { format, getYear, getMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addWeeks, addDays, isSameMonth, eachWeekOfInterval, getISOWeek, parseISO } from 'date-fns';
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
    id: `${year}-${monthIndex}-${weekInMonth}`, // monthIndex here is 0-11
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
  const [selectedMonthTab, setSelectedMonthTab] = useState<string>(PICNIC_MENU_MONTHS[0].value.toString()); // Mars by default (value: 2)
  const [allPicnicMenuWeeks, setAllPicnicMenuWeeks] = useState<PicnicMenuWeek[]>([]);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    try {
      const storedData = localStorage.getItem(PICNIC_WEEKLY_MENUS_STORAGE_KEY);
      if (storedData) {
        const parsedData: PicnicMenuWeek[] = JSON.parse(storedData);
        const validatedData = parsedData.map(week => ({
          ...week,
          startDate: week.startDate || startOfWeek(new Date(week.year, week.monthIndex, (week.weekInMonth -1) * 7 + 1), {weekStartsOn: 1}).toISOString(),
          days: PICNIC_MENU_DAY_KEYS.reduce((acc, dayKey) => {
            const items = week.days[dayKey] || [];
            acc[dayKey] = Array.from({ length: NUM_PICNIC_ITEM_SLOTS }, (_, i) => items[i] || '');
            return acc;
          }, {} as Record<PicnicMenuDayKey, string[]>),
        }));
        setAllPicnicMenuWeeks(validatedData);
      } else {
        setAllPicnicMenuWeeks([]); // Initialize as empty if nothing in localStorage
      }
    } catch (e) {
      console.error("Failed to load picnic menu data:", e);
      setAllPicnicMenuWeeks([]);
      toast({ title: "Erreur de chargement des menus Pique Nique", variant: "destructive" });
    }
  }, [toast, isClient]);

  const handleSaveMenus = () => {
    if (!isClient) return;
    try {
      localStorage.setItem(PICNIC_WEEKLY_MENUS_STORAGE_KEY, JSON.stringify(allPicnicMenuWeeks));
      toast({ title: "Menus Pique Nique Enregistrés", description: "Vos modifications ont été sauvegardées." });
    } catch (e) {
      console.error("Failed to save picnic menu data:", e);
      toast({ title: "Erreur de sauvegarde", variant: "destructive" });
    }
  };
  
  const weeksForSelectedMonth = useMemo(() => {
    if (!isClient) return [];
    const monthIndex = parseInt(selectedMonthTab, 10); // This is 0-indexed for Date needs
    const monthStartDate = startOfMonth(new Date(selectedYear, monthIndex));
    const monthEndDate = endOfMonth(monthStartDate);
    
    const weeks: Array<{ weekInMonth: number; dateRangeDisplay: string; startDate: Date; id: string }> = [];
    let currentWeekIterStartDate = startOfWeek(monthStartDate, { weekStartsOn: 1 });
    let weekCounter = 1;

    while (currentWeekIterStartDate <= monthEndDate && weeks.length < 5) {
        const actualDisplayStartDate = currentWeekIterStartDate < monthStartDate ? monthStartDate : currentWeekIterStartDate;
        let actualDisplayEndDate = endOfWeek(currentWeekIterStartDate, { weekStartsOn: 1 });
        actualDisplayEndDate = actualDisplayEndDate > monthEndDate ? monthEndDate : actualDisplayEndDate;

        if (actualDisplayStartDate <= monthEndDate) {
             weeks.push({
                weekInMonth: weekCounter,
                startDate: currentWeekIterStartDate, // The true Monday of that week
                dateRangeDisplay: `${format(actualDisplayStartDate, 'dd/MM')} au ${format(actualDisplayEndDate, 'dd/MM')}`,
                id: `${selectedYear}-${monthIndex}-${weekCounter}`,
            });
            weekCounter++;
        }
        currentWeekIterStartDate = addDays(currentWeekIterStartDate, 7);
    }
     while (weeks.length < 5) {
        const lastGeneratedWeekStartDate = weeks.length > 0 ? weeks[weeks.length - 1].startDate : startOfWeek(monthStartDate, { weekStartsOn: 1 });
        const nextWeekStartDateCalc = addDays(lastGeneratedWeekStartDate, (weeks.length > 0 ? 7 : (weekCounter-1)*7) );
        
        weeks.push({
            weekInMonth: weekCounter,
            startDate: nextWeekStartDateCalc,
            dateRangeDisplay: `${format(nextWeekStartDateCalc, 'dd/MM')} au ${format(endOfWeek(nextWeekStartDateCalc, { weekStartsOn: 1 }), 'dd/MM')}`,
            id: `${selectedYear}-${monthIndex}-${weekCounter}`,
        });
        weekCounter++;
    }
    return weeks.slice(0, 5);
  }, [selectedYear, selectedMonthTab, isClient]);

  const displayedWeeklyMenus = useMemo(() => {
    if (!isClient) return [];
    const monthIndex = parseInt(selectedMonthTab, 10);
    return weeksForSelectedMonth.map(weekMeta => {
      const existingMenu = allPicnicMenuWeeks.find(
        menu => menu.id === weekMeta.id
      );
      if (existingMenu) {
        return { ...existingMenu, dateRangeDisplay: weekMeta.dateRangeDisplay };
      }
      return createEmptyPicnicMenuWeek(selectedYear, monthIndex, weekMeta.weekInMonth, weekMeta.startDate);
    });
  }, [weeksForSelectedMonth, allPicnicMenuWeeks, selectedYear, selectedMonthTab, isClient]);

  const handleItemChange = (weekId: string, day: PicnicMenuDayKey, itemIndex: number, value: string) => {
    setAllPicnicMenuWeeks(prevMenus => {
      const menuIndex = prevMenus.findIndex(menu => menu.id === weekId);
      let newMenus = [...prevMenus];
  
      if (menuIndex !== -1) { // Week exists, update it
        const weekToUpdate = { ...newMenus[menuIndex] };
        // Ensure days and specific day array are initialized
        weekToUpdate.days = { ...weekToUpdate.days };
        const dayItems = [...(weekToUpdate.days[day] || createEmptyDailyItems())];
        
        dayItems[itemIndex] = value;
        weekToUpdate.days[day] = dayItems;
        newMenus[menuIndex] = weekToUpdate;
      } else { // Week doesn't exist, create and add it
        const weekMeta = weeksForSelectedMonth.find(wm => wm.id === weekId);
        if (weekMeta) {
          const newWeek = createEmptyPicnicMenuWeek(
            selectedYear,
            parseInt(selectedMonthTab, 10), // This is 0-indexed as expected by createEmptyPicnicMenuWeek
            weekMeta.weekInMonth,
            weekMeta.startDate // Use the actual Date object
          );
          
          // Now update the specific item in this new week
          const dayItems = [...(newWeek.days[day] || createEmptyDailyItems())]; // Should be empty from createEmptyDailyItems
          dayItems[itemIndex] = value;
          newWeek.days[day] = dayItems;
          newMenus.push(newWeek);
        } else {
          console.error(`PicnicMenu: Could not find weekMeta for new week ID: ${weekId} during creation.`);
          return prevMenus; // Important: return previous state if creation fails
        }
      }
      return newMenus;
    });
  };

  const handleWeeklyNoteChange = (weekId: string, value: string) => {
     setAllPicnicMenuWeeks(prevMenus => {
        const menuIndex = prevMenus.findIndex(menu => menu.id === weekId);
        let newMenus = [...prevMenus];

        if (menuIndex !== -1) { // Week exists
            newMenus[menuIndex] = { ...newMenus[menuIndex], weeklyNote: value };
        } else { // Week doesn't exist, create it
            const weekMeta = weeksForSelectedMonth.find(wm => wm.id === weekId);
            if (weekMeta) {
                const newWeek = createEmptyPicnicMenuWeek(
                    selectedYear,
                    parseInt(selectedMonthTab, 10),
                    weekMeta.weekInMonth,
                    weekMeta.startDate
                );
                newWeek.weeklyNote = value;
                newMenus.push(newWeek);
            } else {
                console.error(`PicnicMenu: Could not find weekMeta for new week ID: ${weekId} during note change.`);
                return prevMenus;
            }
        }
        return newMenus;
     });
  };
  
  const handleClearAllMenusForMonth = () => {
    if (!isClient) return;
    const monthIndexToClear = parseInt(selectedMonthTab, 10);
    const monthLabel = PICNIC_MENU_MONTHS.find(m => m.value === monthIndexToClear)?.label || `Mois ${monthIndexToClear + 1}`;
    
    setAllPicnicMenuWeeks(prevMenus => 
      prevMenus.filter(menu => !(menu.year === selectedYear && menu.monthIndex === monthIndexToClear))
    );
    toast({ title: `Tous les menus de ${monthLabel} ${selectedYear} ont été effacés.`, description:"N'oubliez pas de sauvegarder pour que ce soit permanent.", variant: "destructive" });
  };

  if (!isClient) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Chargement des menus...</div>;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Planification des Menus Pique Nique</CardTitle>
        <CardDescription>
          Définissez les menus pour chaque semaine des mois de Mars à Novembre. Les données sont sauvegardées automatiquement à chaque modification, mais utilisez le bouton "Sauvegarder" pour une sauvegarde explicite.
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
          <ScrollArea className="whitespace-nowrap pb-2">
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
                        Êtes-vous sûr de vouloir effacer tous les menus pour {monthConfig.label} {selectedYear} ? Les données seront réinitialisées pour ce mois.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAllMenusForMonth}>Effacer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {displayedWeeklyMenus.filter(wm => wm.monthIndex === monthConfig.value).map((weeklyMenu) => (
                <Card key={weeklyMenu.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 py-3 px-4">
                    <CardTitle className="text-md flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground"/>
                      Semaine {weeklyMenu.weekInMonth} - {weeklyMenu.dateRangeDisplay} ({selectedYear})
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
                      <Label htmlFor={`weekly-note-${weeklyMenu.id}`} className="text-xs">Note pour la semaine</Label>
                      <Input
                        id={`weekly-note-${weeklyMenu.id}`}
                        type="text"
                        value={weeklyMenu.weeklyNote || ''}
                        onChange={(e) => handleWeeklyNoteChange(weeklyMenu.id, e.target.value)}
                        className="h-8 text-xs mt-1"
                        placeholder="Ex: Précisions pour cette semaine"
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

    