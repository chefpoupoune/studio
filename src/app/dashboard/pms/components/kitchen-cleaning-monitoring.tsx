
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText, Trash2, AlertCircle, ListFilter, SprayCan } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { SimplifiedTaskRecord, SimplifiedMonthlyKitchenCleaningRecord, PmsZoneWithTasksDefinition, PmsTaskDefinition, PmsConfigurations } from '../types';
import { PMS_KITCHEN_CLEANING_KEY, PMS_CONFIG_STORAGE_KEY } from '@/app/dashboard/settings/types';
// NO_STATUS_SELECT_VALUE is no longer directly used by a Select here, but kept for data consistency if other parts rely on it or for initial empty states.
import { NO_STATUS_SELECT_VALUE } from '../types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox'; // Added Checkbox
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const currentFullYear = new Date().getFullYear();
const yearsArray = Array.from({ length: 10 }, (_, i) => currentFullYear - 5 + i);
const monthsArray = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentFullYear, i), "MMMM", { locale: fr }),
}));

export default function KitchenCleaningMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  const [configuredZones, setConfiguredZones] = useState<PmsZoneWithTasksDefinition[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(undefined);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [cleaningRecords, setCleaningRecords] = useState<SimplifiedMonthlyKitchenCleaningRecord>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const getFirestoreRecordsDocId = useCallback(() => `records_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  const loadPmsConfigurations = useCallback(async () => {
    setIsLoading(true); 
    console.log("[KitchenClean] Loading PMS configurations...");
    const docRef = doc(firestore, "pmsConfigurations", "mainConfig");
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const pmsSettings = docSnap.data() as PmsConfigurations;
        const kitchenZones = pmsSettings[PMS_KITCHEN_CLEANING_KEY] || [];
        setConfiguredZones(kitchenZones);
        console.log("[KitchenClean] PMS configurations loaded:", kitchenZones.length, "zones");
      } else {
        setConfiguredZones([]);
        console.log("[KitchenClean] No PMS configurations found in Firestore.");
        toast({ title: "Configuration Manquante", description: "Aucune configuration PMS trouvée. Veuillez la définir dans les paramètres.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error loading PMS configurations for kitchen cleaning:", error);
      toast({ title: "Erreur Chargement Config", description: "Impossible de charger les configurations des zones.", variant: "destructive" });
      setConfiguredZones([]);
    }
  }, [toast]);

  const loadCleaningRecords = useCallback(async () => {
    if (!selectedZoneId) {
      setCleaningRecords({});
      setIsLoading(false); 
      console.log("[KitchenClean] No zone selected, records not loaded, loading finished.");
      return;
    }
    setIsLoading(true); 
    console.log(`[KitchenClean] Loading cleaning records for zone ${selectedZoneId}, period ${selectedYear}-${selectedMonth}`);
    const docId = getFirestoreRecordsDocId();
    const docRef = doc(firestore, "pmsKitchenCleaningRecords", docId);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setCleaningRecords(docSnap.data() as SimplifiedMonthlyKitchenCleaningRecord);
        console.log("[KitchenClean] Cleaning records loaded.");
      } else {
        setCleaningRecords({});
        console.log("[KitchenClean] No cleaning records found for this period.");
      }
    } catch (error) {
      console.error("Error loading kitchen cleaning records:", error);
      toast({ title: "Erreur Chargement Enregistrements", description: "Impossible de charger les enregistrements de nettoyage.", variant: "destructive" });
      setCleaningRecords({});
    }
    setIsLoading(false); 
    console.log("[KitchenClean] Cleaning records loading process finished.");
  }, [selectedZoneId, selectedYear, selectedMonth, getFirestoreRecordsDocId, toast]);

  useEffect(() => {
    loadPmsConfigurations();
    const handleConfigUpdate = () => {
      console.log(`[KitchenCleaning] Received pmsConfigUpdated event. Refetching configurations.`);
      loadPmsConfigurations();
    };
    window.addEventListener('pmsConfigUpdated', handleConfigUpdate);
    return () => window.removeEventListener('pmsConfigUpdated', handleConfigUpdate);
  }, [loadPmsConfigurations]);

  useEffect(() => {
    console.log("[KitchenClean] Evaluating selectedZoneId. Current:", selectedZoneId, "Available zones:", configuredZones.length);
    if (configuredZones.length > 0) {
      const currentSelectionIsValid = selectedZoneId && configuredZones.some(z => z.id === selectedZoneId);
      if (!currentSelectionIsValid) {
        const newSelectedId = configuredZones[0].id;
        console.log("[KitchenClean] Invalid or no selectedZoneId, setting to first available zone:", newSelectedId);
        setSelectedZoneId(newSelectedId);
      } else {
        console.log("[KitchenClean] selectedZoneId is still valid:", selectedZoneId);
      }
    } else {
      console.log("[KitchenClean] No configured zones, clearing selectedZoneId.");
      setSelectedZoneId(undefined);
    }
  }, [configuredZones, selectedZoneId]); 

  useEffect(() => {
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthData(getMonthDays(yearNum, monthNum));
    console.log(`[KitchenClean] Month data (days structure) generated for ${selectedYear}-${selectedMonth}.`);

    if (selectedZoneId) {
      console.log(`[KitchenClean] Triggering record load for zone: ${selectedZoneId}`);
      loadCleaningRecords();
    } else {
      console.log("[KitchenClean] No zone selected. Clearing records and setting loading to false.");
      setCleaningRecords({}); 
      setIsLoading(false); 
    }
  }, [selectedZoneId, selectedYear, selectedMonth, loadCleaningRecords]);

  useEffect(() => {
    if (isLoading || isSaving) return; 

    const saveRecordsToFirestore = async () => {
      if (Object.keys(cleaningRecords).length === 0 && !doc(firestore, "pmsKitchenCleaningRecords", getFirestoreRecordsDocId())) {
        console.log("[KitchenClean SaveDebounce] No records to save and no existing document, skipping save.");
        return;
      }
      
      setIsSaving(true);
      console.log("[KitchenClean SaveDebounce] Attempting to save cleaning records to Firestore for doc:", getFirestoreRecordsDocId());
      const docId = getFirestoreRecordsDocId();
      const docRef = doc(firestore, "pmsKitchenCleaningRecords", docId);
      try {
        await setDoc(docRef, cleaningRecords);
        console.log("[KitchenClean SaveDebounce] Records saved successfully.");
      } catch (error) {
        console.error("Error saving kitchen cleaning records to Firestore:", error);
        toast({ title: "Erreur de Sauvegarde (Net. Cuisine)", description: "Impossible d'enregistrer les données.", variant: "destructive" });
      }
      setIsSaving(false);
    };

    const timeoutId = setTimeout(saveRecordsToFirestore, 2000); 
    return () => clearTimeout(timeoutId);
  }, [cleaningRecords, isLoading, isSaving, getFirestoreRecordsDocId, toast]);


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
    if (confirm(`Êtes-vous sûr de vouloir effacer toutes les données de nettoyage cuisine pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ? Cette action est irréversible.`)) {
      setIsSaving(true);
      const docId = getFirestoreRecordsDocId();
      const docRef = doc(firestore, "pmsKitchenCleaningRecords", docId);
      try {
        await setDoc(docRef, {}); 
        setCleaningRecords({}); 
        toast({ title: "Données Effacées", description: `Les données de nettoyage cuisine pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ont été effacées de Firestore.` });
      } catch (error) {
        console.error("Error clearing month data in Firestore:", error);
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
    setIsLoading(true); 
    try {
      const pdfSettings = getPdfLayoutSettings('pms_kitchen_cleaning_monthly');
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const monthLabel = monthsArray.find(m => m.value === selectedMonth)?.label || '';
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) {
        doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10;
      }
      if (pdfSettings.logoUrl) {
        doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY); currentY += 5;
      }
      
      const title = `Suivi Nettoyage Cuisine - Zone: ${selectedZoneData.name} - ${monthLabel} ${selectedYear}`;
      doc.setFontSize(18); doc.text(title, 14, currentY); currentY += 8;
      doc.setFontSize(10); doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY); currentY += 7;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number] } = {};
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }
      
      const headBase = ['Date', 'Jour'];
      const taskHeaders: string[] = [];
      selectedZoneData.tasks.forEach(task => {
        taskHeaders.push(`Fait? (${task.name})`);
        taskHeaders.push(`Opérateur (${task.name})`);
      });
      const head: any[] = [headBase.concat(taskHeaders)];
      
      const body: any[][] = [];
      monthData.forEach(day => {
        const row: any[] = [
          day.isWeekend ? {content: day.dayOfMonth.toString(), styles: {fillColor: [230,230,230]}} : day.dayOfMonth.toString(),
          day.isWeekend ? {content: day.dayName, styles: {fillColor: [230,230,230]}} : day.dayName,
        ];
        selectedZoneData.tasks.forEach(task => {
          const record = getRecord(day.date, selectedZoneData.id, task.id);
          const statusDisplay = record.status === 'fait' ? 'Oui' : (record.status === 'non_fait' ? 'Non' : (record.status === 'na' ? 'N/A' : '-'));
          row.push(day.isWeekend ? {content: statusDisplay, styles: {halign: 'center', fillColor: [230,230,230]}} : {content: statusDisplay, styles: {halign: 'center'}});
          row.push(day.isWeekend ? {content: record.operator || '-', styles: {halign: 'center', fillColor: [230,230,230]}} : {content: record.operator || '-', styles: {halign: 'center'}});
        });
        body.push(row);
      });

      const columnStyles: { [key: number]: { cellWidth: 'auto' | number, halign?: 'left' | 'center' | 'right' } } = {
        0: { cellWidth: 15, halign: 'center' }, 
        1: { cellWidth: 25 }, 
      };
      let currentColumnIndex = 2;
      selectedZoneData.tasks.forEach(() => {
        columnStyles[currentColumnIndex++] = { cellWidth: 30, halign: 'center' }; // Fait?
        columnStyles[currentColumnIndex++] = { cellWidth: 30, halign: 'center' }; // Opérateur
      });

      doc.autoTable({
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { ...headStyles, halign: 'center', fontSize: 8, cellPadding: 1 },
        styles: { fontSize: 7, cellPadding: 1 },
        columnStyles: columnStyles,
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
            doc.setFontSize(9); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        },
      });
      doc.save(`Suivi_Nettoyage_Cuisine_${selectedZoneData.name.replace(/\s+/g, '_')}_${monthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF de Zone Généré", description: `Le PDF pour la zone "${selectedZoneData.name}" a été téléchargé.` });
    } catch (error) {
      console.error("Error generating PDF for zone:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SprayCan className="w-6 h-6 text-primary"/>
          Suivi Mensuel du Nettoyage Cuisine
        </CardTitle>
        <CardDescription>
          Sélectionnez une année et un mois, puis une zone pour enregistrer et visualiser le suivi. Les zones sont configurables dans les Paramètres PMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end mb-4">
          <div>
            <Label htmlFor="year-select-kitchen-cleaning">Année</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isLoading || isSaving}>
              <SelectTrigger id="year-select-kitchen-cleaning"><SelectValue placeholder="Année" /></SelectTrigger>
              <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month-select-kitchen-cleaning">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isLoading || isSaving}>
              <SelectTrigger id="month-select-kitchen-cleaning"><SelectValue placeholder="Mois" /></SelectTrigger>
              <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end">
             <Button onClick={generatePdfForZone} disabled={isLoading || isSaving || !selectedZoneData || monthData.length === 0 || configuredZones.length === 0} className="w-full sm:w-auto">
                {(isLoading || isSaving) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF Zone
            </Button>
            <Button variant="destructive" onClick={handleClearMonthData} disabled={isLoading || isSaving || Object.keys(cleaningRecords).length === 0} className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" />
                Effacer Mois
            </Button>
          </div>
        </div>
        
        {isLoading && configuredZones.length === 0 ? ( 
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Chargement des configurations...</div>
        ) : configuredZones.length === 0 ? (
           <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                Aucune zone de nettoyage cuisine n'a été configurée.
            </p>
            <p className="text-xs text-muted-foreground/70">
                Veuillez définir des zones et leurs tâches dans "Paramètres" &gt; "Paramètres PMS" pour commencer.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Label className="text-sm font-medium mb-2 block">Sélectionner une Zone de Nettoyage Cuisine :</Label>
              <div className="flex flex-wrap gap-2">
                {configuredZones.map(zone => (
                  <Button
                    key={zone.id}
                    variant={selectedZoneId === zone.id ? "default" : "outline"}
                    onClick={() => setSelectedZoneId(zone.id)}
                    size="sm"
                    disabled={isLoading || isSaving}
                  >
                    {zone.name}
                  </Button>
                ))}
              </div>
            </div>

            {isLoading && selectedZoneId ? ( 
                 <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Chargement des enregistrements pour "{selectedZoneData?.name}"...</div>
            ) : !selectedZoneId ? (
              <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                  <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                      Veuillez sélectionner une zone de nettoyage ci-dessus pour afficher le tableau de suivi.
                  </p>
              </div>
            ) : selectedZoneData && monthData.length > 0 ? (
              <div className="overflow-x-auto border rounded-md max-h-[70vh]">
                <Table className="min-w-full table-fixed">
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                    <TableRow>
                      <TableHead className="w-[60px] min-w-[60px] text-center px-1">Date</TableHead>
                      <TableHead className="w-[100px] min-w-[100px] px-1">Jour</TableHead>
                      {selectedZoneData.tasks.map(task => (
                        <TableHead key={task.id} className="w-[200px] min-w-[200px] text-center px-1 border-l">
                          {task.name}
                          <div className="grid grid-cols-2 gap-px mt-1 text-xs font-normal text-muted-foreground">
                            <span>Fait?</span>
                            <span>Opérateur</span>
                          </div>
                        </TableHead>
                      ))}
                      {selectedZoneData.tasks.length === 0 && (
                        <TableHead className="w-full text-center px-1 border-l">Aucune tâche définie pour cette zone</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthData.map((day) => (
                      <TableRow key={day.date} className={cn(day.isWeekend && "bg-muted/30")}>
                        <TableCell className="text-center font-medium px-1 align-top py-2">{day.dayOfMonth}</TableCell>
                        <TableCell className="px-1 align-top py-2">{day.dayName}</TableCell>
                        {selectedZoneData.tasks.length > 0 ? selectedZoneData.tasks.map(task => {
                          const record = getRecord(day.date, selectedZoneData.id, task.id);
                          return (
                            <TableCell key={task.id} className="p-1 align-top border-l">
                              <div className="grid grid-cols-2 gap-1 items-center">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={record.status === 'fait'}
                                    onCheckedChange={(checked) => {
                                      const newStatus = checked ? 'fait' : '';
                                      handleRecordChange(day.date, selectedZoneData.id, task.id, 'status', newStatus);
                                    }}
                                    disabled={day.isWeekend || isSaving}
                                    className="h-5 w-5"
                                  />
                                </div>
                                <Input
                                  type="text"
                                  placeholder="Op."
                                  value={record.operator}
                                  onChange={(e) => handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', e.target.value)}
                                  className="h-7 text-xs"
                                  disabled={day.isWeekend || isSaving}
                                  maxLength={15}
                                />
                              </div>
                            </TableCell>
                          );
                        }) : (
                           <TableCell className="p-1 align-top border-l text-center text-xs text-muted-foreground italic" colSpan={1}>
                             Aucune tâche à afficher.
                           </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedZoneId ? "Aucune donnée à afficher pour la période ou zone sélectionnée." : "Veuillez d'abord sélectionner une zone."}
                </p>
                 {selectedZoneData && selectedZoneData.tasks.length === 0 && (
                   <p className="text-xs text-muted-foreground/70 mt-1">
                     La zone "{selectedZoneData.name}" n'a pas de tâches définies. Ajoutez-en via les Paramètres PMS.
                   </p>
                 )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
