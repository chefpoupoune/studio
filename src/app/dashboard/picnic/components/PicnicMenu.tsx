
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
import { Save, CalendarDays, Trash2, Loader2 } from 'lucide-react';
import type { StoredPicnicMenuTemplate, DisplayedPicnicMenuWeek, PicnicMenuDayKey } from '../types';
import { PICNIC_MENU_MONTHS, PICNIC_MENU_DAY_KEYS, NUM_PICNIC_ITEM_SLOTS, PICNIC_MENU_DAYS_LABELS } from '../types';
import { format, getYear, getMonth, startOfMonth, endOfMonth, startOfWeek, addDays, eachWeekOfInterval } from 'date-fns';
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

const PICNIC_MASTER_TEMPLATES_STORAGE_KEY = "picnic_master_weekly_menu_templates_v1";

const currentSystemYear = getYear(new Date());
const years = Array.from({ length: 10 }, (_, i) => currentSystemYear - 5 + i);

const createEmptyDailyItems = (): string[] => Array(NUM_PICNIC_ITEM_SLOTS).fill('');

const createEmptyStoredTemplate = (): StoredPicnicMenuTemplate => ({
  days: PICNIC_MENU_DAY_KEYS.reduce((acc, day) => {
    acc[day] = createEmptyDailyItems();
    return acc;
  }, {} as Record<PicnicMenuDayKey, string[]>),
  weeklyNote: '',
});

const createInitialMasterTemplates = (): StoredPicnicMenuTemplate[] => {
  return Array(5).fill(null).map(() => createEmptyStoredTemplate());
};

export default function PicnicMenu() {
  const [selectedYear, setSelectedYear] = useState<number>(currentSystemYear);
  const [selectedMonthTab, setSelectedMonthTab] = useState<string>(PICNIC_MENU_MONTHS[0].value.toString());
  // This state now holds the 5 master templates for menu content
  const [storedMenuTemplates, setStoredMenuTemplates] = useState<StoredPicnicMenuTemplate[]>(createInitialMasterTemplates());
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    console.log("[PicnicMenu LOAD Master Templates] Attempting to load from localStorage...");
    try {
      const storedData = localStorage.getItem(PICNIC_MASTER_TEMPLATES_STORAGE_KEY);
      if (storedData) {
        const parsedData: StoredPicnicMenuTemplate[] = JSON.parse(storedData);
        if (Array.isArray(parsedData) && parsedData.length === 5) {
          // Ensure each template has the correct structure
          const validatedTemplates = parsedData.map(template => ({
            days: PICNIC_MENU_DAY_KEYS.reduce((acc, dayKey) => {
              const items = template.days?.[dayKey] || [];
              acc[dayKey] = Array.from({ length: NUM_PICNIC_ITEM_SLOTS }, (_, i) => items[i] || '');
              return acc;
            }, {} as Record<PicnicMenuDayKey, string[]>),
            weeklyNote: template.weeklyNote || '',
          }));
          setStoredMenuTemplates(validatedTemplates);
          console.log(`[PicnicMenu LOAD Master Templates] Loaded ${validatedTemplates.length} master templates from localStorage.`);
        } else {
          // Data is malformed or not an array of 5 templates, initialize
          setStoredMenuTemplates(createInitialMasterTemplates());
          console.log("[PicnicMenu LOAD Master Templates] Malformed data, initialized to 5 empty master templates.");
        }
      } else {
        setStoredMenuTemplates(createInitialMasterTemplates());
        console.log("[PicnicMenu LOAD Master Templates] No data in localStorage, initialized to 5 empty master templates.");
      }
    } catch (e) {
      console.error("[PicnicMenu LOAD Master Templates] Failed to load master templates:", e);
      setStoredMenuTemplates(createInitialMasterTemplates());
      toast({ title: "Erreur de chargement des modèles de menus Pique Nique", variant: "destructive" });
    } finally {
      setDataLoaded(true);
      console.log("[PicnicMenu LOAD Master Templates] Data loading finished, dataLoaded set to true.");
    }
  }, [isClient, toast]);


  useEffect(() => {
    if (!isClient || !dataLoaded) {
      console.log(`[PicnicMenu SAVE Master Templates SKIPPED] isClient: ${isClient}, dataLoaded: ${dataLoaded}`);
      return;
    }
    console.log(`[PicnicMenu SAVE Master Templates] Saving ${storedMenuTemplates.length} master templates to localStorage.`);
    localStorage.setItem(PICNIC_MASTER_TEMPLATES_STORAGE_KEY, JSON.stringify(storedMenuTemplates));
  }, [storedMenuTemplates, isClient, dataLoaded]);

  
  const handleSaveMenus = () => {
    if (!isClient) return;
    try {
      console.log(`[PicnicMenu Manual SAVE] Saving ${storedMenuTemplates.length} master templates to localStorage.`);
      localStorage.setItem(PICNIC_MASTER_TEMPLATES_STORAGE_KEY, JSON.stringify(storedMenuTemplates));
      toast({ title: "Modèles de Menus Pique Nique Enregistrés", description: "Vos modifications ont été sauvegardées." });
    } catch (e) {
      console.error("Failed to save picnic menu templates:", e);
      toast({ title: "Erreur de sauvegarde des modèles", variant: "destructive" });
    }
  };
  
  // Calculates date metadata for the 5 weeks of the selected month/year
  const weeksForSelectedMonth = useMemo(() => {
    if (!isClient) return [];
    const monthIndex = parseInt(selectedMonthTab, 10);
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
                startDate: currentWeekIterStartDate, 
                dateRangeDisplay: `${format(actualDisplayStartDate, 'dd/MM')} au ${format(actualDisplayEndDate, 'dd/MM')}`,
                id: `${selectedYear}-${monthIndex}-${weekCounter}`, // ID for display keying
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

  // Combines dynamic date metadata with persistent master template content
  const displayedWeeklyMenus: DisplayedPicnicMenuWeek[] = useMemo(() => {
    if (!isClient || storedMenuTemplates.length !== 5) return [];
    return weeksForSelectedMonth.map((weekMeta, index) => {
      const templateContent = storedMenuTemplates[index] || createEmptyStoredTemplate();
      return {
        id: weekMeta.id, // For React key
        year: selectedYear,
        monthIndex: parseInt(selectedMonthTab, 10),
        weekInMonth: weekMeta.weekInMonth,
        startDate: weekMeta.startDate.toISOString(),
        dateRangeDisplay: weekMeta.dateRangeDisplay,
        days: templateContent.days,
        weeklyNote: templateContent.weeklyNote,
      };
    });
  }, [weeksForSelectedMonth, storedMenuTemplates, selectedYear, selectedMonthTab, isClient]);


  const handleItemChange = (templateIndex: number, day: PicnicMenuDayKey, itemIndex: number, value: string) => {
    console.log(`[PicnicMenu handleItemChange] Called for templateIndex: ${templateIndex}, day: ${day}, itemIndex: ${itemIndex}, value: "${value}"`);
    if (templateIndex < 0 || templateIndex >= storedMenuTemplates.length) {
        console.error(`[PicnicMenu handleItemChange] Invalid templateIndex: ${templateIndex}`);
        return;
    }
    setStoredMenuTemplates(prevTemplates => {
      console.log(`[PicnicMenu handleItemChange] Inside setState. prevTemplates length: ${prevTemplates.length}`);
      return prevTemplates.map((template, index) => {
        if (index === templateIndex) {
          const updatedDays = { ...template.days };
          const dayItems = [...(updatedDays[day] || createEmptyDailyItems())]; // Ensure day array exists
          dayItems[itemIndex] = value;
          updatedDays[day] = dayItems;
          return { ...template, days: updatedDays };
        }
        return template;
      });
    });
  };

  const handleWeeklyNoteChange = (templateIndex: number, value: string) => {
    console.log(`[PicnicMenu handleWeeklyNoteChange] Called for templateIndex: ${templateIndex}, value: "${value}"`);
    if (templateIndex < 0 || templateIndex >= storedMenuTemplates.length) {
        console.error(`[PicnicMenu handleWeeklyNoteChange] Invalid templateIndex: ${templateIndex}`);
        return;
    }
    setStoredMenuTemplates(prevTemplates => {
       console.log(`[PicnicMenu handleWeeklyNoteChange] Inside setState. prevTemplates length: ${prevTemplates.length}`);
       return prevTemplates.map((template, index) => 
         index === templateIndex ? { ...template, weeklyNote: value } : template
       );
    });
  };
  
  const handleResetAllMasterTemplates = () => {
    if (!isClient) return;
    console.log(`[PicnicMenu ResetMasterTemplates] Resetting all 5 master templates.`);
    setStoredMenuTemplates(createInitialMasterTemplates());
    toast({ title: `Tous les modèles hebdomadaires ont été réinitialisés.`, description:"N'oubliez pas de sauvegarder pour que ce soit permanent.", variant: "destructive" });
  };

  if (!isClient || !dataLoaded) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Chargement des modèles de menus...</div>;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Planification des Menus Pique Nique (Modèles Hebdomadaires)</CardTitle>
        <CardDescription>
          Définissez les menus pour 5 modèles de semaine. Les dates s'adapteront au mois et à l'année sélectionnés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div>
            <Label htmlFor="year-select-picnic-menu">Année pour affichage des dates</Label>
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
              <SelectTrigger id="year-select-picnic-menu"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex-grow sm:flex-grow-0">
            <Button onClick={handleSaveMenus} className="w-full sm:w-auto">
              <Save className="mr-2 h-4 w-4" /> Sauvegarder Tous les Modèles
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
                      <Trash2 className="mr-2 h-4 w-4" /> Réinitialiser Tous les Modèles Hebdomadaires
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmer la réinitialisation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Êtes-vous sûr de vouloir effacer le contenu des 5 modèles hebdomadaires ? Ils seront remis à vide.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetAllMasterTemplates}>Réinitialiser</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {/* Display 5 weekly cards, using content from storedMenuTemplates and date context from displayedWeeklyMenus */}
              {displayedWeeklyMenus.filter(dm => dm.monthIndex === monthConfig.value).map((weeklyMenu, templateIdx) => (
                <Card key={weeklyMenu.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 py-3 px-4">
                    <CardTitle className="text-md flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground"/>
                      Modèle Semaine {templateIdx + 1} (Affiché pour: {weeklyMenu.dateRangeDisplay} {selectedYear})
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
                                    onChange={(e) => handleItemChange(templateIdx, dayKey, itemIndex, e.target.value)}
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
                      <Label htmlFor={`weekly-note-${templateIdx}`} className="text-xs">Note pour ce modèle de semaine</Label>
                      <Input
                        id={`weekly-note-${templateIdx}`}
                        type="text"
                        value={weeklyMenu.weeklyNote || ''}
                        onChange={(e) => handleWeeklyNoteChange(templateIdx, e.target.value)}
                        className="h-8 text-xs mt-1"
                        placeholder="Ex: Spécial vacances, Semaine allégée"
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
