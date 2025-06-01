
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, CalendarDays, Trash2, Loader2, CheckCircle, PlusCircle } from 'lucide-react';
import type { StoredPicnicMenuTemplate, DisplayedPicnicMenuWeek, PicnicMenuDayKey } from '../types';
import { PICNIC_MENU_MONTHS, PICNIC_MENU_DAY_KEYS, NUM_PICNIC_ITEM_SLOTS, PICNIC_MENU_DAYS_LABELS } from '../types';
import { format, getYear, startOfMonth, startOfWeek, addDays, endOfWeek, getMonth, endOfMonth } from 'date-fns';
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
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

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

const FIRESTORE_SELECTIONS_DOC_ID = "globalPicnicRecapSelections";

export default function PicnicMenu() {
  const [selectedMonthTab, setSelectedMonthTab] = useState<string>(PICNIC_MENU_MONTHS[0].value.toString());
  const [allMonthlyTemplates, setAllMonthlyTemplates] = useState<Record<string, StoredPicnicMenuTemplate[]>>({});
  const [selectedTemplateIndices, setSelectedTemplateIndices] = useState<Record<string, number | null>>({});
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const loadInitialData = async () => {
      console.log("[PicnicMenu LOAD] Starting initial data load from Firestore...");
      setDataLoaded(false); // Explicitly set to false at the start of loading
      //setIsSaving(true); // Block UI interactions during this critical initial phase

      try {
        // Load menu templates
        const templatesCollectionRef = collection(firestore, 'picnicMenuTemplates');
        const templatesSnapshot = await getDocs(templatesCollectionRef);
        const loadedTemplates: Record<string, StoredPicnicMenuTemplate[]> = {};
        
        templatesSnapshot.forEach(docSnap => {
          const monthKey = docSnap.id;
          const data = docSnap.data();
          if (data.templates && Array.isArray(data.templates)) {
             loadedTemplates[monthKey] = data.templates.map((template: any) => ({
                days: PICNIC_MENU_DAY_KEYS.reduce((acc, dayKey) => {
                    const items = template?.days?.[dayKey] || [];
                    acc[dayKey] = Array.from({ length: NUM_PICNIC_ITEM_SLOTS }, (_, i) => items[i] || '');
                    return acc;
                }, {} as Record<PicnicMenuDayKey, string[]>),
                weeklyNote: template?.weeklyNote || '',
            }));
          }
        });

        // Ensure all defined months have templates, create if not found in Firestore
        const batch = writeBatch(firestore);
        let needsInitialTemplateWrite = false;

        PICNIC_MENU_MONTHS.forEach(monthConfig => {
          const monthKey = monthConfig.value.toString();
          if (!loadedTemplates[monthKey] || loadedTemplates[monthKey].length < 5) {
            const initialTemplatesForMonth = createInitialMonthlyTemplates();
            loadedTemplates[monthKey] = initialTemplatesForMonth;
            const monthDocRef = doc(firestore, 'picnicMenuTemplates', monthKey);
            batch.set(monthDocRef, { templates: initialTemplatesForMonth });
            needsInitialTemplateWrite = true;
            console.log(`[PicnicMenu LOAD] Initializing empty templates for month ${monthKey} and adding to Firestore batch.`);
          }
        });

        if (needsInitialTemplateWrite) {
          await batch.commit();
          console.log("[PicnicMenu LOAD] Firestore batch for initial templates committed.");
        }
        
        setAllMonthlyTemplates(loadedTemplates);
        console.log("[PicnicMenu LOAD] Loaded and/or initialized menu templates. Keys:", Object.keys(loadedTemplates));

        // Load selected template indices
        const selectionsDocRef = doc(firestore, 'picnicMenuSelections', FIRESTORE_SELECTIONS_DOC_ID);
        const selectionsDocSnap = await getDoc(selectionsDocRef);
        if (selectionsDocSnap.exists()) {
          setSelectedTemplateIndices(selectionsDocSnap.data() as Record<string, number | null>);
          console.log("[PicnicMenu LOAD] Loaded selected template indices from Firestore.");
        } else {
          // If selections doc doesn't exist, create it with empty selections
          await setDoc(selectionsDocRef, {});
          setSelectedTemplateIndices({});
          console.log("[PicnicMenu LOAD] No selected template indices in Firestore, created empty selections document.");
        }

      } catch (e) {
        console.error("[PicnicMenu LOAD] Failed to load data from Firestore:", e);
        const fallbackTemplates: Record<string, StoredPicnicMenuTemplate[]> = {};
        PICNIC_MENU_MONTHS.forEach(monthConfig => {
          fallbackTemplates[monthConfig.value.toString()] = createInitialMonthlyTemplates();
        });
        setAllMonthlyTemplates(fallbackTemplates);
        setSelectedTemplateIndices({});
        toast({ title: "Erreur de chargement des Menus Pique Nique", description: "Les modèles ont été réinitialisés.", variant: "destructive" });
      } finally {
        setDataLoaded(true); // Set to true only after all operations are done
        //setIsSaving(false); // Release UI block
        console.log("[PicnicMenu LOAD] Data loading finished.");
      }
    };
    
    loadInitialData();

  }, [isClient, toast]); // Removed getFirestoreDocId as it was not defined or needed here
  
  const handleSaveAllData = async () => {
    if (!isClient || !dataLoaded || isSaving) {
      toast({ title: "Opération Impossible", description: "Attendez la fin du chargement ou d'une sauvegarde en cours.", variant: "default"});
      return;
    }
    setIsSaving(true);
    console.log("[PicnicMenu SAVE] Attempting to Save All Data to Firestore...");
    try {
      const batch = writeBatch(firestore);

      Object.entries(allMonthlyTemplates).forEach(([monthKey, templates]) => {
        const monthDocRef = doc(firestore, 'picnicMenuTemplates', monthKey);
        batch.set(monthDocRef, { templates });
      });
      console.log(`[PicnicMenu SAVE] Added ${Object.keys(allMonthlyTemplates).length} monthly templates to batch.`);

      const selectionsDocRef = doc(firestore, 'picnicMenuSelections', FIRESTORE_SELECTIONS_DOC_ID);
      batch.set(selectionsDocRef, selectedTemplateIndices);
      console.log("[PicnicMenu SAVE] Added selected template indices to batch.");

      await batch.commit();
      toast({ title: "Menus Pique Nique Enregistrés", description: "Vos modifications ont été sauvegardées avec succès dans Firestore." });
      console.log("[PicnicMenu SAVE] Firestore batch commit successful.");
    } catch (e) {
      console.error("Failed to save picnic menus and selections to Firestore:", e);
      toast({ title: "Erreur de sauvegarde des menus", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const weeksForSelectedMonth = useMemo(() => {
    if (!isClient) return [];
    const monthIndex = parseInt(selectedMonthTab, 10);
    const monthStartDate = startOfMonth(new Date(DISPLAY_CONTEXT_YEAR, monthIndex));
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
                startDate: actualDisplayStartDate, 
                dateRangeDisplay: `${format(actualDisplayStartDate, 'dd/MM')} au ${format(actualDisplayEndDate, 'dd/MM')}`,
                id: `${DISPLAY_CONTEXT_YEAR}-${monthIndex}-week${weekCounter}`, 
            });
            weekCounter++;
        }
        currentWeekIterStartDate = addDays(currentWeekIterStartDate, 7);
    }
    // Fill up to 5 weeks for display, even if they fall outside the actual month days for context
    while (weeks.length < 5 && weekCounter <= 5) {
        // For placeholder weeks, calculate a nominal start date based on the last real week or month start.
        const placeholderStartDate = addDays(weeks.length > 0 ? weeks[weeks.length - 1].startDate : monthStartDate, weeks.length > 0 ? 7 * (weekCounter - weeks.length) : (weekCounter -1) * 7 );
        weeks.push({
            weekInMonth: weekCounter,
            startDate: placeholderStartDate,
            dateRangeDisplay: `Modèle Semaine ${weekCounter}`, // Generic label for placeholder
            id: `${DISPLAY_CONTEXT_YEAR}-${monthIndex}-week${weekCounter}-placeholder`,
        });
        weekCounter++;
    }
    return weeks.slice(0, 5); // Ensure always 5 entries for the 5 templates
  }, [selectedMonthTab, isClient]);

  const displayedWeeklyMenus: DisplayedPicnicMenuWeek[] = useMemo(() => {
    if (!isClient || !dataLoaded || Object.keys(allMonthlyTemplates).length === 0 || !weeksForSelectedMonth.length) {
      return Array(5).fill(null).map((_, index) => ({ // Return empty structure if data not ready
        id: `placeholder-week-${index}`,
        year: DISPLAY_CONTEXT_YEAR,
        monthIndex: parseInt(selectedMonthTab, 10),
        weekInMonth: index + 1,
        startDate: new Date().toISOString(), // Placeholder date
        dateRangeDisplay: `Modèle Semaine ${index + 1}`,
        days: createEmptyStoredTemplate().days,
        weeklyNote: '',
      }));
    }
    
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
        weeklyNote: templateContent.weeklyNote || '', // Ensure weeklyNote is always a string
      };
    });
  }, [weeksForSelectedMonth, allMonthlyTemplates, selectedMonthTab, isClient, dataLoaded]);

  const handleItemChange = useCallback((monthKey: string, templateIndex: number, day: PicnicMenuDayKey, itemIndex: number, value: string) => {
    if (!isClient || !dataLoaded) return;
    setAllMonthlyTemplates(prevAllMonthly => {
      const newAllMonthly = JSON.parse(JSON.stringify(prevAllMonthly)); 
      
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
      while (dayItems.length <= itemIndex) { 
        dayItems.push('');
      }
      dayItems[itemIndex] = value;
      return newAllMonthly;
    });
  }, [isClient, dataLoaded]);

  const handleWeeklyNoteChange = useCallback((monthKey: string, templateIndex: number, value: string) => {
    if (!isClient || !dataLoaded) return;
    setAllMonthlyTemplates(prevAllMonthly => {
      const newAllMonthly = JSON.parse(JSON.stringify(prevAllMonthly)); 
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
    if (!isClient || isSaving || !dataLoaded) return;
    setAllMonthlyTemplates(prevAllMonthly => {
        const newAllMonthly = { ...prevAllMonthly };
        newAllMonthly[monthKeyToReset] = createInitialMonthlyTemplates();
        return newAllMonthly;
    });
    setSelectedTemplateIndices(prev => ({ ...prev, [monthKeyToReset]: null }));
    const monthLabel = PICNIC_MENU_MONTHS.find(m => m.value.toString() === monthKeyToReset)?.label || monthKeyToReset;
    toast({ title: `Modèles pour ${monthLabel} Réinitialisés`, description:"N'oubliez pas de sauvegarder pour appliquer les changements.", variant: "destructive" });
  };

  const handleSelectTemplateForRecap = (monthKey: string, templateIndex: number) => {
    if(isSaving || !dataLoaded) return;
    setSelectedTemplateIndices(prev => ({
      ...prev,
      [monthKey]: prev[monthKey] === templateIndex ? null : templateIndex, 
    }));
  };


  if (!isClient || !dataLoaded) { // Display loading indicator until dataLoaded is true
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/> Chargement des modèles de menus...</div>;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Planification des Menus Pique Nique (Modèles Mensuels)</CardTitle>
        <CardDescription>
          Définissez jusqu'à 5 modèles de semaine pour chaque mois (Mars à Novembre). Les dates affichées s'adaptent au mois sélectionné pour donner un contexte.
          Sélectionnez un modèle par mois (bouton "Utiliser pour Récap") pour qu'il soit repris dans l'onglet "Recap". Les données sont sauvegardées dans Firestore.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-grow sm:flex-grow-0">
            <Button onClick={handleSaveAllData} className="w-full sm:w-auto" disabled={isSaving || !dataLoaded}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
              Sauvegarder Menus & Sélections
            </Button>
          </div>
        </div>

        <Tabs value={selectedMonthTab} onValueChange={setSelectedMonthTab} className="w-full">
          <ScrollArea className="whitespace-nowrap pb-2">
            <TabsList>
              {PICNIC_MENU_MONTHS.map(month => (
                <TabsTrigger key={month.value} value={month.value.toString()} disabled={isSaving || !dataLoaded}>{month.label}</TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          {PICNIC_MENU_MONTHS.map(monthConfig => (
            <TabsContent key={monthConfig.value} value={monthConfig.value.toString()} className="mt-4 space-y-6">
              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isSaving || !dataLoaded}>
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
                             {weeklyMenu.dateRangeDisplay}
                        </CardTitle>
                        <Button 
                            size="sm" 
                            variant={isSelectedForRecap ? "default" : "outline"}
                            onClick={() => handleSelectTemplateForRecap(monthConfig.value.toString(), templateIdx)}
                            className="text-xs"
                            disabled={isSaving || !dataLoaded}
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
                                    value={allMonthlyTemplates[monthConfig.value.toString()]?.[templateIdx]?.days[dayKey]?.[itemIndex] || ''}
                                    onChange={(e) => handleItemChange(monthConfig.value.toString(), templateIdx, dayKey, itemIndex, e.target.value)}
                                    className="h-8 text-xs"
                                    disabled={isSaving || !dataLoaded}
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
                        value={allMonthlyTemplates[monthConfig.value.toString()]?.[templateIdx]?.weeklyNote || ''}
                        onChange={(e) => handleWeeklyNoteChange(monthConfig.value.toString(), templateIdx, e.target.value)}
                        className="h-8 text-xs mt-1"
                        placeholder="Ex: Spécial Pâques, Semaine allégée"
                        disabled={isSaving || !dataLoaded}
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

    