"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText, Trash2, AlertCircle, ListFilter, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth, getDate, startOfWeek, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { SimplifiedTaskRecord, SimplifiedMonthlyKitchenCleaningRecord as SimplifiedMonthlyRestaurantCleaningRecord, PmsZoneWithTasksDefinition as PmsRestaurantZoneWithTasksDefinition, PmsConfigurations } from '../types';
import { PMS_RESTAURANT_CLEANING_KEY } from '@/app/dashboard/settings/types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const currentFullYear = new Date().getFullYear();
const yearsArray = Array.from({ length: 10 }, (_, i) => currentFullYear - 5 + i);
const monthsArray = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentFullYear, i), "MMMM", { locale: fr }),
}));

const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

export default function RestaurantCleaningMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  const [configuredZones, setConfiguredZones] = useState<PmsRestaurantZoneWithTasksDefinition[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(undefined);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [cleaningRecords, setCleaningRecords] = useState<SimplifiedMonthlyRestaurantCleaningRecord>({});
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoggedInUsername(localStorage.getItem(LOGGED_IN_USERNAME_KEY));
    }
  }, []);

  const getFirestoreRecordsDocId = useCallback(() => `records_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  const loadPmsConfigurations = useCallback(async () => {
    setIsLoadingConfig(true);
    const pmsSettingsDocRef = doc(firestore, "pmsConfigurations", "mainConfig");
    let fetchedZones: PmsRestaurantZoneWithTasksDefinition[] = [];
    try {
      const pmsSettingsSnap = await getDoc(pmsSettingsDocRef);
      if (pmsSettingsSnap.exists()) {
        const pmsSettings = pmsSettingsSnap.data() as PmsConfigurations;
        fetchedZones = pmsSettings[PMS_RESTAURANT_CLEANING_KEY] || [];
      } else {
        toast({ title: "Configuration Manquante", description: "Aucune configuration PMS trouvée pour le nettoyage restaurant.", variant: "destructive"});
      }
      setConfiguredZones(fetchedZones);

      if (fetchedZones.length > 0) {
        if (!selectedZoneId || !fetchedZones.some(z => z.id === selectedZoneId)) {
          setSelectedZoneId(fetchedZones[0].id);
        }
      } else {
        setSelectedZoneId(undefined);
      }
    } catch (error) {
      console.error("Error loading PMS configurations for restaurant cleaning:", error);
      toast({ title: "Erreur Chargement Config (Restaurant)", variant: "destructive" });
      setSelectedZoneId(undefined);
    }
    setIsLoadingConfig(false);
  }, [toast, selectedZoneId]);

  useEffect(() => {
    loadPmsConfigurations();
    const handleConfigUpdate = () => loadPmsConfigurations();
    window.addEventListener('pmsConfigUpdated', handleConfigUpdate);
    return () => window.removeEventListener('pmsConfigUpdated', handleConfigUpdate);
  }, [loadPmsConfigurations]);
  
  const loadCleaningRecords = useCallback(async () => {
    if (!selectedZoneId) {
      setCleaningRecords({});
      setIsLoadingRecords(false);
      return;
    }
    setIsLoadingRecords(true);
    const docId = getFirestoreRecordsDocId();
    const docRef = doc(firestore, "pmsRestaurantCleaningRecords", docId);
    try {
      const docSnap = await getDoc(docRef);
      setCleaningRecords(docSnap.exists() ? (docSnap.data() as SimplifiedMonthlyRestaurantCleaningRecord) : {});
    } catch (error) {
      console.error("Error loading restaurant cleaning records:", error);
      toast({ title: "Erreur Chargement Enregistrements (Restaurant)", variant: "destructive" });
      setCleaningRecords({});
    }
    setIsLoadingRecords(false);
  }, [selectedZoneId, getFirestoreRecordsDocId, toast]);

  const getCurrentWeekDates = useCallback((year: number, month: number): DayData[] => {
    const today = new Date();
    const referenceDate = new Date(year, month, today.getDate());

    const startOfReferenceWeek = startOfWeek(referenceDate, { locale: fr });

    const weekDays: DayData[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(startOfReferenceWeek, i);
      weekDays.push({
        date: format(date, "yyyy-MM-dd"),
        dayOfMonth: getDate(date),
        dayName: format(date, "EEEE", { locale: fr }),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      });
    }
    return weekDays;
  }, []);

  useEffect(() => {
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthData(getMonthDays(yearNum, monthNum));
    setWeekData(getCurrentWeekDates(yearNum, monthNum));
    loadCleaningRecords();
  }, [selectedYear, selectedMonth, loadCleaningRecords, getCurrentWeekDates]);

  useEffect(() => {
    const saveTimer = setTimeout(async () => {
      if (isSaving || isLoadingConfig || isLoadingRecords) return;

      const docId = getFirestoreRecordsDocId();
      if (Object.keys(cleaningRecords).length === 0) return;

      setIsSaving(true);
      const docRef = doc(firestore, "pmsRestaurantCleaningRecords", docId);
      try {
        await setDoc(docRef, cleaningRecords, { merge: true });
      } catch (error) {
        console.error("Error saving restaurant cleaning records to Firestore:", error);
        toast({ title: "Erreur de Sauvegarde (Net. Restaurant)", variant: "destructive" });
      }
      setIsSaving(false);
    }, 2000);

    return () => clearTimeout(saveTimer);
  }, [cleaningRecords, getFirestoreRecordsDocId, isSaving, isLoadingConfig, isLoadingRecords, toast]);

  const handleRecordChange = (date: string, zoneId: string, taskId: string, field: keyof SimplifiedTaskRecord, value: string) => {
    const recordKey = `${date}_${zoneId}_${taskId}`;
    setCleaningRecords(prev => ({
      ...prev,
      [recordKey]: {
        ...(prev[recordKey] || { status: '', operator: '' }),
        [field]: value,
      }
    }));
  };

  const getRecord = (date: string, zoneId: string, taskId: string): SimplifiedTaskRecord => {
    const recordKey = `${date}_${zoneId}_${taskId}`;
    return cleaningRecords[recordKey] || { status: '', operator: '' };
  };
  
  const handleClearMonthData = async () => {
    const monthLabel = monthsArray[parseInt(selectedMonth)].label;
    if (confirm(`Êtes-vous sûr de vouloir effacer toutes les données de nettoyage restaurant pour ${monthLabel} ${selectedYear} ? Cette action est irréversible.`)) {
      setIsSaving(true);
      const docId = getFirestoreRecordsDocId();
      const docRef = doc(firestore, "pmsRestaurantCleaningRecords", docId);
      try {
        await deleteDoc(docRef);
        setCleaningRecords({});
        toast({ title: "Données Effacées", description: `Les données de nettoyage restaurant pour ${monthLabel} ${selectedYear} ont été effacées.` });
      } catch (error) {
        console.error("Error clearing month data in Firestore for restaurant:", error);
        toast({ title: "Erreur d'effacement", variant: "destructive"});
      }
      setIsSaving(false);
    }
  };

  const selectedZoneData = useMemo(() => {
    return configuredZones.find(zone => zone.id === selectedZoneId);
  }, [selectedZoneId, configuredZones]);

  const generatePdfForZone = () => {
    if (!selectedZoneData) {
      toast({ title: "Aucune Zone Sélectionnée", description: "Veuillez sélectionner une zone pour générer le PDF.", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);
    // PDF generation logic to be implemented
    setIsGeneratingPdf(false);
  };

  const isOverallLoading = isLoadingConfig || isLoadingRecords;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary"/>
          Suivi Mensuel du Nettoyage Restaurant
        </CardTitle>
        <CardDescription>
          Sélectionnez une année et un mois, puis une zone pour enregistrer et visualiser le suivi. Les zones sont configurables dans les Paramètres PMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end mb-4">
          <div>
            <Label htmlFor="year-select-restaurant-cleaning">Année</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isOverallLoading || isSaving}>
              <SelectTrigger id="year-select-restaurant-cleaning"><SelectValue placeholder="Année" /></SelectTrigger>
              <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month-select-restaurant-cleaning">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isOverallLoading || isSaving}>
              <SelectTrigger id="month-select-restaurant-cleaning"><SelectValue placeholder="Mois" /></SelectTrigger>
              <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end">
            <Button onClick={generatePdfForZone} disabled={isOverallLoading || isSaving || !selectedZoneData || monthData.length === 0 || configuredZones.length === 0} className="w-full sm:w-auto">
              {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Générer PDF
            </Button>
            <Button variant="destructive" onClick={handleClearMonthData} disabled={isOverallLoading || isSaving || Object.keys(cleaningRecords).length === 0} className="w-full sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" />
              Effacer Mois
            </Button>
          </div>
        </div>

        {isLoadingConfig ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Chargement des configurations...</div>
        ) : configuredZones.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Aucune zone de nettoyage restaurant n'a été configurée.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Veuillez définir des zones et leurs tâches dans "Paramètres" > "Paramètres PMS" pour commencer.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Label className="text-sm font-medium mb-2 block">Sélectionner une Zone de Nettoyage :</Label>
              <div className="flex flex-wrap gap-2">
                {configuredZones.map(zone => (
                  <Button
                    key={zone.id}
                    variant={selectedZoneId === zone.id ? "default" : "outline"}
                    onClick={() => setSelectedZoneId(zone.id)}
                    size="sm"
                    disabled={isOverallLoading || isSaving}
                  >
                    {zone.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Mobile View: Stacked by Day (Current Week) */}
            <div className="sm:hidden space-y-2">
              {isOverallLoading && !selectedZoneData ? (
                <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : weekData.length > 0 && selectedZoneData ? (
                weekData.map((day) => (
                  <Card key={day.date} className={cn("border", day.isWeekend && "bg-muted/30")}>
                    <CardHeader className="p-2.5 border-b">
                      <CardTitle className="text-sm font-semibold">{format(new Date(day.date), "d MMMM", { locale: fr })} - {day.dayName}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2.5 space-y-2">
                      {selectedZoneData.tasks.length > 0 ? (
                        selectedZoneData.tasks.map(task => {
                          const record = getRecord(day.date, selectedZoneData.id, task.id);
                          return (
                            <div key={task.id} className="flex items-center justify-between text-xs border-b last:border-b-0 pb-1.5 last:pb-0">
                              <div className="flex-1 pr-2">{task.name}</div>
                              <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-0.5">
                                  <Label htmlFor={`checkbox-mobile-${day.date}-${task.id}`} className="text-xs text-muted-foreground">Fait?</Label>
                                  <Checkbox
                                    id={`checkbox-mobile-${day.date}-${task.id}`}
                                    checked={record.status === 'fait'}
                                    onCheckedChange={(checked) => {
                                      const newStatus = checked ? 'fait' : '';
                                      handleRecordChange(day.date, selectedZoneData.id, task.id, 'status', newStatus);
                                      if (checked && loggedInUsername) {
                                        handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', loggedInUsername);
                                      } else if (!checked) {
                                        handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', '');
                                      }
                                    }}
                                    disabled={day.isWeekend || isSaving || isOverallLoading}
                                    className="h-3.5 w-3.5"
                                  />
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <Label htmlFor={`operator-mobile-${day.date}-${task.id}`} className="text-xs text-muted-foreground">Op.</Label>
                                  <Input
                                    id={`operator-mobile-${day.date}-${task.id}`}
                                    type="text"
                                    placeholder="Op."
                                    value={record.operator}
                                    onChange={(e) => handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', e.target.value)}
                                    className="h-6 text-xs w-14"
                                    disabled={day.isWeekend || isSaving || isOverallLoading}
                                    maxLength={15}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center text-xs text-muted-foreground italic">Aucune tâche définie pour cette zone.</div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                   <p className="mt-2 text-sm text-muted-foreground">
                    {!selectedZoneId ? "Veuillez sélectionner une zone." : "Aucune donnée à afficher."}
                   </p>
                </div>
              )}
            </div>
            
            {/* Desktop/Tablet View: Full Table */}
            <div className="overflow-x-auto border rounded-md max-h-[70vh] hidden sm:block">
              {isOverallLoading && !selectedZoneData ? (
                 <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : !selectedZoneId ? (
                <div className="text-center py-10">
                  <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Veuillez sélectionner une zone.</p>
                </div>
              ) : selectedZoneData.tasks.length === 0 ? (
                <div className="text-center py-10">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Aucune tâche définie pour la zone "{selectedZoneData.name}".</p>
                </div>
              ) : (
                <Table className="min-w-full table-fixed">
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                    <TableRow>
                      <TableHead className="w-[50px] min-w-[50px] text-center px-1 sticky left-0 z-20 bg-card">Date</TableHead>
                      <TableHead className="w-[90px] min-w-[90px] px-1 sticky left-[50px] z-20 bg-card">Jour</TableHead>
                      {selectedZoneData.tasks.map(task => (
                        <TableHead key={task.id} className="w-[220px] min-w-[220px] text-center px-1 border-l">
                          {task.name}
                          <div className="grid grid-cols-2 gap-0.5 mt-0.5 text-xs font-normal text-muted-foreground">
                            <span>Fait?</span>
                            <span>Opérateur</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthData.map((day) => (
                      <TableRow key={day.date} className={cn(day.isWeekend && "bg-muted/30")}>
                        <TableCell className={cn("text-center font-medium px-1 align-top py-1.5 sticky left-0 z-10", day.isWeekend ? "bg-muted/30" : "bg-card")}>{day.dayOfMonth}</TableCell>
                        <TableCell className={cn("px-1 align-top py-1.5 sticky left-[50px] z-10", day.isWeekend ? "bg-muted/30" : "bg-card")}>{day.dayName}</TableCell>
                        {selectedZoneData.tasks.map(task => {
                          const record = getRecord(day.date, selectedZoneData.id, task.id);
                          return (
                            <TableCell key={task.id} className="p-0.5 align-top border-l">
                              <div className="grid grid-cols-2 gap-0.5 items-center">
                                <div className="flex items-center justify-center gap-1.5 px-1">
                                  <span className="text-xs text-muted-foreground truncate" title={task.name}>{task.name}</span>
                                  <Checkbox
                                    checked={record.status === 'fait'}
                                    onCheckedChange={(checked) => {
                                      const newStatus = checked ? 'fait' : '';
                                      handleRecordChange(day.date, selectedZoneData.id, task.id, 'status', newStatus);
                                      if (checked && loggedInUsername) {
                                        handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', loggedInUsername);
                                      } else if (!checked) {
                                        handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', '');
                                      }
                                    }}
                                    disabled={day.isWeekend || isSaving || isOverallLoading}
                                    className="h-4 w-4"
                                  />
                                </div>
                                <Input
                                  type="text"
                                  placeholder="Op."
                                  value={record.operator}
                                  onChange={(e) => handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', e.target.value)}
                                  className="h-6 text-xs w-full"
                                  disabled={day.isWeekend || isSaving || isOverallLoading}
                                  maxLength={15}
                                />
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
