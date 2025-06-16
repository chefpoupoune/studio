
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, Trash2, Thermometer as ThermometerIcon, AlertCircle, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { PmsEquipmentDefinition, MonthlyTempGridLog, DailyTempGridLogEntry, PmsConfigurations } from '../types';
import { PMS_TEMPERATURE_MONITORING_KEY } from '@/app/dashboard/settings/types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
  const { toast } = useToast();
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoggedInUsername(localStorage.getItem(LOGGED_IN_USERNAME_KEY));
    }
  }, []);
  
  const getFirestoreDocId = useCallback(() => {
    if (!selectedEquipmentId) return null;
    return `tempGridLog_${selectedEquipmentId}_${selectedYear}_${selectedMonth}`;
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
    // Return fetchedEquipment so the calling effect can use it immediately
    return fetchedEquipment; 
  }, [toast]);

  // Effect to handle initial load and config updates
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
      console.log("[TempMonitoring] PMS Config updated event received. Reloading equipment list.");
      const updatedEquipment = await loadPmsConfigurations(); // Re-fetch and get the list
      // Logic to re-select or clear selection based on updatedEquipment
       if (updatedEquipment.length > 0 && (!selectedEquipmentId || !updatedEquipment.some(eq => eq.id === selectedEquipmentId))) {
        setSelectedEquipmentId(updatedEquipment[0].id);
      } else if (updatedEquipment.length === 0) {
        setSelectedEquipmentId(undefined);
      }
    };
    window.addEventListener('pmsConfigUpdated', handleConfigUpdate);
    return () => window.removeEventListener('pmsConfigUpdated', handleConfigUpdate);
  }, [loadPmsConfigurations, selectedEquipmentId]); // Add selectedEquipmentId to re-run if it changes externally

  const loadTemperatureRecords = useCallback(async () => {
    if (!selectedEquipmentId) { // No need to check isLoadingConfig here, as this is called when selectedEquipmentId is set
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
      if (docSnap.exists()) {
        setRecords(docSnap.data() as MonthlyTempGridLog);
      } else {
        setRecords({});
      }
    } catch (error) {
      console.error("Error loading temperature grid records:", error);
      toast({ title: "Erreur Chargement Relevés", variant: "destructive" });
      setRecords({});
    }
    setIsLoadingRecords(false);
  }, [selectedEquipmentId, getFirestoreDocId, toast]);
  
  // Effect to load records when year, month, or selectedEquipmentId changes
  useEffect(() => {
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthDays(getMonthDays(yearNum, monthNum));
    
    if (selectedEquipmentId && !isLoadingConfig) { // Ensure config is loaded before trying to load records
        loadTemperatureRecords();
    } else if (!selectedEquipmentId) {
        setRecords({}); // Clear records if no equipment is selected
        setIsLoadingRecords(false);
    }
  }, [selectedYear, selectedMonth, selectedEquipmentId, loadTemperatureRecords, isLoadingConfig]); 

  // Auto-save effect
  useEffect(() => {
    if (isLoadingConfig || isLoadingRecords || isSaving || !selectedEquipmentId) return;

    const saveRecords = async () => {
      const docId = getFirestoreDocId();
      if (!docId || (Object.keys(records).length === 0 && !doc(firestore, "pmsTemperatureGridLogs", docId))) return;
      
      setIsSaving(true);
      const recordsDocRef = doc(firestore, "pmsTemperatureGridLogs", docId);
      try {
        await setDoc(recordsDocRef, records);
      } catch (error) {
        console.error("Error auto-saving temperature grid records:", error);
        toast({ title: "Erreur Sauvegarde Auto", variant: "destructive" });
      }
      setIsSaving(false);
    };
    const timeoutId = setTimeout(saveRecords, 2000);
    return () => clearTimeout(timeoutId);
  }, [records, isLoadingConfig, isLoadingRecords, isSaving, selectedEquipmentId, getFirestoreDocId, toast]);

  const selectedEquipmentConfig = useMemo(() => {
    return equipmentList.find(eq => eq.id === selectedEquipmentId);
  }, [selectedEquipmentId, equipmentList]);

  const temperatureRowsToDisplay = useMemo(() => {
    if (selectedEquipmentConfig?.equipmentType === 'refrigerator') {
      const fridgeMaxTemp = 12; 
      const fridgeMinTemp = -5; 
      return Array.from({ length: fridgeMaxTemp - fridgeMinTemp + 1 }, (_, i) => fridgeMaxTemp - i);
    } else if (selectedEquipmentConfig?.equipmentType === 'freezer') {
      const freezerMaxTemp = -10;
      const freezerMinTemp = -25;
      return Array.from({ length: freezerMaxTemp - freezerMinTemp + 1 }, (_, i) => freezerMaxTemp - i);
    }
    return Array.from({ length: 16 - (-25) + 1 }, (_, i) => 16 - i); // Default wider range if type undefined
  }, [selectedEquipmentConfig]);

  const getEquipmentZoneInfo = useCallback((temp: number, currentConfig?: PmsEquipmentDefinition): { label: string; colorClass: string, pdfColor?: [number,number,number] } => {
    if (!currentConfig) {
      return { label: '', colorClass: 'bg-background hover:bg-muted/50', pdfColor: [255,255,255] };
    }
    
    const parseAndValidate = (val: any): number | undefined => {
      if (typeof val === 'number' && !isNaN(val)) return val;
      if (typeof val === 'string' && val.trim() !== '') {
          const num = parseFloat(val);
          if (!isNaN(num)) return num;
      }
      return undefined;
    };
    
    const targetMin = parseAndValidate(currentConfig.targetTempMin);
    const targetMax = parseAndValidate(currentConfig.targetTempMax);
    const tol1Min = parseAndValidate(currentConfig.tolerance1TempMin);
    const tol1Max = parseAndValidate(currentConfig.tolerance1TempMax);
    const tol2Min = parseAndValidate(currentConfig.tolerance2TempMin);
    const tol2Max = parseAndValidate(currentConfig.tolerance2TempMax);

    if (typeof targetMin === 'number' && typeof targetMax === 'number' && temp >= targetMin && temp <= targetMax) {
      return { label: "Cible", colorClass: 'bg-green-200 dark:bg-green-800/60 text-green-900 dark:text-green-100 hover:bg-green-300 dark:hover:bg-green-700/60', pdfColor: [200, 230, 201] }; // Light Green
    }
    if (typeof tol1Min === 'number' && typeof tol1Max === 'number' && temp >= tol1Min && temp <= tol1Max) {
      return { label: "Tol. 1", colorClass: 'bg-blue-200 dark:bg-blue-800/60 text-blue-900 dark:text-blue-100 hover:bg-blue-300 dark:hover:bg-blue-700/60', pdfColor: [173, 216, 230] }; // Light Blue
    }
    if (typeof tol2Min === 'number' && typeof tol2Max === 'number' && temp >= tol2Min && temp <= tol2Max) {
      return { label: "Tol. 2", colorClass: 'bg-yellow-200 dark:bg-yellow-800/60 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-300 dark:hover:bg-yellow-700/60', pdfColor: [254, 249, 195] }; // Light Yellow
    }
    
    return { label: "Rejet", colorClass: 'bg-red-200 dark:bg-red-800/60 text-red-900 dark:text-red-100 hover:bg-red-300 dark:hover:bg-red-700/60', pdfColor: [254, 202, 202] }; // Light Red
  }, []);


  const handleCellClick = (dayDate: string, tempValue: number) => {
    setRecords(prev => {
      const dayRecord = prev[dayDate] || { markedTemp: null, time: '', operator: '' };
      const isCurrentlySelected = dayRecord.markedTemp === tempValue;
      const newMarkedTemp = isCurrentlySelected ? null : tempValue;
      
      let newTime = dayRecord.time || '';
      let newOperator = dayRecord.operator || '';

      if (newMarkedTemp !== null) { 
        if (!newTime || isCurrentlySelected) { 
          newTime = format(new Date(), 'HH:mm');
        }
        if ((!newOperator || (isCurrentlySelected && !newOperator)) && loggedInUsername && loggedInUsername.trim() !== "") { 
          newOperator = loggedInUsername.substring(0,3).toUpperCase();
        }
      } else { 
        newTime = '';
        newOperator = '';
      }
      
      return {
        ...prev,
        [dayDate]: {
          ...dayRecord,
          markedTemp: newMarkedTemp,
          time: newTime,
          operator: newOperator,
        }
      };
    });
  };
  
  const handleInputChange = (dayDate: string, field: 'time' | 'operator', value: string) => {
     setRecords(prev => {
      const dayRecord = prev[dayDate] || { markedTemp: null, time: '', operator: '' }; 
      return {
        ...prev,
        [dayDate]: {
          ...dayRecord,
          [field]: value,
        }
      };
    });
  };

  const handleClearMonthData = async () => {
    if (!selectedEquipmentId) return;
    if (confirm(`Êtes-vous sûr de vouloir effacer les relevés pour ${selectedEquipmentConfig?.name} en ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ?`)) {
      setIsSaving(true);
      const docId = getFirestoreDocId();
      if (!docId) {setIsSaving(false); return;}
      const docRef = doc(firestore, "pmsTemperatureGridLogs", docId);
      try {
        await setDoc(docRef, {}); 
        setRecords({});
        toast({ title: "Données Effacées", description: "Les relevés pour ce mois et cet équipement ont été effacés." });
      } catch (error) {
        console.error("Error clearing month data:", error);
        toast({ title: "Erreur d'Effacement", variant: "destructive" });
      }
      setIsSaving(false);
    }
  };
  
  const generatePdf = () => {
    if (!selectedEquipmentConfig) {
      toast({ title: "Équipement non sélectionné", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const pdfSettings = getPdfLayoutSettings('pms_temperature_monitoring_monthly');
      const doc = new jsPDF({
        orientation: pdfSettings.orientation || 'landscape', // Default to landscape if not specified
        unit: 'pt',
        format: pdfSettings.pageSize || 'a4',
      }) as jsPDFWithAutoTable;
      doc.setFont(pdfSettings.fontFamily);
      const monthLabel = monthsArray.find(m => m.value === selectedMonth)?.label || '';
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = pdfSettings.marginTop;

      // Header (Logo & Text)
      if (pdfSettings.headerText) {
        const headerRows = pdfSettings.headerText.split('\n').map(rowText => rowText.split('|').map(cellText => cellText.trim()));
        const headerTableBody = headerRows.map(row => row.map(cell => cell === '{logo}' ? '' : cell));
        doc.autoTable({
          body: headerTableBody, startY: currentY, theme: 'plain',
          styles: { fontSize: pdfSettings.headerFontSize, cellPadding: 1, font: pdfSettings.fontFamily },
          columnStyles: { 0: { cellWidth: 'auto'} },
          margin: { top: pdfSettings.marginTop, left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
          didDrawCell: (data) => {
            if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image') && headerRows[data.row.index][data.column.index] === '{logo}') {
              try {
                const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                const formatType = imgProps.fileType.toUpperCase();
                const cellPaddingVal = 2;
                let imgWidth = data.cell.width - 2 * cellPaddingVal; let imgHeight = data.cell.height - 2 * cellPaddingVal;
                const cellAspectRatio = data.cell.width / data.cell.height; const imgAspectRatio = imgProps.width / imgProps.height;
                if (imgAspectRatio > cellAspectRatio) imgHeight = imgWidth / imgAspectRatio; else imgWidth = imgHeight * imgAspectRatio;
                const imgX = data.cell.x + (data.cell.width - imgWidth) / 2; const imgY = data.cell.y + (data.cell.height - imgHeight) / 2;
                doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, imgHeight);
              } catch (e: any) { console.error("Error drawing logo in PDF header table:", e); }
            }
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;
      } else if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
        try {
          const imgProps = doc.getImageProperties(pdfSettings.logoUrl); const formatType = imgProps.fileType.toUpperCase();
          const desiredHeight = 30; const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
          doc.addImage(pdfSettings.logoUrl, formatType, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight);
          currentY += desiredHeight + 5;
        } catch(e: any) { console.error("Error drawing standalone logo in PDF:", e); }
      }
      
      const moduleDefaultTitle = `Relevé Températures - ${selectedEquipmentConfig.name} - ${monthLabel} ${selectedYear}`;
      let title;
      if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle && pdfSettings.documentBaseTitle.trim() !== "") {
        title = `${pdfSettings.documentBaseTitle} - ${moduleDefaultTitle}`;
      } else {
        title = moduleDefaultTitle;
      }
      doc.setFontSize(pdfSettings.documentTitleFontSize);
      doc.text(title, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
      currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;
      doc.setFontSize(pdfSettings.defaultFontSize);
      doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize + 7;

      const headStyles: any = {
        fontStyle: 'bold',
        fontSize: pdfSettings.tableHeaderFontSize || 6.5, 
        halign: 'center',
        valign: 'middle',
        cellPadding: 0.5, 
      };
      if (pdfSettings.primaryColor) {
        const rgb = hexToRgb(pdfSettings.primaryColor);
        if (rgb) { headStyles.fillColor = rgb;
        const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
        headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];}
      } else {
         headStyles.fillColor = [220,220,220]; headStyles.textColor = [0,0,0];
      }

      const tableHead = [
        { content: 'T°C / Zone', styles: headStyles },
        ...monthDays.map(day => ({
          content: `${day.dayOfMonth}\n${day.dayName.substring(0,1)}`, 
          styles: { ...headStyles, fillColor: day.isWeekend ? [230,230,230] : headStyles.fillColor, textColor: day.isWeekend ? [100,100,100] : headStyles.textColor }
        }))
      ];

      const tableBody = temperatureRowsToDisplay.map(temp => {
        const zoneInfo = getEquipmentZoneInfo(temp, selectedEquipmentConfig);
        const firstCell = {
          content: `${temp}°C${zoneInfo.label ? `\n(${zoneInfo.label})` : ''}`,
          styles: {
            fontStyle: 'bold',
            fontSize: (pdfSettings.tableBodyFontSize || 6.5) -1, 
            fillColor: zoneInfo.pdfColor || [255,255,255],
            textColor: (zoneInfo.pdfColor && (zoneInfo.pdfColor[0]*299 + zoneInfo.pdfColor[1]*587 + zoneInfo.pdfColor[2]*114)/1000 > 125) ? [0,0,0] : [0,0,0],
            valign: 'middle',
            halign: 'center'
          }
        };
        const tempCells = monthDays.map(day => {
          const record = records[day.date];
          let cellContent = '';
          let cellFillColor = day.isWeekend ? [240,240,240] : [255,255,255];
          if (record && record.markedTemp === temp) {
            cellContent = 'X';
            const markedTempZone = getEquipmentZoneInfo(record.markedTemp, selectedEquipmentConfig);
            cellFillColor = markedTempZone.pdfColor || cellFillColor;
          }
          return { content: cellContent, styles: { fillColor: cellFillColor, halign: 'center', minCellHeight: 10 } }; 
        });
        return [firstCell, ...tempCells];
      });

      const footerRowStyles = { fontSize: (pdfSettings.tableBodyFontSize || 6.5) -1, fontStyle: 'italic', halign: 'center', cellPadding: 0.5, minCellHeight: 10 };
      const timeRow = [{ content: 'Heure', styles: {...footerRowStyles, fontStyle: 'bold'} }, ...monthDays.map(day => ({ content: records[day.date]?.time || '-', styles: footerRowStyles }))];
      const operatorRow = [{ content: 'Opérateur', styles: {...footerRowStyles, fontStyle: 'bold'} }, ...monthDays.map(day => ({ content: records[day.date]?.operator || '-', styles: footerRowStyles }))];
      
      tableBody.push(timeRow, operatorRow);
      
      const firstColWidth = 60; // Adjusted T°C / Zone width
      const availableWidthForDays = (doc.internal.pageSize.getWidth() - pdfSettings.marginLeft - pdfSettings.marginRight - firstColWidth);
      const dayColumnWidth = Math.max(15, availableWidthForDays / monthDays.length); // Adjusted min width

      const columnStyles: {[key: string]: any} = { 0: { cellWidth: firstColWidth, fontStyle: 'bold' } };
      monthDays.forEach((_, index) => {
        columnStyles[index + 1] = { cellWidth: dayColumnWidth, halign: 'center' };
      });

      doc.autoTable({
        head: [tableHead],
        body: tableBody,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: pdfSettings.tableBodyFontSize || 6.5, cellPadding: 0.5, valign: 'middle', font: pdfSettings.fontFamily }, 
        columnStyles: columnStyles,
        tableWidth: 'auto', 
        margin: { top: pdfSettings.marginTop, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
            doc.setFontSize(pdfSettings.footerFontSize || 8);
            doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
          }
        }
      });

      doc.save(`Releve_Temperature_${selectedEquipmentConfig.name.replace(/\s+/g, '_')}_${monthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Généré", description: `Le relevé de température pour ${selectedEquipmentConfig.name} a été téléchargé.` });

    } catch (error) {
      console.error("Error generating temperature PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const isUIDisabled = isLoadingConfig || isLoadingRecords || isSaving;

  if (isLoadingConfig && equipmentList.length === 0) {
    return (
        <Card className="shadow-lg">
            <CardHeader><CardTitle className="flex items-center gap-2"><ThermometerIcon className="w-6 h-6 text-primary"/>Suivi des Températures</CardTitle></CardHeader>
            <CardContent><div className="flex justify-center items-center p-10"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Chargement des configurations...</div></CardContent>
        </Card>
    );
  }
  
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThermometerIcon className="w-6 h-6 text-primary"/>
          Suivi des Températures (Frigos, Congélateurs)
        </CardTitle>
        <CardDescription>
          Sélectionnez un équipement, un mois et une année. Cochez la température relevée pour chaque jour.
          Les zones (Cible, Tolérance, Rejet) sont définies dans les Paramètres PMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end mb-4">
          <div>
            <Label htmlFor="equipment-select">Équipement</Label>
            <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId} disabled={isUIDisabled || equipmentList.length === 0}>
              <SelectTrigger id="equipment-select"><SelectValue placeholder={equipmentList.length === 0 ? "Aucun équipement configuré" : "Sélectionner équipement"} /></SelectTrigger>
              <SelectContent>
                {equipmentList.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.equipmentType === 'freezer' ? 'Congél.' : 'Réfrig.'})</SelectItem>)}
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
            <Button onClick={generatePdf} disabled={isUIDisabled || !selectedEquipmentId || isGeneratingPdf} className="w-full sm:w-auto">
              {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Générer PDF
            </Button>
          </div>
        </div>

        {(isLoadingConfig || (isLoadingRecords && selectedEquipmentId)) ? (
            <div className="flex justify-center items-center p-10">
                <Loader2 className="mr-2 h-5 w-5 animate-spin"/>
                {isLoadingConfig ? "Chargement des configurations d'équipement..." : "Chargement des relevés..."}
            </div>
        ) : !selectedEquipmentId ? (
             <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                    {equipmentList.length === 0 ? "Aucun équipement n'est configuré." : "Veuillez sélectionner un équipement pour afficher la grille."}
                </p>
                 {equipmentList.length === 0 && <p className="text-xs text-muted-foreground/70">Configurez les équipements dans Paramètres &gt; Paramètres PMS.</p>}
            </div>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-max border-collapse">
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  <TableHead className="w-[180px] min-w-[180px] sticky left-0 z-20 bg-card text-xs p-1 text-center border-r">T°C / Zone</TableHead>
                  {monthDays.map(day => (
                    <TableHead key={day.date} className={cn("w-[40px] min-w-[40px] text-center text-xs p-1 border-r", day.isWeekend && "bg-muted/50")}>
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
                      <TableCell className={cn(
                          "sticky left-0 z-10 font-medium text-xs p-1 text-center border-r h-8", 
                          zoneInfo.colorClass 
                        )}>
                        <div className="flex items-center justify-center h-full">
                          {temp}°C {zoneInfo.label && `- ${zoneInfo.label}`}
                        </div>
                      </TableCell>
                      {monthDays.map(day => {
                        const dayRecord = records[day.date] || { markedTemp: null, time: '', operator: '' };
                        const isSelected = dayRecord.markedTemp === temp;
                        let cellEffectiveBgClass = zoneInfo.colorClass;
                        if(day.isWeekend) cellEffectiveBgClass = "bg-muted/30 opacity-70 cursor-not-allowed";
                        else if(isSelected) {
                            const markedTempZone = getEquipmentZoneInfo(temp, selectedEquipmentConfig);
                            cellEffectiveBgClass = markedTempZone.colorClass;
                        }
                        
                        return (
                          <TableCell
                            key={`${day.date}-${temp}`}
                            className={cn(
                              "w-[40px] h-8 p-0 text-center cursor-pointer border-r",
                              cellEffectiveBgClass,
                              isSelected && "ring-2 ring-primary ring-inset" 
                            )}
                            onClick={() => !day.isWeekend && !isSaving && !isOverallLoading && handleCellClick(day.date, temp)}
                          >
                            {isSelected && <Check className="h-4 w-4 mx-auto text-foreground" />}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/20">
                  <TableCell className="sticky left-0 z-10 font-semibold text-xs p-1 text-center border-r bg-muted/20">Heure</TableCell>
                  {monthDays.map(day => (
                    <TableCell key={`time-${day.date}`} className="p-0.5 border-r">
                      <Input
                        type="time"
                        value={records[day.date]?.time || ""}
                        onChange={e => handleInputChange(day.date, 'time', e.target.value)}
                        className="h-7 text-xs w-full text-center bg-background/50 focus:bg-background"
                        disabled={day.isWeekend || isSaving || isOverallLoading}
                      />
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell className="sticky left-0 z-10 font-semibold text-xs p-1 text-center border-r bg-muted/20">Opérateur</TableCell>
                  {monthDays.map(day => (
                    <TableCell key={`operator-${day.date}`} className="p-0.5 border-r">
                      <Input
                        type="text"
                        placeholder="Op."
                        value={records[day.date]?.operator || ""}
                        onChange={e => handleInputChange(day.date, 'operator', e.target.value)}
                        className="h-7 text-xs w-full text-center bg-background/50 focus:bg-background"
                        disabled={day.isWeekend || isSaving || isOverallLoading}
                        maxLength={5}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
        {selectedEquipmentId && !isLoadingConfig && !isLoadingRecords && (
            <div className="mt-4 flex justify-end">
                <Button variant="destructive" onClick={handleClearMonthData} size="sm" disabled={isSaving || Object.keys(records).length === 0}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                    Effacer Relevés ({selectedEquipmentConfig?.name || 'Mois'})
                </Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}


