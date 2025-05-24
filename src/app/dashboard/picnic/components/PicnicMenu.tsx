
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, CalendarDays, Trash2, Loader2 } from 'lucide-react';
import type { StoredPicnicMenuTemplate, DisplayedPicnicMenuWeek, PicnicMenuDayKey } from '../types';
import { PICNIC_MENU_MONTHS, PICNIC_MENU_DAY_KEYS, NUM_PICNIC_ITEM_SLOTS, PICNIC_MENU_DAYS_LABELS } from '../types';
import { format, getYear, startOfMonth, startOfWeek, addDays, eachWeekOfInterval, endOfWeek } from 'date-fns';
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

const PICNIC_MONTHLY_MENU_TEMPLATES_KEY = "picnic_monthly_menu_templates_v1";
const DISPLAY_CONTEXT_YEAR = getYear(new Date()); // For calculating week date ranges for display

const createEmptyDailyItems = (): string[] => Array(NUM_PICNIC_ITEM_SLOTS).fill('');

const createEmptyStoredTemplate = (): StoredPicnicMenuTemplate => ({
  days: PICNIC_MENU_DAY_KEYS.reduce((acc, day) => {
    acc[day] = createEmptyDailyItems();
    return acc;
  }, {} as Record<PicnicMenuDayKey, string[]>),
  weeklyNote: '',
});

const createInitialMonthlyTemplates = (): StoredPicnicMenuTemplate[] => {
  return Array(5).fill(null).map(() => createEmptyStoredTemplate());
};

export default function PicnicMenu() {
  const [selectedMonthTab, setSelectedMonthTab] = useState<string>(PICNIC_MENU_MONTHS[0].value.toString());
  // Stores all templates, keyed by month index (string "2" for Mars, "3" for Avril, etc.)
  const [allMonthlyTemplates, setAllMonthlyTemplates] = useState<Record<string, StoredPicnicMenuTemplate[]>>({});
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load all monthly templates from localStorage on mount
  useEffect(() => {
    if (!isClient) return;
    console.log("[PicnicMenu LOAD] Attempting to load all monthly templates from localStorage...");
    setDataLoaded(false);
    try {
      const storedData = localStorage.getItem(PICNIC_MONTHLY_MENU_TEMPLATES_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        // Ensure each month has its 5 templates, properly initialized
        const validatedMonthlyTemplates: Record<string, StoredPicnicMenuTemplate[]> = {};
        PICNIC_MENU_MONTHS.forEach(monthConfig => {
          const monthKey = monthConfig.value.toString();
          const monthTemplates = parsedData[monthKey] || createInitialMonthlyTemplates();
          validatedMonthlyTemplates[monthKey] = monthTemplates.map((template: any) => ({
            days: PICNIC_MENU_DAY_KEYS.reduce((acc, dayKey) => {
              const items = template?.days?.[dayKey] || [];
              acc[dayKey] = Array.from({ length: NUM_PICNIC_ITEM_SLOTS }, (_, i) => items[i] || '');
              return acc;
            }, {} as Record<PicnicMenuDayKey, string[]>),
            weeklyNote: template?.weeklyNote || '',
          })).slice(0, 5); // Ensure exactly 5 templates
           // Ensure 5 templates per month
           while (validatedMonthlyTemplates[monthKey].length < 5) {
            validatedMonthlyTemplates[monthKey].push(createEmptyStoredTemplate());
          }
        });
        setAllMonthlyTemplates(validatedMonthlyTemplates);
        console.log("[PicnicMenu LOAD] Loaded monthly templates from localStorage. Keys:", Object.keys(validatedMonthlyTemplates));
      } else {
        // Initialize all months if no data found
        const initialData: Record<string, StoredPicnicMenuTemplate[]> = {};
        PICNIC_MENU_MONTHS.forEach(monthConfig => {
          initialData[monthConfig.value.toString()] = createInitialMonthlyTemplates();
        });
        setAllMonthlyTemplates(initialData);
        console.log("[PicnicMenu LOAD] No data in localStorage, initialized all months with empty templates.");
      }
    } catch (e) {
      console.error("[PicnicMenu LOAD] Failed to load monthly templates from localStorage:", e);
      const initialData: Record<string, StoredPicnicMenuTemplate[]> = {};
      PICNIC_MENU_MONTHS.forEach(monthConfig => {
        initialData[monthConfig.value.toString()] = createInitialMonthlyTemplates();
      });
      setAllMonthlyTemplates(initialData);
      toast({ title: "Erreur de chargement des modèles de menus Pique Nique", description: "Les modèles ont été réinitialisés.", variant: "destructive" });
    } finally {
      setDataLoaded(true);
      console.log("[PicnicMenu LOAD] Data loading finished, dataLoaded set to true.");
    }
  }, [isClient, toast]);

  // Save all monthly templates to localStorage when they change
  useEffect(() => {
    if (!isClient || !dataLoaded) {
      console.log(`[PicnicMenu SAVE SKIPPED] isClient: ${isClient}, dataLoaded: ${dataLoaded}`);
      return;
    }
    if (Object.keys(allMonthlyTemplates).length > 0) { // Only save if not empty
        console.log(`[PicnicMenu SAVE] Saving all monthly templates to localStorage. Months: ${Object.keys(allMonthlyTemplates).length}`);
        localStorage.setItem(PICNIC_MONTHLY_MENU_TEMPLATES_KEY, JSON.stringify(allMonthlyTemplates));
    }
  }, [allMonthlyTemplates, isClient, dataLoaded]);
  
  const handleSaveMenus = () => {
    if (!isClient || !dataLoaded) return;
    try {
      console.log(`[PicnicMenu Manual SAVE] Saving all monthly templates to localStorage.`);
      localStorage.setItem(PICNIC_MONTHLY_MENU_TEMPLATES_KEY, JSON.stringify(allMonthlyTemplates));
      toast({ title: "Modèles de Menus Pique Nique Enregistrés", description: "Vos modifications ont été sauvegardées." });
    } catch (e) {
      console.error("Failed to save picnic menu templates:", e);
      toast({ title: "Erreur de sauvegarde des modèles", variant: "destructive" });
    }
  };
  
  const weeksForSelectedMonth = useMemo(() => {
    if (!isClient) return [];
    const monthIndex = parseInt(selectedMonthTab, 10);
    const monthStartDate = startOfMonth(new Date(DISPLAY_CONTEXT_YEAR, monthIndex));
    const monthEndDate = endOfWeek(addDays(monthStartDate, 30)); // Ensure we get enough days to form 5 weeks display context

    const weeksMeta: Array<{ weekInMonth: number; dateRangeDisplay: string; startDate: Date; id: string }> = [];
    let currentWeekIterStartDate = startOfWeek(monthStartDate, { weekStartsOn: 1 });
    let weekCounter = 1;

    while (weekCounter <= 5) {
        const displayStartDate = currentWeekIterStartDate;
        const displayEndDate = endOfWeek(currentWeekIterStartDate, { weekStartsOn: 1 });
        
        weeksMeta.push({
            weekInMonth: weekCounter,
            startDate: displayStartDate,
            dateRangeDisplay: `${format(displayStartDate, 'dd/MM')} au ${format(displayEndDate, 'dd/MM')}`,
            id: `${DISPLAY_CONTEXT_YEAR}-${monthIndex}-week${weekCounter}`,
        });
        weekCounter++;
        currentWeekIterStartDate = addDays(currentWeekIterStartDate, 7);
    }
    return weeksMeta.slice(0, 5);
  }, [selectedMonthTab, isClient]);

  const displayedWeeklyMenus: DisplayedPicnicMenuWeek[] = useMemo(() => {
    if (!isClient || Object.keys(allMonthlyTemplates).length === 0) return [];
    
    const currentMonthTemplates = allMonthlyTemplates[selectedMonthTab] || createInitialMonthlyTemplates();
    console.log(`[PicnicMenu displayedWeeklyMenus] For month ${selectedMonthTab}, found ${currentMonthTemplates.length} templates. weeksForSelectedMonth length: ${weeksForSelectedMonth.length}`);

    return weeksForSelectedMonth.map((weekMeta, index) => {
      const templateContent = currentMonthTemplates[index] || createEmptyStoredTemplate();
      return {
        id: weekMeta.id, 
        year: DISPLAY_CONTEXT_YEAR, 
        monthIndex: parseInt(selectedMonthTab, 10),
        weekInMonth: weekMeta.weekInMonth,
        startDate: weekMeta.startDate.toISOString(),
        dateRangeDisplay: weekMeta.dateRangeDisplay,
        days: templateContent.days,
        weeklyNote: templateContent.weeklyNote,
      };
    });
  }, [weeksForSelectedMonth, allMonthlyTemplates, selectedMonthTab, isClient]);

  const handleItemChange = useCallback((monthKey: string, templateIndex: number, day: PicnicMenuDayKey, itemIndex: number, value: string) => {
    if (!isClient || !dataLoaded) return;
    console.log(`[PicnicMenu handleItemChange] monthKey: ${monthKey}, templateIndex: ${templateIndex}, day: ${day}, itemIndex: ${itemIndex}, value: ${value}`);
    
    setAllMonthlyTemplates(prevAllMonthly => {
      console.log(`[PicnicMenu handleItemChange] prevAllMonthly keys: ${Object.keys(prevAllMonthly)}`);
      const newAllMonthly = { ...prevAllMonthly };
      
      // Ensure the month array exists
      if (!newAllMonthly[monthKey]) {
        newAllMonthly[monthKey] = createInitialMonthlyTemplates();
        console.log(`[PicnicMenu handleItemChange] Initialized templates for new monthKey: ${monthKey}`);
      }
      
      const monthTemplates = [...newAllMonthly[monthKey]];
      
      // Ensure the specific template exists
      if (!monthTemplates[templateIndex]) {
        monthTemplates[templateIndex] = createEmptyStoredTemplate();
         console.log(`[PicnicMenu handleItemChange] Initialized template at index ${templateIndex} for monthKey: ${monthKey}`);
      }
      
      const templateToUpdate = { ...monthTemplates[templateIndex] };
      const updatedDays = { ...templateToUpdate.days };
      const dayItems = Array.isArray(updatedDays[day]) ? [...updatedDays[day]] : createEmptyDailyItems();
      
      while (dayItems.length <= itemIndex) {
        dayItems.push('');
      }
      dayItems[itemIndex] = value;
      updatedDays[day] = dayItems;
      templateToUpdate.days = updatedDays;
      monthTemplates[templateIndex] = templateToUpdate;
      newAllMonthly[monthKey] = monthTemplates;

      console.log(`[PicnicMenu handleItemChange] Updated newAllMonthly for monthKey ${monthKey}, templateIndex ${templateIndex}`);
      return newAllMonthly;
    });
  }, [isClient, dataLoaded]);

  const handleWeeklyNoteChange = useCallback((monthKey: string, templateIndex: number, value: string) => {
    if (!isClient || !dataLoaded) return;
     console.log(`[PicnicMenu handleWeeklyNoteChange] monthKey: ${monthKey}, templateIndex: ${templateIndex}, value: ${value}`);

    setAllMonthlyTemplates(prevAllMonthly => {
      console.log(`[PicnicMenu handleWeeklyNoteChange] prevAllMonthly keys: ${Object.keys(prevAllMonthly)}`);
      const newAllMonthly = { ...prevAllMonthly };

      if (!newAllMonthly[monthKey]) {
        newAllMonthly[monthKey] = createInitialMonthlyTemplates();
         console.log(`[PicnicMenu handleWeeklyNoteChange] Initialized templates for new monthKey: ${monthKey}`);
      }
      
      const monthTemplates = [...newAllMonthly[monthKey]];

      if (!monthTemplates[templateIndex]) {
        monthTemplates[templateIndex] = createEmptyStoredTemplate();
        console.log(`[PicnicMenu handleWeeklyNoteChange] Initialized template at index ${templateIndex} for monthKey: ${monthKey}`);
      }
      
      const templateToUpdate = { ...monthTemplates[templateIndex], weeklyNote: value };
      monthTemplates[templateIndex] = templateToUpdate;
      newAllMonthly[monthKey] = monthTemplates;

      console.log(`[PicnicMenu handleWeeklyNoteChange] Updated newAllMonthly for monthKey ${monthKey}, templateIndex ${templateIndex}`);
      return newAllMonthly;
    });
  }, [isClient, dataLoaded]);
  
  const handleResetMonthTemplates = () => {
    if (!isClient) return;
    setAllMonthlyTemplates(prevAllMonthly => {
        const newAllMonthly = { ...prevAllMonthly };
        newAllMonthly[selectedMonthTab] = createInitialMonthlyTemplates();
        return newAllMonthly;
    });
    const monthLabel = PICNIC_MENU_MONTHS.find(m => m.value.toString() === selectedMonthTab)?.label || selectedMonthTab;
    toast({ title: `Modèles pour ${monthLabel} Réinitialisés`, description:"N'oubliez pas de sauvegarder pour que ce soit permanent.", variant: "destructive" });
  };

  if (!isClient || !dataLoaded) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Chargement des menus...</div>;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Planification des Menus Pique Nique (Modèles Mensuels)</CardTitle>
        <CardDescription>
          Définissez les 5 modèles de semaine pour chaque mois (Mars à Novembre). Les dates affichées s'adapteront au mois sélectionné pour donner un contexte.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
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
                      <Trash2 className="mr-2 h-4 w-4" /> Réinitialiser les Modèles pour {monthConfig.label}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmer la réinitialisation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Êtes-vous sûr de vouloir effacer le contenu des 5 modèles de semaine pour {monthConfig.label} ? Ils seront remis à vide.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetMonthTemplates}>Réinitialiser</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {/* Ensure displayedWeeklyMenus is filtered for the current month tab before mapping */}
              {displayedWeeklyMenus.filter(dm => dm.monthIndex.toString() === monthConfig.value.toString()).map((weeklyMenu, templateIdx) => (
                <Card key={weeklyMenu.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 py-3 px-4">
                    <CardTitle className="text-md flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground"/>
                      Semaine {templateIdx + 1} 
                      <span className="text-sm font-normal text-muted-foreground">
                        (Contexte {monthConfig.label}: {weeklyMenu.dateRangeDisplay})
                      </span>
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
                                    onChange={(e) => handleItemChange(monthConfig.value.toString(), templateIdx, dayKey, itemIndex, e.target.value)}
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
                      <Label htmlFor={`weekly-note-${monthConfig.value}-${templateIdx}`} className="text-xs">Note pour cette semaine ({monthConfig.label}, Sem. {templateIdx + 1})</Label>
                      <Input
                        id={`weekly-note-${monthConfig.value}-${templateIdx}`}
                        type="text"
                        value={weeklyMenu.weeklyNote || ''}
                        onChange={(e) => handleWeeklyNoteChange(monthConfig.value.toString(), templateIdx, e.target.value)}
                        className="h-8 text-xs mt-1"
                        placeholder="Ex: Spécial Pâques, Semaine allégée"
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

