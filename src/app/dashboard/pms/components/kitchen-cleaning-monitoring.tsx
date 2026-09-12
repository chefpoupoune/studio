
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText, Trash2, AlertCircle, ListFilter, SprayCan, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { SimplifiedTaskRecord, SimplifiedMonthlyKitchenCleaningRecord, PmsZoneWithTasksDefinition, PmsConfigurations } from '../types';
import { PMS_KITCHEN_CLEANING_KEY } from '@/app/dashboard/settings/types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import JSZip from 'jszip';
import EndOfDayMessage from './EndOfDayMessage';

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
  const [configuredZones, setConfiguredZones] = useState<PmsZoneWithTasksDefinition[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(undefined);
  const [isSuperviseur, setIsSuperviseur] = useState(false);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [cleaningRecords, setCleaningRecords] = useState<SimplifiedMonthlyKitchenCleaningRecord>({});
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [loadingError, setLoadingError] = useState<boolean>(false);
  const { toast } = useToast();
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [isEndOfDayMessageOpen, setIsEndOfDayMessageOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isGeneratingAllPdfs, setIsGeneratingAllPdfs] = useState(false);

  // State to track unsaved changes
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  
  const cleaningRecordsRef = useRef(cleaningRecords);
  useEffect(() => { cleaningRecordsRef.current = cleaningRecords; }, [cleaningRecords]);


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
    setLoadingError(false);
    const docRef = doc(firestore, "pmsConfigurations", "mainConfig");
    try {
      const docSnap = await getDoc(docRef);
      let newConfiguredZones: PmsZoneWithTasksDefinition[] = [];
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
      setLoadingError(true);
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
      return;
    }
    setIsLoadingRecords(true);
    setLoadingError(false);
    const docId = getFirestoreRecordsDocId();
    const docRef = doc(firestore, "pmsKitchenCleaningRecords", docId);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setCleaningRecords(docSnap.data() as SimplifiedMonthlyKitchenCleaningRecord);
      } else {
        setCleaningRecords({});
      }
      setIsDirty(false); // Reset dirty state after loading new data
    } catch (error) {
      console.error("Error loading kitchen cleaning records:", error);
      toast({ title: "Erreur Chargement Enregistrements", description: "Impossible de charger les enregistrements de nettoyage. Les modifications ne seront pas sauvegardées.", variant: "destructive" });
      setLoadingError(true);
    }
    setIsLoadingRecords(false);
  }, [selectedZoneId, getFirestoreRecordsDocId, toast, isLoadingConfig]);

  useEffect(() => {
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthData(getMonthDays(yearNum, monthNum));
    
    // Auto-save before loading new records if dirty
    const switchAndLoad = async () => {
        if (isDirtyRef.current) {
            await handleAutoSave();
        }
        loadCleaningRecords();
    }
    switchAndLoad();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    // Only load records when selectedZoneId changes
    loadCleaningRecords();
  }, [selectedZoneId, loadCleaningRecords]);

  const handleAutoSave = useCallback(async () => {
    if (!isDirtyRef.current) return;
    
    const docId = getFirestoreRecordsDocId();
    const docRef = doc(firestore, "pmsKitchenCleaningRecords", docId);
    try {
        await setDoc(docRef, cleaningRecordsRef.current, { merge: true });
        setIsDirty(false);
        toast({ title: "Sauvegardé !", description: "Modifications enregistrées automatiquement.", duration: 2000 });
    } catch (error) {
        console.error("Erreur lors de la sauvegarde automatique:", error);
        toast({ title: "Erreur de Sauvegarde Auto", description: "Impossible d'enregistrer les changements automatiquement.", variant: "destructive", duration: 2000 });
    }
  }, [getFirestoreRecordsDocId, toast]);

  useEffect(() => {
    // Cleanup function to run on component unmount
    return () => {
        if (isDirtyRef.current) {
            handleAutoSave();
        }
    };
  }, [handleAutoSave]);

  const handleSave = async () => {
    setIsSaving(true);
    await handleAutoSave(); // Use the same auto-save logic
    setIsSaving(false);
    if (!isDirtyRef.current) { // if save was successful, isDirty will be false
        if (audioRef.current) {
            audioRef.current.play().catch(error => console.error("Audio playback failed on save:", error));
        }
        setIsEndOfDayMessageOpen(true);
    }
  };
  
  const handleZoneChange = async (newZoneId: string) => {
    if (selectedZoneId === newZoneId) return;
    if (isDirty) {
        await handleAutoSave();
    }
    setSelectedZoneId(newZoneId);
  };

  const handleRecordChange = (date: string, zoneId: string, taskId: string, field: keyof SimplifiedTaskRecord, value: string | boolean) => {
    const recordKey = `${date}_${zoneId}_${taskId}`;
    const newStatus = typeof value === 'boolean' ? (value ? 'fait' : '') : value;

    setCleaningRecords(prev => {
      const newRecords = { ...prev };
      const existingRecord = newRecords[recordKey] || { operator: '' };
      
      if (field === 'status') {
          existingRecord.status = newStatus;
          if (newStatus === 'fait' && !existingRecord.operator && loggedInUsername) {
              existingRecord.operator = loggedInUsername;
          } else if (newStatus !== 'fait') {
              existingRecord.operator = '';
          }
      } else {
        existingRecord[field as 'operator'] = newStatus as string;
      }

      newRecords[recordKey] = existingRecord;
      return newRecords;
    });
    setIsDirty(true);
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
        setIsDirty(false); // Reset dirty state
        toast({ title: "Données Effacées", description: `Les données de nettoyage cuisine pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ont été effacées.` });
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


     const generatePdfForZone = async (zoneId: string, { forZip = false }: { forZip?: boolean } = {}) => {
    const zoneData = configuredZones.find(z => z.id === zoneId);
    if (!zoneData) {
      toast({ title: "Zone non trouvée", variant: "destructive" });
      return null;
    }
    
    if (!forZip) setIsGeneratingPdf(true);
    try {
      const pdfSettings = await getPdfLayoutSettings('pms_kitchen_cleaning_monthly');
      const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'pt',
          format: pdfSettings.pageSize as any
      }) as jsPDFWithAutoTable;

      const monthLabel = monthsArray.find(m => m.value === selectedMonth)?.label || '';
      
      let tableStartY = pdfSettings.marginTop;
      const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;

      if (pdfSettings.headerText) {
          const headerRows = pdfSettings.headerText.split('\n');
          doc.setFontSize(pdfSettings.headerFontSize);
          for (const row of headerRows) {
              const cells = row.split('|');
              if (cells.length === 0) continue;
              const cellWidth = pageContentWidth / cells.length;
              let maxHeightInRow = 0;
              cells.forEach(cell => {
                  const cellText = cell.trim();
                  if (cellText === '{logo}' && pdfSettings.logoUrl) {
                      maxHeightInRow = Math.max(maxHeightInRow, 40);
                  } else {
                      const textLines = doc.splitTextToSize(cellText, cellWidth - 8);
                      maxHeightInRow = Math.max(maxHeightInRow, (textLines.length * pdfSettings.headerFontSize * 0.8) + 8);
                  }
              });
              let currentX = pdfSettings.marginLeft;
              for (const cell of cells) {
                  const cellText = cell.trim();
                  doc.rect(currentX, tableStartY, cellWidth, maxHeightInRow, 'S');
                  if (cellText === '{logo}' && pdfSettings.logoUrl) {
                      try {
                          const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                          const cellPadding = 8;
                          const aspectRatio = imgProps.width / imgProps.height;
                          let imgWidth = cellWidth - cellPadding;
                          let imgHeight = imgWidth / aspectRatio;
                          if (imgHeight > maxHeightInRow - cellPadding) {
                              imgHeight = maxHeightInRow - cellPadding;
                              imgWidth = imgHeight * aspectRatio;
                          }
                          const imgX = currentX + (cellWidth - imgWidth) / 2;
                          const imgY = tableStartY + (maxHeightInRow - imgHeight) / 2;
                          doc.addImage(pdfSettings.logoUrl, imgProps.fileType, imgX, imgY, imgWidth, imgHeight);
                      } catch (e) {
                          console.error("Error adding logo to PDF header:", e);
                          doc.text('Logo', currentX + cellWidth / 2, tableStartY + maxHeightInRow / 2, { align: 'center', baseline: 'middle' });
                      }
                  } else {
                      doc.text(cellText, currentX + cellWidth / 2, tableStartY + maxHeightInRow / 2, { 
                          align: 'center', 
                          baseline: 'middle', 
                          maxWidth: cellWidth - 8 
                      });
                  }
                  currentX += cellWidth;
              }
              tableStartY += maxHeightInRow;
          }
          tableStartY += 10;
      }
      
      const moduleDefaultTitle = `Zone: ${zoneData.name} - ${monthLabel} ${selectedYear}`;
      let finalTitle = "";
      if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle) {
          finalTitle = pdfSettings.documentBaseTitle.trim();
      }
      if (pdfSettings.showModuleTitle) {
          finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
      }
      if(finalTitle) {
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text(finalTitle, doc.internal.pageSize.width / 2, tableStartY, { align: 'center' });
        tableStartY += pdfSettings.documentTitleFontSize + 5;
      }

      const headStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, valign: 'middle', halign: 'center' };
      if (pdfSettings.primaryColor) {
        const rgb = hexToRgb(pdfSettings.primaryColor);
        if(rgb){
            headStyles.fillColor = [rgb.r, rgb.g, rgb.b];
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      const headRow1: any[] = [{ content: 'Date', rowSpan: 2 }, { content: 'Jour', rowSpan: 2 }];
      const headRow2: any[] = [];
      zoneData.tasks.forEach(task => {
        headRow1.push({ content: task.name, colSpan: 2 });
        headRow2.push('Fait');
        headRow2.push('Par?');
      });
      const body = monthData.map(day => {
        const row: any[] = [day.dayOfMonth.toString(), day.dayName];
        zoneData.tasks.forEach(task => {
          const record = getRecord(day.date, zoneData.id, task.id);
          row.push({ content: record.status === 'fait' ? 'X' : '-', styles: { halign: 'center' } });
          row.push({ content: record.operator ? record.operator.split(' ').map(n=>n[0]).join('').toUpperCase() : '-', styles: { halign: 'center' } });
        });
        return row;
      });
      doc.autoTable({
        startY: tableStartY,
        head: [headRow1, headRow2],
        body: body,
        theme: 'grid',
        headStyles,
        styles: { fontSize: pdfSettings.tableBodyFontSize, cellPadding: 2, font: pdfSettings.fontFamily, lineWidth: 0.1, lineColor: [0, 0, 0] },
        didParseCell: (data) => {
          if (data.row.index !== undefined && monthData[data.row.index]?.isWeekend) {
            data.cell.styles.fillColor = '#f3f4f6';
          }
        },
        margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom },
      });

      if (forZip) {
        return {
          filename: `Suivi_Nettoyage_Cuisine_${zoneData.name.replace(/\s+/g, '_')}_${monthLabel}_${selectedYear}.pdf`,
          data: doc.output('blob')
        };
      } else {
        doc.save(`Suivi_Nettoyage_Cuisine_${zoneData.name.replace(/\s+/g, '_')}_${monthLabel}_${selectedYear}.pdf`);
        toast({ title: "PDF de Zone Généré", description: `Le PDF pour la zone "${zoneData.name}" a été téléchargé.` });
      }

    } catch (error) {
      console.error("Error generating PDF for zone:", error);
      toast({ title: "Erreur PDF", description: `La génération du PDF a échoué.${(error as Error).message}`, variant: "destructive" });
    } finally {
      if (!forZip) setIsGeneratingPdf(false);
    }
    return null;
  };


  const generateAllPdfsForMonth = async () => {
    if (configuredZones.length === 0) {
      toast({ title: "Aucune zone configurée", variant: "destructive" });
      return;
    }
    setIsGeneratingAllPdfs(true);
    toast({ title: "Génération du ZIP en cours...", description: `Préparation de ${configuredZones.length} rapport(s)...` });

    const zip = new JSZip();
    const monthLabel = monthsArray.find(m => m.value === selectedMonth)?.label || 'Mois';
    const folderName = `Suivi Nettoyage Cuisine - ${monthLabel} ${selectedYear}`;
    const folder = zip.folder(folderName);

    if (!folder) {
        toast({ title: "Erreur ZIP", description: "Impossible de créer le dossier dans le fichier ZIP.", variant: "destructive" });
        setIsGeneratingAllPdfs(false);
        return;
    }

    for (const zone of configuredZones) {
      const pdfOutput = await generatePdfForZone(zone.id, { forZip: true });
      if (pdfOutput) {
        folder.file(pdfOutput.filename, pdfOutput.data, { binary: true });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({ title: "ZIP Généré !", description: "L'archive contenant tous les rapports a été téléchargée.", variant: "success" });
    } catch (error) {
        console.error("Error generating ZIP file:", error);
        toast({ title: "Erreur ZIP", description: "La création du fichier ZIP a échoué.", variant: "destructive" });
    }

    setIsGeneratingAllPdfs(false);
  };


  const isOverallLoading = isLoadingConfig || isLoadingRecords;

  const startOfCurrentWeek = startOfWeek(new Date(), { locale: fr });
  const endOfCurrentWeek = endOfWeek(new Date(), { locale: fr });

  const currentWeekData = monthData.filter(day => {
    const dayDate = new Date(day.date);
    return isWithinInterval(dayDate, { start: startOfCurrentWeek, end: endOfCurrentWeek });
  });

  return (
    <>
      <audio ref={audioRef} src="/TB.mp3" preload="auto" className="hidden" />
      <EndOfDayMessage isOpen={isEndOfDayMessageOpen} onClose={() => setIsEndOfDayMessageOpen(false)} />
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SprayCan className="w-6 h-6 text-primary"/>
            Suivi Mensuel du Nettoyage Cuisine
          </CardTitle>
          <CardDescription>
            Sélectionnez une année, un mois, et une zone pour le suivi. La sauvegarde est automatique.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingError && (
              <div className="text-center py-10 bg-destructive/10 text-destructive border border-destructive rounded-lg">
                  <AlertCircle className="mx-auto h-12 w-12" />
                  <p className="mt-2 text-sm font-semibold">Erreur de chargement des données</p>
                  <p className="text-xs">Impossible de charger les enregistrements. Vérifiez votre connexion.</p>
              </div>
          )}
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
            <div className="flex flex-col gap-2 md:col-span-1 md:justify-self-end">
              <div className="flex flex-row gap-2">
                <Button onClick={handleSave} disabled={isOverallLoading || isSaving || isGeneratingPdf || isGeneratingAllPdfs || !isDirty}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Sauvegarder
                </Button>
                <Button onClick={() => selectedZoneId && generatePdfForZone(selectedZoneId)} disabled={isOverallLoading || isSaving || isGeneratingPdf || isGeneratingAllPdfs || !selectedZoneData || monthData.length === 0 || configuredZones.length === 0}>
                  {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Générer PDF
                </Button>
              </div>
              <div className="flex flex-row gap-2">
                <Button variant="destructive" onClick={handleClearMonthData} disabled={isOverallLoading || isSaving || isGeneratingAllPdfs || Object.keys(cleaningRecords).length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Effacer Mois
                </Button>
                <Button variant="secondary" onClick={generateAllPdfsForMonth} disabled={isOverallLoading || isSaving || isGeneratingPdf || isGeneratingAllPdfs || configuredZones.length === 0}>
                  {isGeneratingAllPdfs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Fin du mois
                </Button> 
              </div>
            </div>
          </div>
          
          {isLoadingConfig ? (
            <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Chargement...</div>
          ) : configuredZones.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Aucune zone de nettoyage cuisine n'a été configurée.</p>
              <p className="text-xs text-muted-foreground/70">Veuillez en définir dans "Paramètres" > "Paramètres PMS".</p>
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
                      onClick={() => handleZoneChange(zone.id)}
                      size="sm"
                      disabled={isOverallLoading || isSaving || isGeneratingPdf}
                    >
                      {zone.name}
                    </Button>
                  ))}
                </div>
              </div>

              {isLoadingRecords && selectedZoneId ? (
                  <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Chargement pour "{selectedZoneData?.name}"...</div>
              ) : !selectedZoneId && !loadingError ? (
                  <div className="text-center py-10 border-2 border-dashed rounded-lg">
                      <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">Veuillez sélectionner une zone.</p>
                  </div>
              ) : selectedZoneData && monthData.length > 0 ? (
                  <div className={cn("overflow-x-auto border rounded-md max-h-[70vh]", (isSaving || loadingError) && "opacity-50")}>
                      <div className="space-y-4 p-2 sm:hidden block">
                        {currentWeekData.length > 0 ? (
                          currentWeekData.map(day => (
                              <Card key={`mobile-day-${day.date}`} className={cn("shadow-sm", day.isWeekend && "bg-muted/30")}>
                                <CardHeader className="p-3 border-b">
                                  <CardTitle className="text-base font-semibold mb-0">{day.dayOfMonth} {day.dayName}</CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 space-y-3">
                                  {selectedZoneData.tasks.map(task => {
                                    const record = getRecord(day.date, selectedZoneData.id, task.id);
                                    return (
                                      <div key={`mobile-${day.date}-${task.id}`} className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0">
                                        <div className="text-sm font-medium flex-grow mr-2">{task.name}</div>
                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center gap-1">
                                            <Label htmlFor={`checkbox-mobile-${day.date}-${task.id}`} className="text-xs">Fait?</Label>
                                            <Checkbox
                                              id={`checkbox-mobile-${day.date}-${task.id}`}
                                              checked={record.status === 'fait'}
                                              onCheckedChange={(checked) => handleRecordChange(day.date, selectedZoneData.id, task.id, 'status', !!checked)}
                                              disabled={isSuperviseur || day.isWeekend || isSaving || isOverallLoading || isGeneratingPdf || loadingError}
                                              className="h-5 w-5"
                                            />
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <Label htmlFor={`operator-mobile-${day.date}-${task.id}`} className="text-xs">Op.</Label>
                                            <Input type="text" placeholder="Op." value={record.operator} onChange={(e) => handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', e.target.value)} className="h-7 text-xs w-16" disabled={isSuperviseur || day.isWeekend || isSaving || isOverallLoading || isGeneratingPdf || loadingError} maxLength={15} />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </CardContent>
                              </Card>
                            ))
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">Aucun jour à afficher pour cette semaine.</div>
                        )}
                      </div>

                      <Table className="min-w-full table-fixed hidden sm:table">
                        <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                          <TableRow>
                            <TableHead className="w-[60px] min-w-[60px] text-center px-1 sticky left-0 z-20 bg-card">Date</TableHead>
                            <TableHead className="w-[80px] min-w-[80px] px-1 sticky left-[60px] z-20 bg-card">Jour</TableHead>
                            {selectedZoneData.tasks.map(task => (
                              <TableHead key={task.id} className="w-[200px] min-w-[200px] text-center px-1 border-l">
                                {task.name}
                                <div className="grid grid-cols-2 gap-px mt-1 text-xs font-normal text-muted-foreground">
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
                              <TableCell className={cn("text-center font-medium px-1 align-top py-2 sticky left-0 z-10", day.isWeekend ? "bg-muted/30" : "bg-card")}>
                                {day.dayOfMonth}
                              </TableCell>
                              <TableCell className={cn("px-1 align-top py-2 sticky left-[60px] z-10", day.isWeekend ? "bg-muted/30" : "bg-card")}>
                                {day.dayName}
                              </TableCell>
                              {selectedZoneData.tasks.map(task => {
                                const record = getRecord(day.date, selectedZoneData.id, task.id);
                                return (
                                  <TableCell key={`${task.id}-${day.date}`} className="p-1 align-top border-l">
                                  <div className="grid grid-cols-2 gap-1 items-center">
                                  <div className="flex items-center justify-center gap-1.5 px-1">
                                 <span className="text-xs text-muted-foreground truncate" title={task.name}>{task.name}</span>
                                 <Checkbox
                        checked={record.status === 'fait'}
                onCheckedChange={(checked) => handleRecordChange(day.date, selectedZoneData.id, task.id, 'status', !!checked)}
                disabled={isSuperviseur || day.isWeekend || isSaving || isOverallLoading || isGeneratingPdf || loadingError}
                className="h-5 w-5"
            />
                   </div>
                     <Input
            type="text"
            placeholder="Op."
            value={record.operator}
            onChange={(e) => handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', e.target.value)}
            className="h-7 text-xs text-center"
            disabled={isSuperviseur || day.isWeekend || isSaving || isOverallLoading || isGeneratingPdf || loadingError}
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
                  </div>
              ) : (
                  <div className="text-center py-10 border-2 border-dashed rounded-lg">
                      <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">{!loadingError ? "Aucune donnée à afficher." : "Le chargement a échoué."}</p>
                      {selectedZoneData && selectedZoneData.tasks.length === 0 && (
                          <p className="text-xs text-muted-foreground/70 mt-1">
                              La zone "{selectedZoneData.name}" n'a pas de tâches.
                          </p>
                      )}
                  </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
