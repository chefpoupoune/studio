
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
  const [isLoading, setIsLoading] = useState(true); 
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const loadInitialData = async () => {
      console.log("[PicnicMenu LOAD] Starting initial data load from Firestore...");
      setIsLoading(true); 

      let finalTemplatesForState: Record<string, StoredPicnicMenuTemplate[]> = {};
      let finalSelectionsForState: Record<string, number | null> = {};
      let batchNeedsCommit = false;
      const batch = writeBatch(firestore);

      try {
        // 1. Prepare expected structure for allMonthlyTemplates
        PICNIC_MENU_MONTHS.forEach(monthConfig => {
          finalTemplatesForState[monthConfig.value.toString()] = createInitialMonthlyTemplates();
        });

        // 2. Load menu templates from Firestore
        const templatesCollectionRef = collection(firestore, 'picnicMenuTemplates');
        const templatesSnapshot = await getDocs(templatesCollectionRef);
        
        templatesSnapshot.forEach(docSnap => {
          const monthKey = docSnap.id;
          const data = docSnap.data();
          if (data.templates && Array.isArray(data.templates) && finalTemplatesForState[monthKey]) {
             const loadedMonthTemplates = data.templates.map((template: any) => ({
                days: PICNIC_MENU_DAY_KEYS.reduce((acc, dayKey) => {
                    const items = template?.days?.[dayKey] || [];
                    acc[dayKey] = Array.from({ length: NUM_PICNIC_ITEM_SLOTS }, (_, i) => items[i] || '');
                    return acc;
                }, {} as Record<PicnicMenuDayKey, string[]>),
                weeklyNote: template?.weeklyNote || '',
            }));
            // Ensure we always have 5 templates per month, filling with defaults if necessary
            finalTemplatesForState[monthKey] = Array.from({ length: 5 }, (_, i) => loadedMonthTemplates[i] || createEmptyStoredTemplate());
          }
        });
        
        // 3. Check if any month needs to be initialized in Firestore
        PICNIC_MENU_MONTHS.forEach(monthConfig => {
          const monthKey = monthConfig.value.toString();
          const templatesInDb = templatesSnapshot.docs.find(d => d.id === monthKey)?.data()?.templates;
          if (!templatesInDb || templatesInDb.length < 5) {
            const monthDocRef = doc(firestore, 'picnicMenuTemplates', monthKey);
            batch.set(monthDocRef, { templates: finalTemplatesForState[monthKey] }); // Use the already prepared finalTemplatesForState
            batchNeedsCommit = true;
            console.log(`[PicnicMenu LOAD] Month ${monthKey} templates will be initialized/updated in Firestore.`);
          }
        });
        
        // 4. Load selected template indices
        const selectionsDocRef = doc(firestore, 'picnicMenuSelections', FIRESTORE_SELECTIONS_DOC_ID);
        const selectionsDocSnap = await getDoc(selectionsDocRef);
        if (selectionsDocSnap.exists()) {
          finalSelectionsForState = selectionsDocSnap.data() as Record<string, number | null>;
          console.log("[PicnicMenu LOAD] Loaded selected template indices from Firestore.");
        } else {
          batch.set(selectionsDocRef, {}); // Create empty selections doc
          batchNeedsCommit = true;
          console.log("[PicnicMenu LOAD] No selected template indices in Firestore, will create empty selections document.");
        }

        if (batchNeedsCommit) {
          await batch.commit();
          console.log("[PicnicMenu LOAD] Firestore batch for initial templates/selections committed.");
        }
        
        setAllMonthlyTemplates(finalTemplatesForState);
        setSelectedTemplateIndices(finalSelectionsForState);
        console.log("[PicnicMenu LOAD] Menu templates and selections state updated.");

      } catch (e: any) {
        console.error("[PicnicMenu LOAD] Failed to load data from Firestore:", e.message || e);
        // Fallback to all empty defaults if there's a major error
        const fallbackTemplates: Record<string, StoredPicnicMenuTemplate[]> = {};
        PICNIC_MENU_MONTHS.forEach(monthConfig => {
          fallbackTemplates[monthConfig.value.toString()] = createInitialMonthlyTemplates();
        });
        setAllMonthlyTemplates(fallbackTemplates);
        setSelectedTemplateIndices({});
        toast({ title: "Erreur de chargement des Menus Pique Nique", description: `Les modèles ont été réinitialisés. Détail: ${e.message || 'Erreur inconnue'}`, variant: "destructive" });
      } finally {
        setIsLoading(false); 
        console.log("[PicnicMenu LOAD] Data loading finished.");
      }
    };
    
    loadInitialData();

  }, [isClient, toast]); 
  
  const handleSaveAllData = useCallback(async () => {
    if (!isClient || isLoading || isSaving) {
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
    } catch (e: any) {
      console.error("Failed to save picnic menus and selections to Firestore:", e.message || e);
      toast({ title: "Erreur de sauvegarde des menus", variant: "destructive", description: e.message || String(e) });
    } finally {
      setIsSaving(false);
    }
  }, [isClient, isLoading, isSaving, allMonthlyTemplates, selectedTemplateIndices, toast]);
  
  const weeksForSelectedMonth = useMemo(() => {
    if (!isClient || isLoading) return [];
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
    while (weeks.length < 5 && weekCounter <= 5) {
        const placeholderStartDate = addDays(weeks.length > 0 ? weeks[weeks.length - 1].startDate : monthStartDate, weeks.length > 0 ? 7 * (weekCounter - weeks.length) : (weekCounter -1) * 7 );
        weeks.push({
            weekInMonth: weekCounter,
            startDate: placeholderStartDate,
            dateRangeDisplay: `Modèle Semaine ${weekCounter}`,
            id: `${DISPLAY_CONTEXT_YEAR}-${monthIndex}-week${weekCounter}-placeholder`,
        });
        weekCounter++;
    }
    return weeks.slice(0, 5);
  }, [selectedMonthTab, isClient, isLoading]);

  const displayedWeeklyMenus: DisplayedPicnicMenuWeek[] = useMemo(() => {
    if (!isClient || isLoading || Object.keys(allMonthlyTemplates).length === 0 || weeksForSelectedMonth.length === 0) {
      return Array(5).fill(null).map((_, index) => ({ 
        id: `placeholder-week-${index}`,
        year: DISPLAY_CONTEXT_YEAR,
        monthIndex: parseInt(selectedMonthTab, 10),
        weekInMonth: index + 1,
        startDate: new Date().toISOString(),
        dateRangeDisplay: `Modèle Semaine ${index + 1}`,
        days: createEmptyStoredTemplate().days,
        weeklyNote: '',
      }));
    }
    
    const currentMonthKey = selectedMonthTab;
    const templatesForCurrentMonthRaw = allMonthlyTemplates[currentMonthKey] || [];
    const templatesForCurrentMonth = Array.from({ length: 5 }, (_, i) => 
        templatesForCurrentMonthRaw[i] || createEmptyStoredTemplate()
    );
    
    return weeksForSelectedMonth.map((weekMeta, index) => {
      const templateContent = templatesForCurrentMonth[index];
      return {
        id: weekMeta.id, 
        year: DISPLAY_CONTEXT_YEAR, 
        monthIndex: parseInt(currentMonthKey, 10),
        weekInMonth: weekMeta.weekInMonth,
        startDate: weekMeta.startDate.toISOString(), 
        dateRangeDisplay: weekMeta.dateRangeDisplay,
        days: templateContent.days,
        weeklyNote: templateContent.weeklyNote || '',
      };
    });
  }, [weeksForSelectedMonth, allMonthlyTemplates, selectedMonthTab, isClient, isLoading]);

  const handleItemChange = useCallback((monthKey: string, templateIndex: number, day: PicnicMenuDayKey, itemIndex: number, value: string) => {
    if (!isClient || isLoading || isSaving) return;
    setAllMonthlyTemplates(prevAllMonthly => {
      const newAllMonthly = JSON.parse(JSON.stringify(prevAllMonthly)); 
      
      // Ensure month and template exist
      if (!newAllMonthly[monthKey]) newAllMonthly[monthKey] = createInitialMonthlyTemplates();
      if (!newAllMonthly[monthKey][templateIndex]) newAllMonthly[monthKey][templateIndex] = createEmptyStoredTemplate();
      
      const templateToUpdate = newAllMonthly[monthKey][templateIndex];
      if (!templateToUpdate.days[day]) templateToUpdate.days[day] = createEmptyDailyItems();
      
      const dayItems = templateToUpdate.days[day];
      while (dayItems.length <= itemIndex) dayItems.push('');
      dayItems[itemIndex] = value;
      
      return newAllMonthly;
    });
  }, [isClient, isLoading, isSaving]);

  const handleWeeklyNoteChange = useCallback((monthKey: string, templateIndex: number, value: string) => {
    if (!isClient || isLoading || isSaving) return;
    setAllMonthlyTemplates(prevAllMonthly => {
      const newAllMonthly = JSON.parse(JSON.stringify(prevAllMonthly)); 
      if (!newAllMonthly[monthKey]) newAllMonthly[monthKey] = createInitialMonthlyTemplates();
      if (!newAllMonthly[monthKey][templateIndex]) newAllMonthly[monthKey][templateIndex] = createEmptyStoredTemplate();
      newAllMonthly[monthKey][templateIndex].weeklyNote = value;
      return newAllMonthly;
    });
  }, [isClient, isLoading, isSaving]);
  
  const handleResetMonthTemplates = (monthKeyToReset: string) => {
    if (!isClient || isSaving || isLoading) return;
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
    if(isSaving || isLoading) return;
    setSelectedTemplateIndices(prev => ({
      ...prev,
      [monthKey]: prev[monthKey] === templateIndex ? null : templateIndex, 
    }));
  };

  if (!isClient || isLoading) { 
    return (
      <Card className="shadow-lg">
        <CardHeader><CardTitle>Planification des Menus Pique Nique</CardTitle></CardHeader>
        <CardContent className="flex justify-center items-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2"/> Chargement des modèles de menus...
        </CardContent>
      </Card>
    );
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
            <Button onClick={handleSaveAllData} className="w-full sm:w-auto" disabled={isSaving || isLoading}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
              Sauvegarder Menus & Sélections
            </Button>
          </div>
        </div>

        <Tabs value={selectedMonthTab} onValueChange={setSelectedMonthTab} className="w-full">
          <ScrollArea className="whitespace-nowrap pb-2">
            <TabsList>
              {PICNIC_MENU_MONTHS.map(month => (
                <TabsTrigger key={month.value} value={month.value.toString()} disabled={isSaving || isLoading}>{month.label}</TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          {PICNIC_MENU_MONTHS.map(monthConfig => (
            <TabsContent key={monthConfig.value} value={monthConfig.value.toString()} className="mt-4 space-y-6">
              <div className="flex justify-end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={isSaving || isLoading}>
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
                            disabled={isSaving || isLoading}
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
                                    value={(allMonthlyTemplates[monthConfig.value.toString()]?.[templateIdx]?.days[dayKey]?.[itemIndex]) || ''}
                                    onChange={(e) => handleItemChange(monthConfig.value.toString(), templateIdx, dayKey, itemIndex, e.target.value)}
                                    className="h-8 text-xs"
                                    disabled={isSaving || isLoading}
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
                        disabled={isSaving || isLoading}
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
