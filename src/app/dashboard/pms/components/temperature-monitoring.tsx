
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
import type { DailyTemperatureRecord, MonthlyTemperatureLog, PmsZoneWithTasksDefinition } from '../types';
import { PMS_TEMPERATURE_MONITORING_KEY, PMS_CONFIG_STORAGE_KEY } from '@/app/dashboard/settings/types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const currentFullYear = new Date().getFullYear();
const yearsArray = Array.from({ length: 10 }, (_, i) => currentFullYear - 5 + i);
const monthsArray = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentFullYear, i), "MMMM", { locale: fr }),
}));

const TEMP_MIN = -1;
const TEMP_MAX = 14;
const temperatureValues = Array.from({ length: TEMP_MAX - TEMP_MIN + 1 }, (_, i) => TEMP_MIN + i);

const TEMP_TARGET_LABEL = "T° Cible : de 7 A 9 °C"; 

const tempZonesDefinition = [
  { label: "ZONE DE REJET (> 9°C)", from: 10, to: TEMP_MAX, color: "bg-red-200 dark:bg-red-800/50", textColor: "text-red-700 dark:text-red-200", pdfColor: [252, 165, 165] },
  { label: "ZONE DE TOLERANCE (7 à 9°C)", from: 7, to: 9, color: "bg-blue-200 dark:bg-blue-800/50", textColor: "text-blue-700 dark:text-blue-200", pdfColor: [191, 219, 254] },
  { label: "ZONE DE T° CIBLE (< 7°C)", from: TEMP_MIN, to: 6, color: "bg-green-200 dark:bg-green-800/50", textColor: "text-green-700 dark:text-green-200", pdfColor: [167, 243, 208] },
].sort((a, b) => b.from - a.from);

const tempZonesWithRowSpan = tempZonesDefinition.map(zone => ({
  ...zone,
  rowSpan: zone.to - zone.from + 1,
}));


export default function TemperatureMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  const [configuredEquipments, setConfiguredEquipments] = useState<PmsZoneWithTasksDefinition[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | undefined>(undefined);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [temperatureRecords, setTemperatureRecords] = useState<MonthlyTemperatureLog>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const getLocalStorageKeyForRecords = useCallback(() => `pms_temperature_records_grid_v1_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    setIsLoading(true);
    try {
      const pmsSettingsRaw = localStorage.getItem(PMS_CONFIG_STORAGE_KEY);
      if (pmsSettingsRaw) {
        const pmsSettings = JSON.parse(pmsSettingsRaw);
        const equipments = pmsSettings[PMS_TEMPERATURE_MONITORING_KEY] || [];
        setConfiguredEquipments(equipments.map((eq: any) => ({...eq, tasks: eq.tasks || [] })));
        if (!selectedEquipmentId && equipments.length > 0) {
          setSelectedEquipmentId(equipments[0].id);
        } else if (selectedEquipmentId && !equipments.find((eq: any) => eq.id === selectedEquipmentId)) {
          setSelectedEquipmentId(equipments.length > 0 ? equipments[0].id : undefined);
        }
      } else {
        setConfiguredEquipments([]);
        setSelectedEquipmentId(undefined);
      }
    } catch (error) {
      console.error("Error loading PMS configurations for temperature:", error);
      setConfiguredEquipments([]);
      setSelectedEquipmentId(undefined);
    }

    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthData(getMonthDays(yearNum, monthNum));

    try {
      const storedData = localStorage.getItem(getLocalStorageKeyForRecords());
      if (storedData) {
        setTemperatureRecords(JSON.parse(storedData));
      } else {
        setTemperatureRecords({});
      }
    } catch (error) {
      console.error("Error loading temperature records:", error);
      toast({ title: "Erreur de chargement", description: "Données de température corrompues.", variant: "destructive" });
      setTemperatureRecords({});
    }
    setIsLoading(false);
  }, [selectedYear, selectedMonth, getLocalStorageKeyForRecords, toast, selectedEquipmentId]);

  useEffect(() => {
    if (!isLoading) {
        localStorage.setItem(getLocalStorageKeyForRecords(), JSON.stringify(temperatureRecords));
    }
  }, [temperatureRecords, isLoading, getLocalStorageKeyForRecords]);

  const handleTempCellClick = (dateStr: string, equipmentId: string, tempValue: number) => {
    const recordKey = `${dateStr}_${equipmentId}`;
    setTemperatureRecords(prev => {
      const currentRecord = prev[recordKey] || { time: '', operator: '' };
      const newMarkedValue = currentRecord.markedTemperatureValue === tempValue ? undefined : tempValue;
      let newTime = currentRecord.time;

      if (newMarkedValue !== undefined) { // Temperature is being marked
        newTime = format(new Date(), 'HH:mm');
      } else { // Temperature is being unmarked
        newTime = ''; 
      }

      return {
        ...prev,
        [recordKey]: {
          ...currentRecord,
          markedTemperatureValue: newMarkedValue,
          time: newTime, // Automatically set/clear time
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

  const handleClearMonthData = () => {
    if (confirm(`Êtes-vous sûr de vouloir effacer toutes les données de température pour cet équipement pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ? Cette action est irréversible.`)) {
      const newRecords = { ...temperatureRecords };
      monthData.forEach(day => {
        if (selectedEquipmentId) {
          delete newRecords[`${day.date}_${selectedEquipmentId}`];
        }
      });
      setTemperatureRecords(newRecords);
      toast({ title: "Données Effacées", description: `Les données de température pour l'équipement sélectionné pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ont été effacées.` });
    }
  };
  
  const selectedEquipmentData = useMemo(() => {
    return configuredEquipments.find(eq => eq.id === selectedEquipmentId);
  }, [selectedEquipmentId, configuredEquipments]);

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
      doc.setFontSize(12); doc.text(TEMP_TARGET_LABEL, 14, currentY); currentY += 6;
      doc.setFontSize(10); doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY); currentY += 8;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number] } = {};
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) headStyles.fillColor = primaryColorRgb;
        headStyles.textColor = [255,255,255]; 
      }
      
      const head: any[] = [
        [
          { content: 'Zone', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', minCellWidth: 20 } },
          { content: 'T°C', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fontStyle: 'bold', minCellWidth: 15 } },
          ...monthData.map(day => ({ content: `${day.dayOfMonth}\n${day.dayName.substring(0,3)}`, styles: { halign: 'center', fontSize: 7, cellWidth: 7 } }))
        ]
      ];
      head.push(monthData.map(() => '')); 

      const body: any[][] = [];
      temperatureValues.slice().reverse().forEach(tempVal => {
        const row: any[] = [];
        const zoneForThisTemp = tempZonesWithRowSpan.find(z => tempVal <= z.to && tempVal >= z.from);
        
        if (zoneForThisTemp && tempVal === zoneForThisTemp.to) {
            row.push({ 
                content: zoneForThisTemp.label, 
                rowSpan: zoneForThisTemp.rowSpan, 
                styles: { 
                    valign: 'middle', 
                    halign: 'center', 
                    fontStyle: 'bold', 
                    fontSize: 8, 
                    fillColor: zoneForThisTemp.pdfColor,
                } 
            });
        } else if (!zoneForThisTemp && tempZonesWithRowSpan.every(z => tempVal > z.to || tempVal < z.from)) {
          // This cell is covered by a previous rowSpan or is outside defined zones
        }

        row.push({ content: `${tempVal}°C`, styles: { halign: 'center', fontSize: 8 } });

        monthData.forEach(day => {
          const record = getRecord(day.date, selectedEquipmentData.id);
          row.push({
            content: record.markedTemperatureValue === tempVal ? 'X' : '',
            styles: { halign: 'center', fontSize: 8, cellPadding: 0.5 }
          });
        });
        body.push(row);
      });
      
      const timeRow: any[] = [{content: 'Heure Relevé', colSpan: 2, styles: {fontStyle: 'bold', fontSize: 8, halign: 'right'}}];
      monthData.forEach(day => {
        const record = getRecord(day.date, selectedEquipmentData.id);
        timeRow.push({content: record.time || '-', styles: {halign: 'center', fontSize: 8}});
      });
      body.push(timeRow);

      const operatorRow: any[] = [{content: 'Opérateur', colSpan: 2, styles: {fontStyle: 'bold', fontSize: 8, halign: 'right'}}];
      monthData.forEach(day => {
        const record = getRecord(day.date, selectedEquipmentData.id);
        operatorRow.push({content: record.operator || '-', styles: {halign: 'center', fontSize: 8}});
      });
      body.push(operatorRow);

      doc.autoTable({
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { ...headStyles, halign: 'center', fontSize: 8, cellPadding: 1, fillColor: [200,200,200], textColor: [0,0,0] },
        styles: { fontSize: 8, cellPadding: 1 },
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
          {TEMP_TARGET_LABEL}. Sélectionnez un équipement pour enregistrer ou visualiser les relevés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end mb-4">
          <div><Label htmlFor="year-select-temp">Année</Label><Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger id="year-select-temp"><SelectValue /></SelectTrigger><SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select></div>
          <div><Label htmlFor="month-select-temp">Mois</Label><Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger id="month-select-temp"><SelectValue /></SelectTrigger><SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end">
            <Button onClick={generatePdfForEquipment} disabled={isLoading || !selectedEquipmentData || monthData.length === 0 || configuredEquipments.length === 0} className="w-full sm:w-auto">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              PDF Équipement
            </Button>
            <Button variant="destructive" onClick={handleClearMonthData} disabled={isLoading || !selectedEquipmentId || Object.keys(temperatureRecords).filter(k => k.endsWith(`_${selectedEquipmentId}`)).length === 0} className="w-full sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" /> Effacer Mois (Équip.)
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Chargement...</div>
        ) : configuredEquipments.length === 0 ? (
           <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Aucun équipement configuré. Veuillez les définir dans "Paramètres PMS".</p>
          </div>
        ) : (
          <>
            <div className="mb-4"><Label className="text-sm font-medium mb-2 block">Sélectionner un Équipement :</Label><div className="flex flex-wrap gap-2">{configuredEquipments.map(eq => (<Button key={eq.id} variant={selectedEquipmentId === eq.id ? "default" : "outline"} onClick={() => setSelectedEquipmentId(eq.id)} size="sm">{eq.name}</Button>))}</div></div>
            {!selectedEquipmentId ? (<div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg"><ListFilter className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">Sélectionnez un équipement.</p></div>
            ) : selectedEquipmentData && monthData.length > 0 ? (
              <div className="overflow-x-auto border rounded-md">
                <Table className="min-w-full table-fixed">
                  <TableHeader className="sticky top-0 z-30 bg-card shadow-sm">
                    <TableRow className="h-8">
                      <TableHead className="w-12 sm:w-16 sticky left-0 z-20 bg-card border-r text-center text-xs p-1 align-middle">Zone</TableHead>
                      <TableHead className="w-12 sm:w-16 sticky left-12 sm:left-16 z-20 bg-card border-r text-center text-xs p-1 align-middle">T°C</TableHead>
                      {monthData.map(day => (<TableHead key={day.date} className={cn("text-center text-[9px] sm:text-xs p-0.5 sm:p-1 w-6 sm:w-7 h-8", day.isWeekend && "bg-muted/50")}>{day.dayOfMonth}<br/>{day.dayName.substring(0,3)}</TableHead>))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {temperatureValues.slice().reverse().map((tempValue) => {
                      const zoneStartingThisRow = tempZonesWithRowSpan.find(z => z.to === tempValue);
                      return (
                        <TableRow key={tempValue} className="h-5 hover:bg-muted/20">
                          {zoneStartingThisRow ? (
                            <TableCell
                              rowSpan={zoneStartingThisRow.rowSpan}
                              className={cn(zoneStartingThisRow.color, zoneStartingThisRow.textColor, "font-semibold align-middle text-center text-[9px] p-0 sticky left-0 z-10 border-r w-12 sm:w-16")}
                            >
                              <div className="h-full flex items-center justify-center overflow-hidden" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>
                                {zoneStartingThisRow.label}
                              </div>
                            </TableCell>
                          ) : (tempZonesWithRowSpan.find(z => tempValue < z.to && tempValue >= z.from)) ? null : (
                             <TableCell className="sticky left-0 z-10 border-r bg-card p-0"></TableCell>
                          ) }
                          <TableCell className="font-mono text-[9px] sm:text-xs text-center border-r sticky left-12 sm:left-16 z-10 bg-card p-0.5 sm:p-1">{tempValue}°C</TableCell>
                          {monthData.map((day) => {
                            const record = getRecord(day.date, selectedEquipmentData.id);
                            const isMarked = record.markedTemperatureValue === tempValue;
                            return (
                              <TableCell
                                key={day.date}
                                className={cn("text-center p-0 h-5 w-6 sm:w-7 cursor-pointer hover:bg-primary/20", day.isWeekend && "bg-muted/40 cursor-not-allowed", isMarked && "bg-primary text-primary-foreground")}
                                onClick={() => !day.isWeekend && handleTempCellClick(day.date, selectedEquipmentData.id, tempValue)}
                              >
                                {isMarked ? <span className="font-bold text-sm leading-none">X</span> : ""}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                    {/* Row for Heure */}
                    <TableRow className="bg-card/80 sticky bottom-10 sm:bottom-5 z-10 h-7">
                        <TableCell colSpan={2} className="text-right font-semibold text-[10px] sm:text-xs sticky left-0 z-20 bg-card p-0.5 border-t">Heure Relevé</TableCell>
                        {monthData.map(day => (
                            <TableCell key={`time-${day.date}`} className="p-0.5 border-t">
                                <Input type="text" placeholder="HH:mm" defaultValue={getRecord(day.date, selectedEquipmentData.id).time} 
                                       onBlur={(e) => handleTimeOperatorChange(day.date, selectedEquipmentData.id, 'time', e.target.value)}
                                       className="h-5 text-[9px] sm:text-xs text-center p-0.5" disabled={day.isWeekend} pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]" />
                            </TableCell>
                        ))}
                    </TableRow>
                    {/* Row for Opérateur */}
                    <TableRow className="bg-card/80 sticky bottom-0 z-10 h-7">
                        <TableCell colSpan={2} className="text-right font-semibold text-[10px] sm:text-xs sticky left-0 z-20 bg-card p-0.5 border-t">Opérateur</TableCell>
                        {monthData.map(day => (
                            <TableCell key={`op-${day.date}`} className="p-0.5 border-t">
                                <Input type="text" placeholder="Initiales" defaultValue={getRecord(day.date, selectedEquipmentData.id).operator} 
                                       onBlur={(e) => handleTimeOperatorChange(day.date, selectedEquipmentData.id, 'operator', e.target.value)}
                                       className="h-5 text-[9px] sm:text-xs text-center p-0.5" disabled={day.isWeekend} maxLength={10}/>
                            </TableCell>
                        ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg"><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">Aucune donnée à afficher.</p></div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

