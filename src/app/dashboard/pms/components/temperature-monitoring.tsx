"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, Trash2, Thermometer as ThermometerIcon, AlertCircle, Check, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth, startOfWeek, addDays, getDate } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { PmsEquipmentDefinition, MonthlyTempGridLog, PmsConfigurations } from '../types';
import { PMS_TEMPERATURE_MONITORING_KEY } from '@/app/dashboard/settings/types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from "@/components/ui/checkbox";
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import JSZip from 'jszip';


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

export default function TemperatureMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  
  const [equipmentList, setEquipmentList] = useState<PmsEquipmentDefinition[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | undefined>(undefined);
  
  const [monthDays, setMonthDays] = useState<DayData[]>([]);
  const [records, setRecords] = useState<MonthlyTempGridLog>({});
  
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingAllPdfs, setIsGeneratingAllPdfs] = useState(false);
  const { toast } = useToast();
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoggedInUsername(localStorage.getItem(LOGGED_IN_USERNAME_KEY));
    }
  }, []);

  const getFirestoreDocId = useCallback((equipmentId?: string) => {
    const id = equipmentId || selectedEquipmentId;
    if (!id) return null;
    return `tempGridLog_${id}_${selectedYear}_${selectedMonth}`;
  }, [selectedEquipmentId, selectedYear, selectedMonth]);

  const loadPmsConfigurations = useCallback(async () => {
    setIsLoadingConfig(true);
    const pmsSettingsDocRef = doc(firestore, "pmsConfigurations", "mainConfig");
    let fetchedEquipment: PmsEquipmentDefinition[] = [];
    try {
      const pmsSettingsSnap = await getDoc(pmsSettingsDocRef);
      if (pmsSettingsSnap.exists()) {
        const pmsSettings = pmsSettingsSnap.data() as PmsConfigurations;
        fetchedEquipment = (pmsSettings[PMS_TEMPERATURE_MONITORING_KEY] || []) as PmsEquipmentDefinition[];
      } else {
        toast({ title: "Configuration Manquante", description: "Aucune configuration d'équipement de température trouvée.", variant: "destructive"});
      }
    } catch (error) {
      console.error("Error loading PMS equipment configurations:", error);
      toast({ title: "Erreur Config Équipement", variant: "destructive" });
    }
    setEquipmentList(fetchedEquipment);
    setIsLoadingConfig(false);
    return fetchedEquipment; 
  }, [toast]);

  useEffect(() => {
    const initialize = async () => {
      const currentEquipment = await loadPmsConfigurations();
      if (currentEquipment.length > 0 && (!selectedEquipmentId || !currentEquipment.some(eq => eq.id === selectedEquipmentId))) {
        setSelectedEquipmentId(currentEquipment[0].id);
      } else if (currentEquipment.length === 0) {
        setSelectedEquipmentId(undefined);
      }
    };
    initialize();

    const handleConfigUpdate = async () => {
      const updatedEquipment = await loadPmsConfigurations();
        if (updatedEquipment.length > 0 && (!selectedEquipmentId || !updatedEquipment.some(eq => eq.id === selectedEquipmentId))) {
        setSelectedEquipmentId(updatedEquipment[0].id);
      } else if (updatedEquipment.length === 0) {
        setSelectedEquipmentId(undefined);
      }
    };
    window.addEventListener('pmsConfigUpdated', handleConfigUpdate);
    return () => window.removeEventListener('pmsConfigUpdated', handleConfigUpdate);
  }, [loadPmsConfigurations, selectedEquipmentId]);

  const loadTemperatureRecords = useCallback(async () => {
    if (!selectedEquipmentId) { 
      setRecords({});
      setIsLoadingRecords(false);
      return;
    }
    setIsLoadingRecords(true);
    const docId = getFirestoreDocId();
    if (!docId) { setIsLoadingRecords(false); return; }

    const recordsDocRef = doc(firestore, "pmsTemperatureGridLogs", docId);
    try {
      const docSnap = await getDoc(recordsDocRef);
      setRecords(docSnap.exists() ? (docSnap.data() as MonthlyTempGridLog) : {});
    } catch (error) {
      console.error("Error loading temperature grid records:", error);
      toast({ title: "Erreur Chargement Relevés", variant: "destructive" });
      setRecords({});
    }
    setIsLoadingRecords(false);
  }, [selectedEquipmentId, getFirestoreDocId, toast]);
  
  useEffect(() => {
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthDays(getMonthDays(yearNum, monthNum));
    
    if (selectedEquipmentId && !isLoadingConfig) { 
        loadTemperatureRecords();
    } else if (!selectedEquipmentId) {
        setRecords({}); 
        setIsLoadingRecords(false);
    }
  }, [selectedYear, selectedMonth, selectedEquipmentId, loadTemperatureRecords, isLoadingConfig]); 

  const handleManualSave = async () => {
    if (!selectedEquipmentId) return;
    setIsSaving(true);
    const docId = getFirestoreDocId();
    if (!docId) {
      toast({ title: "Erreur Sauvegarde", variant: "destructive" });
      setIsSaving(false);
      return;
    }
    const recordsDocRef = doc(firestore, "pmsTemperatureGridLogs", docId);
    try {
      await setDoc(recordsDocRef, records);
      toast({ title: "Sauvegardé", description: "Les relevés ont été sauvegardés avec succès." });
    } catch (error) {
      console.error("Error manual saving temperature grid records:", error);
      toast({ title: "Erreur Sauvegarde", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedEquipmentConfig = useMemo(() => {
    return equipmentList.find(eq => eq.id === selectedEquipmentId);
  }, [selectedEquipmentId, equipmentList]);

  const temperatureRowsToDisplay = useMemo(() => {
    const config = selectedEquipmentConfig;
    if (config?.equipmentType === 'refrigerator') {
      const max = 12, min = -5;
      return Array.from({ length: max - min + 1 }, (_, i) => max - i);
    } else if (config?.equipmentType === 'freezer') {
      const max = -10, min = -25;
      return Array.from({ length: max - min + 1 }, (_, i) => max - i);
    }
    return Array.from({ length: 16 - (-25) + 1 }, (_, i) => 16 - i); 
  }, [selectedEquipmentConfig]);

  const getEquipmentZoneInfo = useCallback((temp: number, currentConfig?: PmsEquipmentDefinition): { label: string; colorClass: string, pdfColor?: [number,number,number] } => {
    if (!currentConfig) return { label: '', colorClass: 'bg-background hover:bg-muted/50', pdfColor: [255,255,255] };
    const parse = (val: any): number | undefined => val !== undefined && val !== null && !isNaN(parseFloat(val)) ? parseFloat(val) : undefined;
    
    const targetMin = parse(currentConfig.targetTempMin), targetMax = parse(currentConfig.targetTempMax);
    const tol1Min = parse(currentConfig.tolerance1TempMin), tol1Max = parse(currentConfig.tolerance1TempMax);
    const tol2Min = parse(currentConfig.tolerance2TempMin), tol2Max = parse(currentConfig.tolerance2TempMax);

    if (targetMin !== undefined && targetMax !== undefined && temp >= targetMin && temp <= targetMax) return { label: "Cible", colorClass: 'bg-green-200 dark:bg-green-800/60 text-green-900 dark:text-green-100', pdfColor: [200, 230, 201] }; 
    if (tol1Min !== undefined && tol1Max !== undefined && temp >= tol1Min && temp <= tol1Max) return { label: "Tol. 1", colorClass: 'bg-blue-200 dark:bg-blue-800/60 text-blue-900 dark:text-blue-100', pdfColor: [173, 216, 230] }; 
    if (tol2Min !== undefined && tol2Max !== undefined && temp >= tol2Min && temp <= tol2Max) return { label: "Tol. 2", colorClass: 'bg-yellow-200 dark:bg-yellow-800/60 text-yellow-900 dark:text-yellow-100', pdfColor: [254, 249, 195] }; 
    return { label: "Rejet", colorClass: 'bg-red-200 dark:bg-red-800/60 text-red-900 dark:text-red-100', pdfColor: [254, 202, 202] }; 
  }, []);

  const handleCellClick = (dayDate: string, tempValue: number) => {
    if (records[dayDate]?.isOutOfOrder) return;
    setRecords(prev => {
      const dayRecord = prev[dayDate] || { markedTemp: null, time: '', operator: '', isOutOfOrder: false };
      const isCurrentlySelected = dayRecord.markedTemp === tempValue;
      const newMarkedTemp = isCurrentlySelected ? null : tempValue;
      
      let newTime = dayRecord.time;
      let newOperator = dayRecord.operator;

      if (newMarkedTemp !== null) { 
        newTime = dayRecord.time || format(new Date(), 'HH:mm');
        if (!dayRecord.operator && loggedInUsername) {
          newOperator = loggedInUsername.substring(0,3).toUpperCase();
        }
      } else { 
        newTime = ''; newOperator = '';
      }
      return { ...prev, [dayDate]: { ...dayRecord, markedTemp: newMarkedTemp, time: newTime, operator: newOperator } };
    });
  };
  
  const handleInputChange = (dayDate: string, field: 'time' | 'operator', value: string) => {
    if (records[dayDate]?.isOutOfOrder) return;
    setRecords(prev => ({ ...prev, [dayDate]: { ...(prev[dayDate] || { markedTemp: null, time: '', operator: '', isOutOfOrder: false }), [field]: value }}));
  };

  const handleOutOfOrderChange = (dayDate: string, isChecked: boolean) => {
    setRecords(prev => {
      const dayRecord = prev[dayDate] || { markedTemp: null, time: '', operator: '', isOutOfOrder: false };
      const updatedRecord = {
        ...dayRecord,
        isOutOfOrder: isChecked,
        markedTemp: isChecked ? null : dayRecord.markedTemp,
        time: isChecked ? '' : dayRecord.time,
        operator: isChecked ? '' : dayRecord.operator,
      };
      return { ...prev, [dayDate]: updatedRecord };
    });
  };

  const handleClearMonthData = async () => {
    if (!selectedEquipmentId) return;
    if (confirm(`Êtes-vous sûr de vouloir effacer les relevés pour ${selectedEquipmentConfig?.name} en ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ?`)) {
      setIsSaving(true);
      const docId = getFirestoreDocId();
      if (!docId) {setIsSaving(false); return;}
      try {
        await setDoc(doc(firestore, "pmsTemperatureGridLogs", docId), {}); 
        setRecords({});
        toast({ title: "Données Effacées" });
      } catch (error) {
        toast({ title: "Erreur d'Effacement", variant: "destructive" });
      }
      setIsSaving(false);
    }
  };

    const generatePdfEngine = async (equipmentConfig: PmsEquipmentDefinition, equipmentRecords: MonthlyTempGridLog): Promise<{ filename: string; data: Blob } | null> => {
    try {
      const pdfSettings = await getPdfLayoutSettings('pms_temperature_monitoring_monthly');
      const doc = new jsPDF({ orientation: pdfSettings.orientation as any || 'landscape', unit: 'pt', format: pdfSettings.pageSize as any || 'a4' }) as jsPDFWithAutoTable;
      
      const monthLabel = monthsArray.find(m => m.value === selectedMonth)?.label || '';
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      doc.autoTable({
        didDrawPage: (data: any) => {
          // --- EN-TÊTE ---
          let headerY = pdfSettings.marginTop;
          const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;
          if (data.pageNumber === 1) {
            const effectiveHeaderText = pdfSettings.headerText || (pdfSettings.logoUrl ? '{logo}' : '');
            if (effectiveHeaderText) {
              const headerRows = effectiveHeaderText.split('\n');
              doc.setFontSize(pdfSettings.headerFontSize);
              for (const row of headerRows) {
                  const cells = row.split('|');
                  if (cells.length === 0) continue;
                  let maxHeightInRow = 0;
                  const cellWidth = pageContentWidth / cells.length;
                  cells.forEach(cell => {
                      const cellText = cell.trim();
                      if (cellText === '{logo}' && pdfSettings.logoUrl) maxHeightInRow = Math.max(maxHeightInRow, 30);
                      else maxHeightInRow = Math.max(maxHeightInRow, (doc.splitTextToSize(cellText, cellWidth - 6).length * pdfSettings.headerFontSize * 0.7) + 6);
                  });

                  let currentX = pdfSettings.marginLeft;
                  for (const cell of cells) {
                      const cellText = cell.trim();
                      doc.rect(currentX, headerY, cellWidth, maxHeightInRow, 'S');
                      if (cellText === '{logo}' && pdfSettings.logoUrl) {
                          try {
                              const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                              const imgHeight = Math.min(maxHeightInRow - 6, 40);
                              const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                              doc.addImage(pdfSettings.logoUrl, imgProps.fileType, currentX + (cellWidth - imgWidth) / 2, headerY + (maxHeightInRow - imgHeight) / 2, imgWidth, imgHeight);
                          } catch (e) { console.error("Erreur logo.", e); }
                      } else if (cellText !== '{logo}') {
                          doc.text(cellText, currentX + cellWidth / 2, headerY + maxHeightInRow / 2, { align: 'center', baseline: 'middle', maxWidth: cellWidth - 6 });
                      }
                      currentX += cellWidth;
                  }
                  headerY += maxHeightInRow;
              }
            }
            
            // --- TITRE ---
            const moduleDefaultTitle = `Relevé Températures - ${equipmentConfig.name} - ${monthLabel} ${selectedYear}`;
            let finalTitle = pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle ? pdfSettings.documentBaseTitle.trim() : "";
            if (pdfSettings.showModuleTitle) finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
            if (finalTitle) {
                doc.setFontSize(pdfSettings.documentTitleFontSize);
                doc.text(finalTitle, doc.internal.pageSize.width / 2, headerY + pdfSettings.documentTitleFontSize, { align: 'center' });
            }
          }

          // --- PIED DE PAGE ---
          if (pdfSettings.footerText) {
            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(
                pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', doc.internal.getNumberOfPages().toString()),
                data.settings.margin.left, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2)
            );
          }
        },
        startY: pdfSettings.marginTop + 80, // Espace pour l'en-tête et le titre
        head: (() => {
            const headStyles: any = { fontStyle: 'bold', fontSize: 6.5, halign: 'center', valign: 'middle', cellPadding: 0.5 };
            if (pdfSettings.primaryColor) {
                const rgb = hexToRgb(pdfSettings.primaryColor);
                if (rgb) { headStyles.fillColor = [rgb.r, rgb.g, rgb.b]; headStyles.textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 125 ? [0,0,0] : [255,255,255]; }
            }
            return [[ 
                { content: 'T°C / Zone', styles: headStyles },
                ...monthDays.map(day => ({
                    content: `${day.dayOfMonth}\n${day.dayName.substring(0, 1)}`,
                    styles: { ...headStyles, fillColor: day.isWeekend ? [230, 230, 230] : headStyles.fillColor, textColor: day.isWeekend ? [100, 100, 100] : headStyles.textColor }
                }))
            ]];
        })(),
        body: (() => {
            const tempRows = equipmentConfig.equipmentType === 'refrigerator'
                ? Array.from({ length: 12 - (-5) + 1 }, (_, i) => 12 - i)
                : Array.from({ length: -10 - (-25) + 1 }, (_, i) => -10 - i);
            
            const bodyRows = tempRows.map(temp => {
                const zoneInfo = getEquipmentZoneInfo(temp, equipmentConfig);
                return [
                    { content: `${temp}°C\n(${zoneInfo.label})`, styles: { fontStyle: 'bold', fontSize: 5.5, fillColor: zoneInfo.pdfColor, valign: 'middle', halign: 'center' } },
                    ...monthDays.map(day => {
                        const record = equipmentRecords[day.date];
                        const isOutOfOrder = record?.isOutOfOrder;
                        const isSelected = record?.markedTemp === temp;
                        const styles = { 
                            halign: 'center', 
                            minCellHeight: 10,
                            fillColor: isOutOfOrder ? [230, 230, 230] : (isSelected ? zoneInfo.pdfColor : (day.isWeekend ? [240, 240, 240] : [255, 255, 255]))
                        };
                        return { content: isOutOfOrder ? '' : (isSelected ? 'X' : ''), styles: styles };
                    })
                ];
            });

            const footerRowStyles = { fontSize: 5.5, fontStyle: 'italic', halign: 'center', cellPadding: 0.5, minCellHeight: 10 };
            bodyRows.push(
                [{ content: 'Heure', styles: { ...footerRowStyles, fontStyle: 'bold' } }, ...monthDays.map(day => {
                    const record = equipmentRecords[day.date];
                    if (record?.isOutOfOrder) {
                        return { content: 'EN PANNE', styles: {...footerRowStyles, fontStyle: 'bold', fillColor: [230, 230, 230], valign: 'middle'} };
                    }
                    return { content: record?.time || '-', styles: footerRowStyles };
                })],
                [{ content: 'Opérateur', styles: { ...footerRowStyles, fontStyle: 'bold' } }, ...monthDays.map(day => {
                     const record = equipmentRecords[day.date];
                     if (record?.isOutOfOrder) {
                        return { content: '', styles: {...footerRowStyles, fillColor: [230, 230, 230]} };
                    }
                     return { content: record?.operator || '-', styles: footerRowStyles };
                })]
            );
            return bodyRows;
        })(),
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 0.5, valign: 'middle', font: pdfSettings.fontFamily },
        columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, ...Object.fromEntries(monthDays.map((_, i) => [i + 1, { cellWidth: (doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight - 60) / monthDays.length, halign: 'center' }])) },
        margin: { top: pdfSettings.marginTop + 80, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
      });

      const filename = `Releve_Temperature_${equipmentConfig.name.replace(/\s+/g, '_')}_${monthLabel}_${selectedYear}.pdf`;
      
      return {
        filename,
        data: doc.output('blob')
      };

    } catch (error) {
      console.error(`Error in generatePdfEngine for ${equipmentConfig.name}:`, error);
      toast({ title: `Erreur PDF (${equipmentConfig.name})`, variant: "destructive" });
      return null;
    }
  };

  const generatePdf = async () => {
    if (!selectedEquipmentConfig) {
      toast({ title: "Équipement non sélectionné", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);
    const pdfOutput = await generatePdfEngine(selectedEquipmentConfig, records);
    if (pdfOutput) {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(pdfOutput.data);
      link.download = pdfOutput.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({ title: "PDF Généré", description: `Le relevé pour ${selectedEquipmentConfig.name} a été téléchargé.` });
    }
    setIsGeneratingPdf(false);
  };

  const generateAllPdfsForMonth = async () => {
    if (equipmentList.length === 0) {
      toast({ title: "Aucun équipement configuré", variant: "destructive" });
      return;
    }
    setIsGeneratingAllPdfs(true);
    toast({ title: "Génération du ZIP en cours...", description: `Préparation de ${equipmentList.length} rapport(s)...` });
    
    const zip = new JSZip();
    const monthLabel = monthsArray.find(m => m.value === selectedMonth)?.label || 'Mois';
    const folderName = `Relevés Températures - ${monthLabel} ${selectedYear}`;
    const folder = zip.folder(folderName);

    if (!folder) {
        toast({ title: "Erreur ZIP", description: "Impossible de créer le dossier ZIP.", variant: "destructive" });
        setIsGeneratingAllPdfs(false);
        return;
    }

    for (const equipment of equipmentList) {
      const docId = `tempGridLog_${equipment.id}_${selectedYear}_${selectedMonth}`;
      const docRef = doc(firestore, "pmsTemperatureGridLogs", docId);
      try {
        const docSnap = await getDoc(docRef);
        const equipmentRecords = docSnap.exists() ? (docSnap.data() as MonthlyTempGridLog) : {};
        
        const pdfOutput = await generatePdfEngine(equipment, equipmentRecords);
        if (pdfOutput) {
          folder.file(pdfOutput.filename, pdfOutput.data, { binary: true });
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        toast({ title: `Erreur chargement (${equipment.name})`, variant: "destructive" });
      }
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

      toast({ title: "ZIP Généré !", description: "L'archive des relevés de température a été téléchargée.", variant: "success" });
    } catch(e) {
      console.error("Error generating temperature ZIP:", e);
      toast({ title: "Erreur ZIP", description: "La création de l'archive a échoué.", variant: "destructive" });
    }

    setIsGeneratingAllPdfs(false);
  };

  const isUIDisabled = isLoadingConfig || isLoadingRecords || isSaving || isGeneratingAllPdfs;

  if (isLoadingConfig && equipmentList.length === 0) {
    return (
        <Card className="shadow-lg">
          <CardHeader><CardTitle className="flex items-center gap-2"><ThermometerIcon className="w-6 h-6 text-primary"/>Suivi des Températures</CardTitle></CardHeader>
          <CardContent><div className="flex justify-center items-center p-10"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Chargement...</div></CardContent>
        </Card>
    );
  }


  
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThermometerIcon className="w-6 h-6 text-primary"/>
          Suivi des Températures
        </CardTitle>
        <CardDescription>
          Sélectionnez un équipement et une période. Cochez la température relevée pour chaque jour.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end mb-4">
          <div>
            <Label htmlFor="equipment-select">Équipement</Label>
            <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId} disabled={isUIDisabled || equipmentList.length === 0}>
              <SelectTrigger id="equipment-select"><SelectValue placeholder={equipmentList.length === 0 ? "Aucun équipement" : "Sélectionner..."} /></SelectTrigger>
              <SelectContent>
                {equipmentList.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="year-select-temp">Année</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isUIDisabled}>
              <SelectTrigger id="year-select-temp"><SelectValue /></SelectTrigger>
              <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month-select-temp">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isUIDisabled}>
              <SelectTrigger id="month-select-temp"><SelectValue /></SelectTrigger>
              <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end">
            <Button onClick={generatePdf} disabled={isUIDisabled || !selectedEquipmentId || isGeneratingPdf} className="w-full">
              {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              PDF
            </Button>
            <Button variant="secondary" onClick={generateAllPdfsForMonth} disabled={isUIDisabled || equipmentList.length === 0} className="w-full">
              {isGeneratingAllPdfs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Fin du mois
            </Button>
          </div>
        </div>

        {(isLoadingConfig || (isLoadingRecords && selectedEquipmentId)) ? (
            <div className="flex justify-center items-center p-10"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Chargement...</div>
        ) : !selectedEquipmentId ? (
             <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {equipmentList.length === 0 ? "Aucun équipement configuré." : "Veuillez sélectionner un équipement."}
                </p>
                {equipmentList.length === 0 && <p className="text-xs text-muted-foreground/70">Configurez les équipements dans Paramètres > Paramètres PMS.</p>}
            </div>
        ) : (
          <>
            {/* Mobile View (current week only) */}
            <div className="space-y-4 sm:hidden">
                {monthDays.map(day => {
                    const dayRecord = records[day.date] || { markedTemp: null, time: '', operator: '', isOutOfOrder: false };
                    const isWeekend = day.isWeekend;
                    const isDisabled = isWeekend || isUIDisabled;
                    
                    const today = new Date();
                    const currentDayDate = new Date(day.date);
                    
                    const startOfThisWeek = startOfWeek(today, { locale: fr });
                    const endOfThisWeek = addDays(startOfThisWeek, 5);
                    const isActuallyInCurrentWeek = currentDayDate >= startOfThisWeek && currentDayDate <= endOfThisWeek;

                    if (!isActuallyInCurrentWeek) {
                        return null;
                    }

                    return (
                    <Card key={`${day.date}-mobile`} className={cn("border", (isWeekend || dayRecord.isOutOfOrder) && "bg-muted/30 opacity-70")}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">{format(new Date(day.date), "EEEE dd MMMM", { locale: fr })}</CardTitle>
                            {isWeekend && <CardDescription className="text-amber-600 dark:text-amber-400">Relevé non requis</CardDescription>}
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-1">
                                {temperatureRowsToDisplay.map(temp => {
                                    const zoneInfo = getEquipmentZoneInfo(temp, selectedEquipmentConfig);
                                    const isSelected = dayRecord.markedTemp === temp;
                                    
                                    return (
                                        <div
                                            key={`${day.date}-mobile-${temp}`}
                                            className={cn(
                                                "grid grid-cols-3 gap-2 items-center p-2 rounded-md border text-sm",
                                                zoneInfo.colorClass,
                                                (isDisabled || dayRecord.isOutOfOrder) ? "cursor-not-allowed" : "cursor-pointer",
                                                isSelected && "ring-2 ring-primary ring-inset",
                                                dayRecord.isOutOfOrder && "opacity-50"
                                            )}
                                            onClick={() => !(isDisabled || dayRecord.isOutOfOrder) && handleCellClick(day.date, temp)}
                                        >
                                            <div>{temp}°C</div>
                                            <div>{zoneInfo.label || '-'}</div>
                                            <div className="flex justify-center">{isSelected && <Check className="h-4 w-4" />}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1">
                                    <Label htmlFor={`time-${day.date}-mobile`} className="text-xs">Heure</Label>
                                    <Input id={`time-${day.date}-mobile`} type="time" value={dayRecord.time || ""} onChange={e => handleInputChange(day.date, 'time', e.target.value)} disabled={isDisabled || dayRecord.isOutOfOrder} className="h-8 text-xs"/>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor={`operator-${day.date}-mobile`} className="text-xs">Opérateur</Label>
                                    <Input id={`operator-${day.date}-mobile`} type="text" placeholder="Op." value={dayRecord.operator || ""} onChange={e => handleInputChange(day.date, 'operator', e.target.value)} disabled={isDisabled || dayRecord.isOutOfOrder} className="h-8 text-xs" maxLength={5}/>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox 
                                    id={`out-of-order-${day.date}-mobile`}
                                    checked={dayRecord.isOutOfOrder || false}
                                    onCheckedChange={(isChecked: boolean) => handleOutOfOrderChange(day.date, isChecked)}
                                    disabled={isDisabled}
                                />
                                <Label htmlFor={`out-of-order-${day.date}-mobile`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    En Panne
                                </Label>
                            </div>
                        </CardContent>
                    </Card>
                    );
                })}
            </div>

            <div className="overflow-x-auto border rounded-md max-h-[70vh]">
              <Table className="min-w-max border-collapse hidden sm:table">
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    <TableHead className="w-[100px] sticky left-0 z-20 bg-card">T°C / Zone</TableHead>
                    {monthDays.map(day => (
                      <TableHead key={day.date} className={cn("w-[30px] text-center p-1 border-l", day.isWeekend && "bg-muted/50")}>
                        {day.dayOfMonth}<br/>{day.dayName.substring(0,1)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {temperatureRowsToDisplay.map(temp => { 
                    const zoneInfo = getEquipmentZoneInfo(temp, selectedEquipmentConfig);
                    return (
                      <TableRow key={temp}>
                        <TableCell className={cn("sticky left-0 z-10 font-medium text-xs p-1 text-center h-8", zoneInfo.colorClass)}>
                          {temp}°C {zoneInfo.label && `- ${zoneInfo.label}`}
                        </TableCell>
                        {monthDays.map(day => {
                          const dayRecord = records[day.date];
                          const isSelected = dayRecord?.markedTemp === temp;
                          const isOutOfOrder = dayRecord?.isOutOfOrder;
                          return (
                            <TableCell
                              key={`${day.date}-${temp}`}
                              className={cn("h-8 p-0 text-center cursor-pointer border-l", 
                                day.isWeekend ? "bg-muted/30 cursor-not-allowed" : zoneInfo.colorClass, 
                                isSelected && "ring-2 ring-primary ring-inset",
                                isOutOfOrder && "bg-slate-200 dark:bg-slate-700 cursor-not-allowed"
                              )}
                              onClick={() => !day.isWeekend && !isSaving && !isOutOfOrder && handleCellClick(day.date, temp)}
                            >
                              {!isOutOfOrder && isSelected && <Check className="h-4 w-4 mx-auto" />}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                  <TableRow>
                    <TableCell className="sticky left-0 z-10 font-semibold text-xs p-1 text-center bg-card">Heure</TableCell>
                    {monthDays.map(day => (
                      <TableCell key={`time-${day.date}`} className="p-0.5">
                        <Input type="time" value={records[day.date]?.time || ""} onChange={e => handleInputChange(day.date, 'time', e.target.value)} className="h-7 text-xs w-full bg-background/50" disabled={day.isWeekend || isUIDisabled || records[day.date]?.isOutOfOrder}/>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 z-10 font-semibold text-xs p-1 text-center bg-card">Opérateur</TableCell>
                    {monthDays.map(day => (
                      <TableCell key={`operator-${day.date}`} className="p-0.5">
                        <Input type="text" placeholder="Op." value={records[day.date]?.operator || ""} onChange={e => handleInputChange(day.date, 'operator', e.target.value)} className="h-7 text-xs w-full bg-background/50" disabled={day.isWeekend || isUIDisabled || records[day.date]?.isOutOfOrder} maxLength={5}/>
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 z-10 font-semibold text-xs p-1 text-center bg-card">En Panne</TableCell>
                    {monthDays.map(day => (
                      <TableCell key={`out-of-order-${day.date}`} className={cn("p-1 text-center border-l", day.isWeekend && "bg-muted/40")}>
                        <Checkbox
                          checked={records[day.date]?.isOutOfOrder || false}
                          onCheckedChange={(isChecked: boolean) => handleOutOfOrderChange(day.date, isChecked)}
                          disabled={day.isWeekend || isUIDisabled}
                          className="mx-auto"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between items-center mt-4">
              <Button onClick={handleManualSave} disabled={isUIDisabled || !selectedEquipmentId}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sauvegarder les relevés
              </Button>
              <Button variant="destructive" onClick={handleClearMonthData} size="sm" disabled={isUIDisabled || !selectedEquipmentId || Object.keys(records).length === 0}>
                  <Trash2 className="mr-2 h-4 w-4"/> Effacer
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
