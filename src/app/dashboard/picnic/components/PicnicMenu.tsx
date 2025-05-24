
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, CalendarDays, Trash2, Loader2, CheckCircle } from 'lucide-react';
import type { StoredPicnicMenuTemplate, DisplayedPicnicMenuWeek, PicnicMenuDayKey } from '../types';
import { PICNIC_MENU_MONTHS, PICNIC_MENU_DAY_KEYS, NUM_PICNIC_ITEM_SLOTS, PICNIC_MENU_DAYS_LABELS } from '../types';
import { format, getYear, startOfMonth, startOfWeek, addDays, eachWeekOfInterval, getMonth } from 'date-fns';
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
import { cn } from '@/lib/utils';

const PICNIC_MONTHLY_MENU_TEMPLATES_KEY = "picnic_monthly_menu_templates_v1";
const PICNIC_SELECTED_TEMPLATE_INDEX_KEY = "picnic_selected_template_index_v1"; // New key
const DISPLAY_CONTEXT_YEAR = getYear(new Date()); 

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
  const [allMonthlyTemplates, setAllMonthlyTemplates] = useState<Record<string, StoredPicnicMenuTemplate[]>>({});
  const [selectedTemplateIndices, setSelectedTemplateIndices] = useState<Record<string, number | null>>({}); // <monthIndex, templateIndex>
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    console.log("[PicnicMenu LOAD] Attempting to load all monthly templates and selections from localStorage...");
    setDataLoaded(false);
    try {
      // Load menu templates
      const storedTemplates = localStorage.getItem(PICNIC_MONTHLY_MENU_TEMPLATES_KEY);
      const initialTemplatesData: Record<string, StoredPicnicMenuTemplate[]> = {};
      PICNIC_MENU_MONTHS.forEach(monthConfig => {
        initialTemplatesData[monthConfig.value.toString()] = createInitialMonthlyTemplates();
      });

      if (storedTemplates) {
        const parsedTemplates = JSON.parse(storedTemplates);
        Object.keys(initialTemplatesData).forEach(monthKey => {
          if (parsedTemplates[monthKey] && Array.isArray(parsedTemplates[monthKey])) {
            initialTemplatesData[monthKey] = parsedTemplates[monthKey].map((template: any) => ({
              days: PICNIC_MENU_DAY_KEYS.reduce((acc, dayKey) => {
                const items = template?.days?.[dayKey] || [];
                acc[dayKey] = Array.from({ length: NUM_PICNIC_ITEM_SLOTS }, (_, i) => items[i] || '');
                return acc;
              }, {} as Record<PicnicMenuDayKey, string[]>),
              weeklyNote: template?.weeklyNote || '',
            })).slice(0, 5);
             while (initialTemplatesData[monthKey].length < 5) {
              initialTemplatesData[monthKey].push(createEmptyStoredTemplate());
            }
          }
        });
        setAllMonthlyTemplates(initialTemplatesData);
        console.log("[PicnicMenu LOAD] Loaded menu templates. Keys:", Object.keys(initialTemplatesData));
      } else {
        setAllMonthlyTemplates(initialTemplatesData);
        console.log("[PicnicMenu LOAD] No menu templates in localStorage, initialized all months.");
      }

      // Load selected template indices
      const storedSelectedIndices = localStorage.getItem(PICNIC_SELECTED_TEMPLATE_INDEX_KEY);
      if (storedSelectedIndices) {
        setSelectedTemplateIndices(JSON.parse(storedSelectedIndices));
        console.log("[PicnicMenu LOAD] Loaded selected template indices.");
      } else {
        setSelectedTemplateIndices({});
        console.log("[PicnicMenu LOAD] No selected template indices in localStorage.");
      }

    } catch (e) {
      console.error("[PicnicMenu LOAD] Failed to load data from localStorage:", e);
      const fallbackTemplates: Record<string, StoredPicnicMenuTemplate[]> = {};
      PICNIC_MENU_MONTHS.forEach(monthConfig => {
        fallbackTemplates[monthConfig.value.toString()] = createInitialMonthlyTemplates();
      });
      setAllMonthlyTemplates(fallbackTemplates);
      setSelectedTemplateIndices({});
      toast({ title: "Erreur de chargement des Menus Pique Nique", description: "Les modèles ont été réinitialisés.", variant: "destructive" });
    } finally {
      setDataLoaded(true);
      console.log("[PicnicMenu LOAD] Data loading finished, dataLoaded set to true.");
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (!isClient || !dataLoaded) return;
    if (Object.keys(allMonthlyTemplates).length > 0) {
        console.log(`[PicnicMenu SAVE Templates] Saving all monthly templates to localStorage. Months: ${Object.keys(allMonthlyTemplates).length}`);
        localStorage.setItem(PICNIC_MONTHLY_MENU_TEMPLATES_KEY, JSON.stringify(allMonthlyTemplates));
    }
  }, [allMonthlyTemplates, isClient, dataLoaded]);

  useEffect(() => {
    if (!isClient || !dataLoaded) return;
    if (Object.keys(selectedTemplateIndices).length > 0 || localStorage.getItem(PICNIC_SELECTED_TEMPLATE_INDEX_KEY)) { // Save even if it's an empty object to clear it
        console.log(`[PicnicMenu SAVE Selections] Saving selected template indices to localStorage.`);
        localStorage.setItem(PICNIC_SELECTED_TEMPLATE_INDEX_KEY, JSON.stringify(selectedTemplateIndices));
    }
  }, [selectedTemplateIndices, isClient, dataLoaded]);
  
  const handleSaveMenus = () => {
    if (!isClient || !dataLoaded) return;
    try {
      localStorage.setItem(PICNIC_MONTHLY_MENU_TEMPLATES_KEY, JSON.stringify(allMonthlyTemplates));
      localStorage.setItem(PICNIC_SELECTED_TEMPLATE_INDEX_KEY, JSON.stringify(selectedTemplateIndices));
      toast({ title: "Menus Pique Nique Enregistrés", description: "Vos modifications ont été sauvegardées." });
    } catch (e) {
      console.error("Failed to save picnic menus:", e);
      toast({ title: "Erreur de sauvegarde des menus", variant: "destructive" });
    }
  };
  
  const weeksForSelectedMonth = useMemo(() => {
    if (!isClient) return [];
    const monthIndex = parseInt(selectedMonthTab, 10);
    const monthStartDate = startOfMonth(new Date(DISPLAY_CONTEXT_YEAR, monthIndex));
    
    const weeksMeta: Array<{ weekInMonth: number; dateRangeDisplay: string; startDate: Date; id: string }> = [];
    let currentWeekIterStartDate = startOfWeek(monthStartDate, { weekStartsOn: 1 });
    let weekCounter = 1;

    while (weekCounter <= 5) {
        const displayStartDate = currentWeekIterStartDate;
        // Ensure end of week does not cross into next month for display purposes
        let displayEndDateCandidate = endOfWeek(currentWeekIterStartDate, { weekStartsOn: 1 });
        const endOfMonthForContext = endOfWeek(addDays(monthStartDate, 30)); // a boundary for display
        const displayEndDate = displayEndDateCandidate > endOfMonthForContext ? endOfMonthForContext : displayEndDateCandidate;

        weeksMeta.push({
            weekInMonth: weekCounter,
            startDate: displayStartDate,
            dateRangeDisplay: `${format(displayStartDate, 'dd/MM')} au ${format(displayEndDate, 'dd/MM')}`,
            id: `${DISPLAY_CONTEXT_YEAR}-${monthIndex}-week${weekCounter}`, // Unique ID for React key
        });
        weekCounter++;
        currentWeekIterStartDate = addDays(currentWeekIterStartDate, 7);
    }
    return weeksMeta.slice(0, 5);
  }, [selectedMonthTab, isClient]);

  const displayedWeeklyMenus: DisplayedPicnicMenuWeek[] = useMemo(() => {
    if (!isClient || Object.keys(allMonthlyTemplates).length === 0 || !weeksForSelectedMonth.length) return [];
    
    const currentMonthKey = selectedMonthTab;
    const templatesForCurrentMonth = allMonthlyTemplates[currentMonthKey] || createInitialMonthlyTemplates();
    
    return weeksForSelectedMonth.map((weekMeta, index) => {
      const templateContent = templatesForCurrentMonth[index] || createEmptyStoredTemplate();
      return {
        id: weekMeta.id, 
        year: DISPLAY_CONTEXT_YEAR, 
        monthIndex: parseInt(currentMonthKey, 10),
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
    
    setAllMonthlyTemplates(prevAllMonthly => {
      const newAllMonthly = JSON.parse(JSON.stringify(prevAllMonthly)); // Deep copy
      
      if (!newAllMonthly[monthKey]) {
        newAllMonthly[monthKey] = createInitialMonthlyTemplates();
      }
      
      const monthTemplates = newAllMonthly[monthKey];
      
      if (!monthTemplates[templateIndex]) {
        monthTemplates[templateIndex] = createEmptyStoredTemplate();
      }
      
      const templateToUpdate = monthTemplates[templateIndex];
      
      if (!templateToUpdate.days[day]) {
        templateToUpdate.days[day] = createEmptyDailyItems();
      }
      
      const dayItems = templateToUpdate.days[day];
      while (dayItems.length <= itemIndex) { // Ensure array is long enough
        dayItems.push('');
      }
      dayItems[itemIndex] = value;
      
      return newAllMonthly;
    });
  }, [isClient, dataLoaded]);

  const handleWeeklyNoteChange = useCallback((monthKey: string, templateIndex: number, value: string) => {
    if (!isClient || !dataLoaded) return;

    setAllMonthlyTemplates(prevAllMonthly => {
      const newAllMonthly = JSON.parse(JSON.stringify(prevAllMonthly)); // Deep copy

      if (!newAllMonthly[monthKey]) {
        newAllMonthly[monthKey] = createInitialMonthlyTemplates();
      }
      
      const monthTemplates = newAllMonthly[monthKey];

      if (!monthTemplates[templateIndex]) {
        monthTemplates[templateIndex] = createEmptyStoredTemplate();
      }
      
      monthTemplates[templateIndex].weeklyNote = value;
      return newAllMonthly;
    });
  }, [isClient, dataLoaded]);
  
  const handleResetMonthTemplates = (monthKeyToReset: string) => {
    if (!isClient) return;
    setAllMonthlyTemplates(prevAllMonthly => {
        const newAllMonthly = { ...prevAllMonthly };
        newAllMonthly[monthKeyToReset] = createInitialMonthlyTemplates();
        return newAllMonthly;
    });
    setSelectedTemplateIndices(prev => ({ ...prev, [monthKeyToReset]: null })); // Also reset selection for this month
    const monthLabel = PICNIC_MENU_MONTHS.find(m => m.value.toString() === monthKeyToReset)?.label || monthKeyToReset;
    toast({ title: `Modèles pour ${monthLabel} Réinitialisés`, description:"N'oubliez pas de sauvegarder.", variant: "destructive" });
  };

  const handleSelectTemplateForRecap = (monthKey: string, templateIndex: number) => {
    setSelectedTemplateIndices(prev => ({
      ...prev,
      [monthKey]: prev[monthKey] === templateIndex ? null : templateIndex, // Toggle selection
    }));
  };


  if (!isClient || !dataLoaded) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Chargement des menus...</div>;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Planification des Menus Pique Nique (Modèles Mensuels)</CardTitle>
        <CardDescription>
          Définissez 5 modèles de semaine pour chaque mois (Mars à Novembre). Les dates affichées s'adaptent au mois sélectionné pour donner un contexte.
          Sélectionnez un modèle par mois pour qu'il soit repris dans l'onglet "Récap".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-grow sm:flex-grow-0">
            <Button onClick={handleSaveMenus} className="w-full sm:w-auto">
              <Save className="mr-2 h-4 w-4" /> Sauvegarder Tous les Menus & Sélections
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
                      <AlertDialogAction onClick={() => handleResetMonthTemplates(monthConfig.value.toString())}>Réinitialiser</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {displayedWeeklyMenus.filter(dm => dm.monthIndex.toString() === monthConfig.value.toString()).map((weeklyMenu, templateIdx) => {
                const isSelectedForRecap = selectedTemplateIndices[monthConfig.value.toString()] === templateIdx;
                return (
                <Card key={weeklyMenu.id} className={cn("overflow-hidden", isSelectedForRecap && "ring-2 ring-primary shadow-lg")}>
                  <CardHeader className="bg-muted/30 py-3 px-4">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-md flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-muted-foreground"/>
                            Modèle Semaine {templateIdx + 1} 
                            <span className="text-sm font-normal text-muted-foreground">
                                (Contexte {monthConfig.label}: {weeklyMenu.dateRangeDisplay})
                            </span>
                        </CardTitle>
                        <Button 
                            size="sm" 
                            variant={isSelectedForRecap ? "default" : "outline"}
                            onClick={() => handleSelectTemplateForRecap(monthConfig.value.toString(), templateIdx)}
                            className="text-xs"
                        >
                            {isSelectedForRecap ? <CheckCircle className="mr-2 h-4 w-4"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                            {isSelectedForRecap ? "Sélectionné pour Récap" : "Utiliser pour Récap"}
                        </Button>
                    </div>
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
                      <Label htmlFor={`weekly-note-${monthConfig.value}-${templateIdx}`} className="text-xs">Note pour ce modèle de semaine ({monthConfig.label}, Sem. {templateIdx + 1})</Label>
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
              )})}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

    