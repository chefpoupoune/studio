"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText, Trash2, AlertCircle, ListFilter, SprayCan } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'; // Ajout des fonctions pour la semaine
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { SimplifiedTaskRecord, SimplifiedMonthlyKitchenCleaningRecord as SimplifiedMonthlyRestaurantCleaningRecord, PmsZoneWithTasksDefinition as PmsRestaurantZoneWithTasksDefinition, PmsConfigurations } from '../types';
import { PMS_KITCHEN_CLEANING_KEY } from '@/app/dashboard/settings/types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
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

const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';
const LOGGED_IN_USER_PERMISSIONS_KEY = 'loggedInUserPermissions';


export default function KitchenCleaningMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  const [configuredZones, setConfiguredZones] = useState<PmsRestaurantZoneWithTasksDefinition[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(undefined);
  const [isSuperviseur, setIsSuperviseur] = useState(false);

  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [cleaningRecords, setCleaningRecords] = useState<SimplifiedMonthlyRestaurantCleaningRecord>({});
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); // Correct state for PDF generation
  const { toast } = useToast();
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [loggedInUserRole, setLoggedInUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoggedInUsername(localStorage.getItem(LOGGED_IN_USERNAME_KEY));
      const permissionsString = localStorage.getItem(LOGGED_IN_USER_PERMISSIONS_KEY);
      if (permissionsString) {
        try {
          const permissions = JSON.parse(permissionsString);
          setIsSuperviseur(permissions.role === 'superviseur');
        } catch (e) { console.error("Failed to parse user permissions from localStorage", e); }
      }
    }
  }, []);

  const getFirestoreRecordsDocId = useCallback(() => `records_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  const loadPmsConfigurations = useCallback(async () => {
    setIsLoadingConfig(true);
    const docRef = doc(firestore, "pmsConfigurations", "mainConfig");
    try {
      const docSnap = await getDoc(docRef);
      let newConfiguredZones: PmsRestaurantZoneWithTasksDefinition[] = [];
      if (docSnap.exists()) {
        const pmsSettings = docSnap.data() as PmsConfigurations;
        newConfiguredZones = pmsSettings[PMS_KITCHEN_CLEANING_KEY] || [];
      } else {
        toast({ title: "Configuration Manquante", description: "Aucune configuration PMS trouvée. Veuillez la définir dans les paramètres.", variant: "destructive" });
      }
      setConfiguredZones(newConfiguredZones);
      if (newConfiguredZones.length > 0 && (!selectedZoneId || !newConfiguredZones.some(z => z.id === selectedZoneId))) {
        setSelectedZoneId(newConfiguredZones[0].id);
      } else if (newConfiguredZones.length === 0) {
        setSelectedZoneId(undefined);
      }
    } catch (error) {
      console.error("Error loading PMS configurations for kitchen cleaning:", error);
      toast({ title: "Erreur Chargement Config", description: "Impossible de charger les configurations des zones.", variant: "destructive" });
      setConfiguredZones([]);
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
    if (!selectedZoneId || isLoadingConfig) {
      setCleaningRecords({});
      setIsLoadingRecords(false);
      return;
    }
    setIsLoadingRecords(true);
    const docId = getFirestoreRecordsDocId();
    const docRef = doc(firestore, "pmsKitchenCleaningRecords", docId);
    try {
      const docSnap = await getDoc(docRef);
      setCleaningRecords(docSnap.exists() ? (docSnap.data() as SimplifiedMonthlyRestaurantCleaningRecord) : {});
    } catch (error) {
      console.error("Error loading kitchen cleaning records:", error);
      toast({ title: "Erreur Chargement Enregistrements", description: "Impossible de charger les enregistrements de nettoyage.", variant: "destructive" });
      setCleaningRecords({});
    }
    setIsLoadingRecords(false);
  }, [selectedZoneId, getFirestoreRecordsDocId, toast, isLoadingConfig]);

  useEffect(() => {
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthData(getMonthDays(yearNum, monthNum));
    loadCleaningRecords();
  }, [selectedYear, selectedMonth, loadCleaningRecords]);


  useEffect(() => {
    if (isLoadingConfig || isLoadingRecords || isSaving) return;

    const saveRecordsToFirestore = async () => {
      const docId = getFirestoreRecordsDocId();
      if (Object.keys(cleaningRecords).length === 0 && !doc(firestore, "pmsKitchenCleaningRecords", docId )) {
        return;
      }

      setIsSaving(true);
      const docRef = doc(firestore, "pmsKitchenCleaningRecords", docId);
      try {
        await setDoc(docRef, cleaningRecords);
      } catch (error) {
        console.error("Error saving kitchen cleaning records to Firestore:", error);
        toast({ title: "Erreur de Sauvegarde (Net. Cuisine)", description: "Impossible d'enregistrer les données.", variant: "destructive" });
      }
      setIsSaving(false);
    };

    const timeoutId = setTimeout(saveRecordsToFirestore, 2000);
    return () => clearTimeout(timeoutId);
  }, [cleaningRecords, isLoadingConfig, isLoadingRecords, isSaving, getFirestoreRecordsDocId, toast]);


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
    setIsGeneratingPdf(true); // Use the correct state setter
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


      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number]  } = {};
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      // Construct the two rows of the header
      const headRow1: any[] = [{ content: 'Date', rowSpan: 2 }, { content: 'Jour', rowSpan: 2 }];
      const headRow2: any[] = [];

      selectedZoneData.tasks.forEach(task => {
        headRow1.push({ content: task.name, colSpan: 2 });
        headRow2.push('Fait');
        headRow2.push('Par?');
      });

      const head: any[] = [headRow1, headRow2];

      const body: any[][] = [];
      monthData.forEach(day => {
        const row: any[] = [
          day.isWeekend ? {content: day.dayOfMonth.toString(), styles: {fillColor: [169,169,169],textColor:[0,0,0]}} : {content: day.dayOfMonth.toString(), styles: {textColor: [0, 0, 0]}},
          day.isWeekend ? {content: day.dayName, styles: {fillColor: [169,169,169],textColor:[0,0,0]}} : {content: day.dayName, styles: {textColor:[0,0,0]}}
        ];
        selectedZoneData.tasks.forEach(task => {
          const record = getRecord(day.date, selectedZoneData.id, task.id);
          const statusDisplay = record.status === 'fait' ? 'X' : (record.status === 'non_fait' ? 'Non' : (record.status === 'na' ? 'N/A' : '-'));
          row.push(day.isWeekend ? {content: statusDisplay, styles: {halign: 'center', fillColor: [169,169,169]}} : {content: statusDisplay, styles: {halign: 'center'}});

          // Extract initials from operator name
          const operatorInitials = record.operator
            ? record.operator.split(' ')
              .map(namePart => namePart.charAt(0).toUpperCase())
              .join('')
            : '-';

          row.push(day.isWeekend ? {content: operatorInitials, styles: {halign: 'center', fillColor: [169,169,169]}} : {content: operatorInitials, styles: {halign: 'center'}});
        });
        body.push(row);
      });

      const columnStyles: { [key: number]: { cellWidth: 'auto' | number, halign?: 'left' | 'center' | 'right' } } = {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 13 },
      };
      let currentColumnIndex = 2;
      selectedZoneData.tasks.forEach(() => {
        columnStyles[currentColumnIndex++] = { cellWidth: 'auto', halign: 'center',textColor:[0,0,0] }; // Fait?
        columnStyles[currentColumnIndex++] = { cellWidth:'auto' , halign: 'center',textColor:[0,0,0] }; // Opérateur
      });

      doc.autoTable({
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { ...headStyles, halign: 'center', fontSize: 6, cellPadding: 1 },
        styles: {
          fontSize: 7,
          cellPadding: 1,
          lineWidth: 0.1,
          lineColor: [0,0,0] },
        columnStyles: columnStyles,
        tableWidth: 'auto',
        margin: {left:5 , right:5 , top: currentY + 10, bottom: 10 },
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
      setIsGeneratingPdf(false); // Use the correct state setter
    }
  };

  const isOverallLoading = isLoadingConfig || isLoadingRecords;

  // --- Calculs pour la vue mobile ---
  const startOfCurrentWeek = startOfWeek(new Date(), { locale: fr }); // Lundi de la semaine actuelle
  const endOfCurrentWeek = endOfWeek(new Date(), { locale: fr });   // Dimanche de la semaine actuelle

  // Filtre les jours pour ne garder que ceux de la semaine en cours pour l'affichage mobile
  const currentWeekData = monthData.filter(day => {
    const dayDate = new Date(day.date);
    return isWithinInterval(dayDate, { start: startOfCurrentWeek, end: endOfCurrentWeek });
  });
  // --- Fin des calculs pour la vue mobile ---

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
            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isOverallLoading || isSaving || isGeneratingPdf}>
              <SelectTrigger id="year-select-kitchen-cleaning"><SelectValue placeholder="Année" /></SelectTrigger>
              <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month-select-kitchen-cleaning">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isOverallLoading || isSaving || isGeneratingPdf}>
              <SelectTrigger id="month-select-kitchen-cleaning"><SelectValue placeholder="Mois" /></SelectTrigger>
              <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end">
             <Button onClick={generatePdfForZone} disabled={isOverallLoading || isSaving || isGeneratingPdf || !selectedZoneData || monthData.length === 0 || configuredZones.length === 0} className="w-full sm:w-auto">
              {(isOverallLoading || isSaving || isGeneratingPdf) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF Zone
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
                    disabled={isOverallLoading || isSaving || isGeneratingPdf}
                  >
                    {zone.name}
                  </Button>
                ))}
              </div>
            </div>

            {isLoadingRecords && selectedZoneId ? (
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
                    {/* Mobile View: Stacked by Day (shows current week only) */}
                    <div className="space-y-4 p-2 sm:hidden block">
                      {currentWeekData.length > 0 ? (
                        currentWeekData.map(day => (
                            <Card key={`mobile-day-${day.date}`} className={cn("shadow-sm", day.isWeekend && "bg-muted/30")}>
                              <CardHeader className="p-3 border-b">
                                <CardTitle className="text-base font-semibold mb-0">{day.dayOfMonth} {day.dayName}</CardTitle>
                              </CardHeader>
                              <CardContent className="p-3 space-y-3">
                                {selectedZoneData.tasks.length > 0 ? selectedZoneData.tasks.map(task => {
                                  const record = getRecord(day.date, selectedZoneData.id, task.id);
                                  return (
                                    <div key={`mobile-${day.date}-${task.id}`} className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0">
                                      <div className="text-sm font-medium flex-grow sm:mr-2">{task.name}</div>
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1">
                                          <Label htmlFor={`checkbox-${day.date}-${task.id}`} className="text-xs text-muted-foreground">Fait?</Label>
                                          <Checkbox
                                            id={`checkbox-${day.date}-${task.id}`}
                                            checked={record.status === 'fait'}
                                            onCheckedChange={(checked) => { handleRecordChange(day.date, selectedZoneData.id, task.id, 'status', checked ? 'fait' : ''); if (checked && loggedInUsername) { handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', loggedInUsername); } else if (!checked) { handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', ''); } }}
                                            disabled={day.isWeekend || isSaving || isOverallLoading || isGeneratingPdf}
                                            className="h-4 w-4" disabled={isSuperviseur || day.isWeekend || isSaving || isOverallLoading || isGeneratingPdf}
                                          />
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Label htmlFor={`operator-${day.date}-${task.id}`} className="text-xs text-muted-foreground">Op.</Label>
                                          <Input type="text" placeholder="Op." value={record.operator} onChange={(e) => handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', e.target.value)} className="h-6 text-xs w-16" disabled={day.isWeekend || isSaving || isOverallLoading || isGeneratingPdf} maxLength={15} />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }) : <div className="text-center text-sm text-muted-foreground italic">Aucune tâche définie pour cette zone.</div>}
                              </CardContent>
                            </Card>
                          ))
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">Aucun jour à afficher pour cette semaine.</div>
                      )}
                    </div>

                    {/* Desktop Table: Hidden on smaller screens */}
                    <Table className="min-w-full table-fixed hidden sm:table" style={{ borderCollapse: 'collapse' }}>
                      <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                        <TableRow>
                          <TableHead className="w-[60px] min-w-[60px] text-center px-1 sticky left-0 z-30 bg-card">Date</TableHead>
                          <TableHead className="w-[100px] min-w-[100px] px-1 sticky left-[60px] z-30 bg-card">Jour</TableHead>
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
                            <TableCell className={cn("text-center font-medium px-1 align-top py-2 sticky left-0 z-[1] bg-card", day.isWeekend && "bg-muted/30")}>
                              {day.dayOfMonth}
                            </TableCell>
                            <TableCell className={cn("px-1 align-top py-2 sticky left-[60px] z-[1] bg-card", day.isWeekend && "bg-muted/30")}>
                              {day.dayName}
                            </TableCell>
                            {selectedZoneData.tasks.length > 0 ? selectedZoneData.tasks.map(task => {
                              const record = getRecord(day.date, selectedZoneData.id, task.id);
                              const taskIndex = selectedZoneData.tasks.findIndex(t => t.id === task.id);
                              const isFaitColumn = taskIndex !== -1;
                              return (
                                <TableCell key={`${task.id}-${day.date}`} className="p-1 align-top border-l">
                                  <div className="grid grid-cols-2 gap-1 items-center relative">
                                    <div className="flex justify-center">
                                      <Checkbox
                                        checked={record.status === 'fait'}
                                        onCheckedChange={(checked) => {
                                          handleRecordChange(day.date, selectedZoneData.id, task.id, 'status', checked ? 'fait' : '');
                                          if (checked && loggedInUsername) {
                                            handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', loggedInUsername);
                                          } else if (!checked) {
                                            handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', '');
                                          }
                                        }}
                                        disabled={isSaving || isOverallLoading || isGeneratingPdf}
                                        className="h-5 w-5"
                                      />
                                    </div>
                                    {isFaitColumn && (
                                      <span className="absolute bottom-1 left-1 text-[8px] text-muted-foreground/70 pointer-events-none">
                                        {task.name}
                                      </span>
                                    )}
                                    <Input
                                      type="text"
                                      placeholder="Op."
                                      value={record.operator}
                                      onChange={(e) => handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', e.target.value)}
                                      className="h-7 text-xs text-center"
                                      disabled={isSuperviseur || day.isWeekend || isSaving || isOverallLoading || isGeneratingPdf}
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
                    <p className="mt-2 text-sm text-muted-foreground">{selectedZoneId ? "Aucune donnée à afficher pour la période ou zone sélectionnée." : "Veuillez d'abord sélectionner une zone."}</p>
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