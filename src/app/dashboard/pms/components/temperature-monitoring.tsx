
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText, Trash2, AlertCircle, ListFilter, Thermometer as ThermometerIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { DailyTemperatureRecord, MonthlyTemperatureLog, PmsZone as PmsEquipmentDefinition, PmsConfigurations } from '../types';
import { PMS_TEMPERATURE_MONITORING_KEY } from '@/app/dashboard/settings/types';
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

interface TempZoneStyle {
  label: string;
  type: 'target' | 'tolerance1' | 'tolerance2' | 'rejection';
  color: string;
  textColor: string;
  pdfColor: [number, number, number];
  values: number[];
}

const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

// --- CONFIGURABLE TABLE PARAMETERS ---
// Heights in pixels
const ROW_HEIGHT_TEMP_PX = 8; // Height for temperature rows
const ROW_HEIGHT_INPUT_PX = 10; // Height for Heure/Opérateur input rows

// Font sizes in pixels
const FONT_SIZE_TEMP_VALUES_PX = 7; // For T°C values in the second column
const FONT_SIZE_X_MARK_PX = 7;      // For 'X' marks in the cells
const FONT_SIZE_DAY_HEADER_PX = 6;  // For day headers (1 L, 2 M, etc.)
const FONT_SIZE_INPUT_FIELDS_PX = 7;// For Heure/Opérateur inputs
const FONT_SIZE_ZONE_LABEL_PX = 6;  // For vertical zone labels

// Column widths in pixels (approximate for Tailwind mapping)
const COL_WIDTH_ZONE_PX = 12;             // For the "Zone" column (e.g., w-3)
const COL_WIDTH_TEMP_VALUE_PX = 10;       // For the "T°C" value column (e.g., w-2.5)
const COL_WIDTH_DAY_PX = 8;               // For each day column (e.g., w-2)
// --- END CONFIGURABLE TABLE PARAMETERS ---

// Helper to convert pixel values to Tailwind height/width classes (approximate)
// Tailwind's spacing scale is based on 0.25rem (4px). So h-1 is 4px, h-1.5 is 6px, h-2 is 8px etc.
const pxToTailwindHeight = (px: number) => `h-[${px}px]`;
const pxToTailwindWidth = (px: number) => `w-[${px}px]`;


export default function TemperatureMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  const [configuredEquipments, setConfiguredEquipments] = useState<PmsEquipmentDefinition[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | undefined>(undefined);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [temperatureRecords, setTemperatureRecords] = useState<MonthlyTemperatureLog>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoggedInUsername(localStorage.getItem(LOGGED_IN_USERNAME_KEY));
    }
  }, []);

  const getFirestoreRecordsDocId = useCallback(() => `temp_records_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  const selectedEquipmentData = useMemo(() => {
    return configuredEquipments.find(eq => eq.id === selectedEquipmentId);
  }, [selectedEquipmentId, configuredEquipments]);

 const { temperatureValues, dynamicTempZones, targetLabel } = useMemo(() => {
    const equipmentType = selectedEquipmentData?.equipmentType || 'refrigerator';
    let minDisplayTemp = -5, maxDisplayTemp = 15; 
    if (equipmentType === 'freezer') {
      minDisplayTemp = -25; maxDisplayTemp = 0; 
    } else {
      if (selectedEquipmentData?.targetTempMin !== undefined) minDisplayTemp = Math.min(minDisplayTemp, selectedEquipmentData.targetTempMin - 2);
      if (selectedEquipmentData?.targetTempMax !== undefined) maxDisplayTemp = Math.max(maxDisplayTemp, selectedEquipmentData.targetTempMax + 2);
      if (selectedEquipmentData?.tolerance1TempMin !== undefined) minDisplayTemp = Math.min(minDisplayTemp, selectedEquipmentData.tolerance1TempMin -1);
      if (selectedEquipmentData?.tolerance1TempMax !== undefined) maxDisplayTemp = Math.max(maxDisplayTemp, selectedEquipmentData.tolerance1TempMax + 1);
      if (selectedEquipmentData?.tolerance2TempMin !== undefined) minDisplayTemp = Math.min(minDisplayTemp, selectedEquipmentData.tolerance2TempMin-1);
      if (selectedEquipmentData?.tolerance2TempMax !== undefined) maxDisplayTemp = Math.max(maxDisplayTemp, selectedEquipmentData.tolerance2TempMax + 1);
      minDisplayTemp = Math.max(minDisplayTemp, -30); 
      maxDisplayTemp = Math.min(maxDisplayTemp, 30);  
      if(maxDisplayTemp <= minDisplayTemp) { 
          maxDisplayTemp = minDisplayTemp + 20;
      }
    }

    const allDisplayTemps = Array.from({ length: Math.max(1, maxDisplayTemp - minDisplayTemp + 1) }, (_, i) => minDisplayTemp + i);
    
    let labelParts: string[] = [];
    const zones: TempZoneStyle[] = [];

    const { targetTempMin, targetTempMax, tolerance1TempMin, tolerance1TempMax, tolerance2TempMin, tolerance2TempMax } = selectedEquipmentData || {};

    const effTargetMin = targetTempMin ?? (equipmentType === 'freezer' ? -22 : 0);
    const effTargetMax = targetTempMax ?? (equipmentType === 'freezer' ? -18 : 4);
    labelParts.push(`Cible: ${effTargetMin}°C à ${effTargetMax}°C`);

    const tol1Defined = tolerance1TempMin !== undefined && tolerance1TempMax !== undefined;
    if (tol1Defined) {
      labelParts.push(`Tol.1: ${tolerance1TempMin}°C à ${tolerance1TempMax}°C`);
    }
    const tol2Defined = tolerance2TempMin !== undefined && tolerance2TempMax !== undefined;
    if (tol2Defined) {
      labelParts.push(`Tol.2: ${tolerance2TempMin}°C à ${tolerance2TempMax}°C`);
    }
    const finalTargetLabel = labelParts.join(' / ');
    
    const categorizedTemps = new Map<number, 'target' | 'tolerance1' | 'tolerance2' | 'rejection'>();

    for (const temp of allDisplayTemps) {
      if (temp >= effTargetMin && temp <= effTargetMax) {
        categorizedTemps.set(temp, 'target');
      } else if (tol1Defined && temp >= tolerance1TempMin! && temp <= tolerance1TempMax!) {
        categorizedTemps.set(temp, 'tolerance1');
      } else if (tol2Defined && temp >= tolerance2TempMin! && temp <= tolerance2TempMax!) {
        categorizedTemps.set(temp, 'tolerance2');
      } else {
        categorizedTemps.set(temp, 'rejection');
      }
    }

    let currentZoneType: 'target' | 'tolerance1' | 'tolerance2' | 'rejection' | null = null;
    let currentZoneTemps: number[] = [];

    for (const temp of allDisplayTemps) {
      const typeForThisTemp = categorizedTemps.get(temp)!;
      if (currentZoneType !== typeForThisTemp && currentZoneTemps.length > 0) {
        let zoneLabel = "", color = "", textColor = "", pdfC: [number,number,number] = [200,200,200];
        if(currentZoneType === 'target') { zoneLabel="ZONE CIBLE"; color="bg-green-100 dark:bg-green-900/50"; textColor="text-green-700 dark:text-green-300"; pdfC = [187, 247, 208];}
        else if(currentZoneType === 'tolerance1') { zoneLabel="TOLERANCE 1"; color="bg-blue-100 dark:bg-blue-900/50"; textColor="text-blue-700 dark:text-blue-300"; pdfC = [191, 219, 254];}
        else if(currentZoneType === 'tolerance2') { zoneLabel="TOLERANCE 2"; color="bg-yellow-100 dark:bg-yellow-800/50"; textColor="text-yellow-700 dark:text-yellow-300"; pdfC = [254, 249, 195];}
        else if(currentZoneType === 'rejection') { zoneLabel="ZONE REJET"; color="bg-red-100 dark:bg-red-900/50"; textColor="text-red-700 dark:text-red-300"; pdfC = [254, 202, 202];}
        zones.push({ label: zoneLabel, type: currentZoneType!, color, textColor, pdfColor: pdfC, values: [...currentZoneTemps] });
        currentZoneTemps = [];
      }
      currentZoneType = typeForThisTemp;
      currentZoneTemps.push(temp);
    }
     if (currentZoneType && currentZoneTemps.length > 0) {
        let zoneLabel = "", color = "", textColor = "", pdfC: [number,number,number] = [200,200,200];
        if(currentZoneType === 'target') { zoneLabel="ZONE CIBLE"; color="bg-green-100 dark:bg-green-900/50"; textColor="text-green-700 dark:text-green-300"; pdfC = [187, 247, 208];}
        else if(currentZoneType === 'tolerance1') { zoneLabel="TOLERANCE 1"; color="bg-blue-100 dark:bg-blue-900/50"; textColor="text-blue-700 dark:text-blue-300"; pdfC = [191, 219, 254];}
        else if(currentZoneType === 'tolerance2') { zoneLabel="TOLERANCE 2"; color="bg-yellow-100 dark:bg-yellow-800/50"; textColor="text-yellow-700 dark:text-yellow-300"; pdfC = [254, 249, 195];}
        else if(currentZoneType === 'rejection') { zoneLabel="ZONE REJET"; color="bg-red-100 dark:bg-red-900/50"; textColor="text-red-700 dark:text-red-300"; pdfC = [254, 202, 202];}
        zones.push({ label: zoneLabel, type: currentZoneType, color, textColor, pdfColor: pdfC, values: [...currentZoneTemps] });
    }
    
    zones.sort((a, b) => Math.min(...b.values) - Math.min(...a.values)); 

    return { temperatureValues: allDisplayTemps, dynamicTempZones: zones, targetLabel: finalTargetLabel };
  }, [selectedEquipmentData]);

  const loadDataForPeriod = useCallback(async () => {
    setIsLoading(true);
    
    let currentSelectedEquipmentId = selectedEquipmentId;

    const pmsSettingsDocRef = doc(firestore, "pmsConfigurations", "mainConfig");
    try {
      const pmsSettingsSnap = await getDoc(pmsSettingsDocRef);
      if (pmsSettingsSnap.exists()) {
        const pmsSettings = pmsSettingsSnap.data() as PmsConfigurations;
        const equipmentsFromFS = pmsSettings[PMS_TEMPERATURE_MONITORING_KEY] || [];
        setConfiguredEquipments(equipmentsFromFS);
        
        if (equipmentsFromFS.length > 0) {
          const currentSelectionIsValid = currentSelectedEquipmentId ? equipmentsFromFS.some(eq => eq.id === currentSelectedEquipmentId) : false;
          if (!currentSelectionIsValid) {
            currentSelectedEquipmentId = equipmentsFromFS[0].id;
          }
        } else {
          currentSelectedEquipmentId = undefined;
        }
      } else {
        setConfiguredEquipments([]);
        currentSelectedEquipmentId = undefined;
        toast({ title: "Configuration Manquante", description: "Aucune configuration PMS pour le suivi des températures trouvée.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error loading PMS configurations in loadDataForPeriod (Temperature):", error);
      toast({ title: "Erreur Chargement Config (Température)", variant: "destructive" });
      setConfiguredEquipments([]);
      currentSelectedEquipmentId = undefined;
    }
    
    if (currentSelectedEquipmentId !== selectedEquipmentId) {
        setSelectedEquipmentId(currentSelectedEquipmentId); 
    }
    
    const equipmentToLoadRecordsFor = currentSelectedEquipmentId;

    if (!equipmentToLoadRecordsFor) {
      setTemperatureRecords({});
    } else {
      const recordsDocId = `temp_records_${selectedYear}_${selectedMonth}`;
      const recordsDocRef = doc(firestore, "pmsTemperatureRecords", recordsDocId);
      try {
        const recordsSnap = await getDoc(recordsDocRef);
        if (recordsSnap.exists()) {
          setTemperatureRecords(recordsSnap.data() as MonthlyTemperatureLog);
        } else {
          setTemperatureRecords({});
        }
      } catch (error) {
        console.error("Error loading temperature records in loadDataForPeriod:", error);
        setTemperatureRecords({});
      }
    }
    
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthData(getMonthDays(yearNum, monthNum));

    setIsLoading(false);
  }, [selectedYear, selectedMonth, selectedEquipmentId, toast]);

  useEffect(() => {
    loadDataForPeriod();
  }, [loadDataForPeriod]);

  useEffect(() => {
    const handleConfigUpdate = () => {
      loadDataForPeriod();
    };
    window.addEventListener('pmsConfigUpdated', handleConfigUpdate);
    return () => window.removeEventListener('pmsConfigUpdated', handleConfigUpdate);
  }, [loadDataForPeriod]);

  useEffect(() => {
    if (isLoading || isSaving || Object.keys(temperatureRecords).length === 0 && !doc(firestore, "pmsTemperatureRecords", getFirestoreRecordsDocId())) { 
      return;
    }
    
    const saveRecordsToFirestore = async () => {
      setIsSaving(true);
      const docId = `temp_records_${selectedYear}_${selectedMonth}`;
      const docRef = doc(firestore, "pmsTemperatureRecords", docId);
      try {
        await setDoc(docRef, temperatureRecords);
      } catch (error) {
        console.error("Error saving temperature records to Firestore:", error);
        toast({ title: "Erreur de Sauvegarde (Températures)", variant: "destructive" });
      }
      setIsSaving(false);
    };

    const timeoutId = setTimeout(saveRecordsToFirestore, 2000);
    return () => clearTimeout(timeoutId);

  }, [temperatureRecords, isLoading, isSaving, selectedYear, selectedMonth, toast, getFirestoreRecordsDocId]);


 const handleTempCellClick = (dateStr: string, equipmentId: string, tempValue: number) => {
    const recordKey = `${dateStr}_${equipmentId}`;
    setTemperatureRecords(prev => {
      const currentRecord = prev[recordKey] || { time: '', operator: '' };
      const newMarkedValue = currentRecord.markedTemperatureValue === tempValue ? undefined : tempValue;
      let newTime = currentRecord.time;
      let newOperator = currentRecord.operator;

      if (newMarkedValue !== undefined ) { 
        if (!currentRecord.time || currentRecord.markedTemperatureValue === undefined ) { 
            newTime = format(new Date(), 'HH:mm');
        }
        if (!currentRecord.operator || currentRecord.markedTemperatureValue === undefined) { 
           newOperator = loggedInUsername || '';
        }
      } else if (newMarkedValue === undefined && currentRecord.markedTemperatureValue === tempValue) { 
        newTime = ''; 
        newOperator = '';
      }

      return {
        ...prev,
        [recordKey]: {
          markedTemperatureValue: newMarkedValue,
          time: newTime,
          operator: newOperator,
        }
      };
    });
  };
  
  const handleTimeOperatorChange = (dateStr: string, equipmentId: string, field: 'time' | 'operator', value: string) => {
    const recordKey = `${dateStr}_${equipmentId}`;
    setTemperatureRecords(prev => ({
      ...prev,
      [recordKey]: {
        ...(prev[recordKey] || { markedTemperatureValue: undefined }),
        [field]: value,
      }
    }));
  };
  
  const getRecord = (date: string, equipmentId: string): DailyTemperatureRecord => {
    const recordKey = `${date}_${equipmentId}`;
    return temperatureRecords[recordKey] || { markedTemperatureValue: undefined, time: '', operator: '' };
  };

  const handleClearMonthData = async () => {
    if (!selectedEquipmentId || !selectedEquipmentData) return;
    if (confirm(`Êtes-vous sûr de vouloir effacer toutes les données de température pour ${selectedEquipmentData?.name} pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ? Cette action est irréversible.`)) {
      setIsSaving(true);
      const docId = `temp_records_${selectedYear}_${selectedMonth}`;
      const docRef = doc(firestore, "pmsTemperatureRecords", docId);
      try {
        const newRecordsForMonth = { ...temperatureRecords };
        Object.keys(newRecordsForMonth).forEach(key => {
          if (key.endsWith(`_${selectedEquipmentId}`)) {
            delete newRecordsForMonth[key];
          }
        });
        
        await setDoc(docRef, newRecordsForMonth); 
        setTemperatureRecords(newRecordsForMonth);
        toast({ title: "Données Effacées", description: `Les données de température pour ${selectedEquipmentData?.name} pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ont été effacées.` });
      } catch (error) {
        console.error("Error clearing month data for temperature equipment:", error);
        toast({ title: "Erreur d'effacement", variant: "destructive"});
      }
      setIsSaving(false);
    }
  };

  const generatePdfForEquipment = () => {
    if (!selectedEquipmentData) {
      toast({ title: "Aucun Équipement Sélectionné", variant: "destructive" });
      return;
    }
    setIsLoading(true); 
    try {
      const pdfSettings = getPdfLayoutSettings('pms_temperature_monitoring_monthly'); 
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const monthLabel = monthsArray.find(m => m.value === selectedMonth)?.label || '';
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) { doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10; }
      if (pdfSettings.logoUrl) { doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY); currentY += 5; }
      
      const title = `Suivi Température - ${selectedEquipmentData.name} - ${monthLabel} ${selectedYear}`;
      doc.setFontSize(16); doc.text(title, 14, currentY); currentY += 6;
      doc.setFontSize(10); doc.text(targetLabel, 14, currentY); currentY += 6;
      doc.setFontSize(10); doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY); currentY += 8;
      
      const head: any[] = [
        [
          { content: 'Zone', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', minCellWidth: 18, cellWidth: 20, fontSize: 6 } },
          { content: 'T°C', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', minCellWidth: 8, cellWidth: 12, fontSize: 6 } },
          ...monthData.map(day => ({ content: `${day.dayOfMonth}\n${day.dayName.substring(0,1)}`, styles: { halign: 'center', fontSize: 5, cellWidth: 6, minCellHeight: 6 } })) 
        ]
      ];
      head.push(monthData.map(() => ({content: '', styles: {minCellHeight: 1.5}})));


      const body: any[][] = [];
      dynamicTempZones.forEach(zone => {
        zone.values.slice().reverse().forEach((tempVal, indexInZoneValues) => { 
          const row: any[] = [];
          if (indexInZoneValues === 0) { 
             row.push({ 
                content: zone.label, 
                rowSpan: zone.values.length, 
                styles: { 
                    valign: 'middle', 
                    halign: 'center', 
                    fontStyle: 'bold', 
                    fontSize: 5,
                    fillColor: zone.pdfColor,
                    cellWidth: 20,
                } 
            });
          }
          row.push({ content: `${tempVal}°C`, styles: { halign: 'center', fontSize: 6, cellPadding: 0.2, cellWidth: 12 } });
          monthData.forEach(day => {
            const record = getRecord(day.date, selectedEquipmentData.id);
            row.push({
              content: record.markedTemperatureValue === tempVal ? 'X' : '',
              styles: { halign: 'center', fontSize: 6, cellPadding: 0.2, cellWidth: 6, fillColor: day.isWeekend ? [230,230,230] : undefined } 
            });
          });
          body.push(row);
        });
      });
      
      const timeRow: any[] = [{content: 'Heure', colSpan: 2, styles: {fontStyle: 'bold', fontSize: 6, halign: 'right', cellPadding: 0.2, cellWidth: 32}}];
      monthData.forEach(day => {
        const record = getRecord(day.date, selectedEquipmentData.id);
        timeRow.push({content: record.time || '-', styles: {halign: 'center', fontSize: 6, cellPadding: 0.2, cellWidth: 6, fillColor: day.isWeekend ? [230,230,230] : undefined}});
      });
      body.push(timeRow);

      const operatorRow: any[] = [{content: 'Opérateur', colSpan: 2, styles: {fontStyle: 'bold', fontSize: 6, halign: 'right', cellPadding: 0.2, cellWidth: 32}}];
      monthData.forEach(day => {
        const record = getRecord(day.date, selectedEquipmentData.id);
        operatorRow.push({content: record.operator || '-', styles: {halign: 'center', fontSize: 6, cellPadding: 0.2, cellWidth: 6, fillColor: day.isWeekend ? [230,230,230] : undefined}});
      });
      body.push(operatorRow);

      const primaryColorForPdf = hexToRgb(pdfSettings.primaryColor || "#DCDCDC") || [220,220,220];
      doc.autoTable({
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { halign: 'center', fontSize: 6, cellPadding: 0.5, fillColor: primaryColorForPdf, textColor: [0,0,0] },
        styles: { fontSize: 6, cellPadding: 0.2, minCellHeight: 4 }, 
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
            doc.setFontSize(9); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        },
      });
      doc.save(`Suivi_Temperature_${selectedEquipmentData.name.replace(/\s+/g, '_')}_${monthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Équipement Généré", description: `Le PDF pour "${selectedEquipmentData.name}" a été téléchargé.` });
    } catch (error) {
      console.error("Error generating PDF for equipment:", error);
      toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${error instanceof Error ? error.message : String(error)}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThermometerIcon className="w-6 h-6 text-primary"/>
          Suivi Mensuel des Températures par Équipement
        </CardTitle>
        <CardDescription>
         {targetLabel}. Sélectionnez un équipement pour enregistrer ou visualiser les relevés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 items-end mb-2">
          <div><Label htmlFor="year-select-temp" className="text-xs">Année</Label><Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger id="year-select-temp" className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()} className="text-xs">{y}</SelectItem>)}</SelectContent></Select></div>
          <div><Label htmlFor="month-select-temp" className="text-xs">Mois</Label><Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger id="month-select-temp" className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex flex-col sm:flex-row gap-1.5 md:col-span-1 md:justify-self-end">
            <Button onClick={generatePdfForEquipment} size="sm" disabled={isLoading || isSaving || !selectedEquipmentData || monthData.length === 0 || configuredEquipments.length === 0} className="w-full sm:w-auto text-xs h-8">
              {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
              PDF
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearMonthData} disabled={isLoading || isSaving || !selectedEquipmentId || Object.keys(temperatureRecords).filter(k => k.endsWith(`_${selectedEquipmentId}`)).length === 0} className="w-full sm:w-auto text-xs h-8">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eff. Mois
            </Button>
          </div>
        </div>
        
        {isLoading && configuredEquipments.length === 0 ? (
          <div className="flex justify-center items-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /> Chargement...</div>
        ) : configuredEquipments.length === 0 ? (
           <div className="text-center py-6 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-1 text-sm text-muted-foreground">Aucun équipement configuré. Veuillez les définir dans "Paramètres PMS".</p>
          </div>
        ) : (
          <>
            <div className="mb-2"><Label className="text-xs font-medium mb-1 block">Sélectionner un Équipement :</Label><div className="flex flex-wrap gap-1">{configuredEquipments.map(eq => (<Button key={eq.id} variant={selectedEquipmentId === eq.id ? "default" : "outline"} onClick={() => setSelectedEquipmentId(eq.id)} size="sm" className="text-xs px-2 py-0.5 h-7">{eq.name}</Button>))}</div></div>
            {isLoading && selectedEquipmentId ? ( 
                 <div className="flex justify-center items-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /> Chargement des relevés pour "{selectedEquipmentData?.name}"...</div>
            ) : !selectedEquipmentId ? (<div className="text-center py-6 border-2 border-dashed border-muted-foreground/30 rounded-lg"><ListFilter className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-1 text-sm text-muted-foreground">Sélectionnez un équipement.</p></div>
            ) : selectedEquipmentData && monthData.length > 0 ? (
              <div className="overflow-x-auto border rounded-md">
                <Table className="min-w-full table-fixed text-[6px] leading-none">
                  <TableHeader className="sticky top-0 z-30 bg-card shadow-sm">
                    <TableRow className={cn("h-auto", pxToTailwindHeight(ROW_HEIGHT_INPUT_PX * 1.5))}>
                      <TableHead className={cn("sticky left-0 z-20 bg-card border-r text-center p-0 align-middle leading-tight", pxToTailwindWidth(COL_WIDTH_ZONE_PX))} style={{fontSize: `${FONT_SIZE_ZONE_LABEL_PX}px`}}>Zone</TableHead>
                      <TableHead className={cn("sticky left-[var(--col-zone-width)] z-20 bg-card border-r text-center p-0 align-middle leading-tight", pxToTailwindWidth(COL_WIDTH_TEMP_VALUE_PX))} style={{fontSize: `${FONT_SIZE_TEMP_VALUES_PX}px`}}>t°</TableHead>
                      {monthData.map(day => (<TableHead key={day.date} className={cn("text-center p-0 h-auto leading-tight", pxToTailwindWidth(COL_WIDTH_DAY_PX), day.isWeekend && "bg-muted/30")} style={{fontSize: `${FONT_SIZE_DAY_HEADER_PX}px`}}>{day.dayOfMonth}<br/>{day.dayName.substring(0,1)}</TableHead>))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dynamicTempZones.map(zone => 
                       zone.values.slice().reverse().map((tempValue, indexInZone) => ( 
                         <TableRow key={`${zone.type}-${tempValue}`} className={cn("h-auto", pxToTailwindHeight(ROW_HEIGHT_TEMP_PX))}>
                            {indexInZone === 0 ? (
                                <TableCell
                                  rowSpan={zone.values.length}
                                  className={cn(zone.color, zone.textColor, "font-semibold align-middle text-center p-0 sticky left-0 z-10 border-r leading-tight", pxToTailwindWidth(COL_WIDTH_ZONE_PX))}
                                  style={{padding: '0px'}}
                                >
                                <div className="h-full flex items-center justify-center overflow-hidden" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: `${FONT_SIZE_ZONE_LABEL_PX}px`}}>
                                    {zone.label}
                                </div>
                                </TableCell>
                            ) : null}
                            <TableCell className={cn("font-mono text-center border-r sticky left-[var(--col-zone-width)] z-10 bg-card p-0 leading-tight", pxToTailwindWidth(COL_WIDTH_TEMP_VALUE_PX))} style={{fontSize:`${FONT_SIZE_TEMP_VALUES_PX}px`, padding:'0px'}}>
                                {tempValue}°
                            </TableCell>
                            {monthData.map((day) => {
                                const record = getRecord(day.date, selectedEquipmentData.id);
                                const isMarked = record.markedTemperatureValue === tempValue;
                                return (
                                <TableCell
                                    key={day.date}
                                    className={cn("text-center p-0 h-auto w-auto cursor-pointer hover:bg-primary/10 leading-tight", pxToTailwindWidth(COL_WIDTH_DAY_PX), pxToTailwindHeight(ROW_HEIGHT_TEMP_PX), day.isWeekend && "bg-muted/25", isMarked && "bg-primary text-primary-foreground")}
                                    style={{padding: '0px'}}
                                    onClick={() => !day.isWeekend && handleTempCellClick(day.date, selectedEquipmentData.id, tempValue)}
                                >
                                    {isMarked ? <span className="font-bold align-middle" style={{fontSize: `${FONT_SIZE_X_MARK_PX}px`}}>X</span> : ""}
                                </TableCell>
                                );
                            })}
                         </TableRow>
                       ))
                    )}
                    <TableRow className={cn("bg-card/90 sticky bottom-[var(--row-input-height)] z-20 h-auto", pxToTailwindHeight(ROW_HEIGHT_INPUT_PX))}>
                        <TableCell colSpan={2} className="text-right font-semibold sticky left-0 z-30 bg-card p-0 pr-0.5 border-t leading-tight" style={{fontSize: `${FONT_SIZE_INPUT_FIELDS_PX}px`}}>Heure</TableCell>
                        {monthData.map(day => (
                            <TableCell key={`time-${day.date}`} className={cn("p-0 border-t h-auto", pxToTailwindWidth(COL_WIDTH_DAY_PX), pxToTailwindHeight(ROW_HEIGHT_INPUT_PX), day.isWeekend && "bg-muted/25")}>
                                <Input type="text" placeholder="HH:mm" defaultValue={getRecord(day.date, selectedEquipmentData.id).time} 
                                       onBlur={(e) => handleTimeOperatorChange(day.date, selectedEquipmentData.id, 'time', e.target.value)}
                                       className={cn("h-full text-center p-0 border-0 rounded-none focus-visible:ring-1 focus-visible:ring-ring bg-transparent w-full leading-tight")} pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]" style={{height: '100%', fontSize: `${FONT_SIZE_INPUT_FIELDS_PX}px`, padding: '0px'}} disabled={day.isWeekend || isSaving}/>
                            </TableCell>
                        ))}
                    </TableRow>
                    <TableRow className={cn("bg-card/90 sticky bottom-0 z-20 h-auto", pxToTailwindHeight(ROW_HEIGHT_INPUT_PX))}>
                        <TableCell colSpan={2} className="text-right font-semibold sticky left-0 z-30 bg-card p-0 pr-0.5 border-t leading-tight" style={{fontSize: `${FONT_SIZE_INPUT_FIELDS_PX}px`}}>Opérateur</TableCell>
                        {monthData.map(day => (
                            <TableCell key={`op-${day.date}`} className={cn("p-0 border-t h-auto", pxToTailwindWidth(COL_WIDTH_DAY_PX), pxToTailwindHeight(ROW_HEIGHT_INPUT_PX), day.isWeekend && "bg-muted/25")}>
                                <Input type="text" placeholder="Op." defaultValue={getRecord(day.date, selectedEquipmentData.id).operator} 
                                       onBlur={(e) => handleTimeOperatorChange(day.date, selectedEquipmentData.id, 'operator', e.target.value)}
                                       className={cn("h-full text-center p-0 border-0 rounded-none focus-visible:ring-1 focus-visible:ring-ring bg-transparent w-full leading-tight")} maxLength={10} style={{height: '100%', fontSize: `${FONT_SIZE_INPUT_FIELDS_PX}px`, padding: '0px'}} disabled={day.isWeekend || isSaving}/>
                            </TableCell>
                        ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-muted-foreground/30 rounded-lg"><AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-1 text-sm text-muted-foreground">Aucune donnée à afficher.</p></div>
            )}
          </>
        )}
      </CardContent>
      <style jsx global>{`
        :root {
          --col-zone-width: ${COL_WIDTH_ZONE_PX}px;
          --row-input-height: ${ROW_HEIGHT_INPUT_PX}px;
        }
      `}</style>
    </Card>
  );
}

    
    
