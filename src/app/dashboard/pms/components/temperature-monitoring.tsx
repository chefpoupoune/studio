
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

export default function TemperatureMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  const [configuredEquipments, setConfiguredEquipments] = useState<PmsZoneWithTasksDefinition[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | undefined>(undefined);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [temperatureRecords, setTemperatureRecords] = useState<MonthlyTemperatureLog>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const getLocalStorageKeyForRecords = useCallback(() => `pms_temperature_records_v1_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    setIsLoading(true);
    try {
      const pmsSettingsRaw = localStorage.getItem(PMS_CONFIG_STORAGE_KEY);
      if (pmsSettingsRaw) {
        const pmsSettings = JSON.parse(pmsSettingsRaw);
        const equipments = pmsSettings[PMS_TEMPERATURE_MONITORING_KEY] || [];
        setConfiguredEquipments(equipments.map((eq: any) => ({...eq, tasks: eq.tasks || [] }))); // Ensure tasks array exists
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
  }, [selectedYear, selectedMonth, getLocalStorageKeyForRecords, toast, selectedEquipmentId]); // Added selectedEquipmentId dependency

  useEffect(() => {
    if (!isLoading) {
        localStorage.setItem(getLocalStorageKeyForRecords(), JSON.stringify(temperatureRecords));
    }
  }, [temperatureRecords, isLoading, getLocalStorageKeyForRecords]);

  const handleRecordChange = (date: string, equipmentId: string, field: keyof DailyTemperatureRecord, value: string) => {
    const recordKey = `${date}_${equipmentId}`;
    setTemperatureRecords(prev => ({
      ...prev,
      [recordKey]: {
        ...(prev[recordKey] || { temperature: '', time: '', operator: '' }),
        [field]: value,
      }
    }));
  };
  
  const getRecord = (date: string, equipmentId: string): DailyTemperatureRecord => {
    const recordKey = `${date}_${equipmentId}`;
    return temperatureRecords[recordKey] || { temperature: '', time: '', operator: '' };
  };

  const handleClearMonthData = () => {
    if (confirm(`Êtes-vous sûr de vouloir effacer toutes les données de température pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ? Cette action est irréversible.`)) {
      setTemperatureRecords({});
      // Note: This clears all equipment for the month. To clear only selected, logic needs adjustment.
      localStorage.removeItem(getLocalStorageKeyForRecords());
      toast({ title: "Données Effacées", description: `Les données de température pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ont été effacées.` });
    }
  };
  
  const selectedEquipmentData = useMemo(() => {
    return configuredEquipments.find(eq => eq.id === selectedEquipmentId);
  }, [selectedEquipmentId, configuredEquipments]);

  const generatePdfForEquipment = () => {
    if (!selectedEquipmentData) {
      toast({ title: "Aucun Équipement Sélectionné", description: "Veuillez sélectionner un équipement pour générer le PDF.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('pms_temperature_monitoring_monthly'); 
      const doc = new jsPDF('portrait') as jsPDFWithAutoTable; // Portrait might be better
      const monthLabel = monthsArray.find(m => m.value === selectedMonth)?.label || '';
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) {
        doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10;
      }
      if (pdfSettings.logoUrl) {
        doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY); currentY += 5;
      }
      
      const title = `Suivi Température - Équipement: ${selectedEquipmentData.name} - ${monthLabel} ${selectedYear}`;
      doc.setFontSize(16); doc.text(title, 14, currentY); currentY += 8; // Smaller font for longer title
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
      
      const head: any[] = [['Date', 'Jour', 'Température (°C)', 'Heure (HH:mm)', 'Opérateur']];
      
      const body: any[][] = [];
      monthData.forEach(day => {
        const record = getRecord(day.date, selectedEquipmentData.id);
        const rowContent = [
          day.dayOfMonth.toString(),
          day.dayName,
          record.temperature || '-',
          record.time || '-',
          record.operator || '-',
        ];
        if (day.isWeekend) {
           body.push(rowContent.map(cell => ({content: cell, styles: {fillColor: [230,230,230]}})));
        } else {
            body.push(rowContent);
        }
      });

      doc.autoTable({
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { ...headStyles, halign: 'center', fontSize: 10 },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' }, 
          1: { cellWidth: 35 }, 
          2: { cellWidth: 40, halign: 'center' }, 
          3: { cellWidth: 35, halign: 'center' }, 
          4: { cellWidth: 30, halign: 'center' }, 
        },
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
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
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
          Sélectionnez année, mois, puis un équipement pour enregistrer et visualiser les relevés. Les équipements sont configurables dans Paramètres PMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end mb-4">
          <div>
            <Label htmlFor="year-select-temp">Année</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="year-select-temp"><SelectValue placeholder="Année" /></SelectTrigger>
              <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month-select-temp">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="month-select-temp"><SelectValue placeholder="Mois" /></SelectTrigger>
              <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end">
             <Button onClick={generatePdfForEquipment} disabled={isLoading || !selectedEquipmentData || monthData.length === 0 || configuredEquipments.length === 0} className="w-full sm:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF Équipement
            </Button>
            <Button variant="destructive" onClick={handleClearMonthData} disabled={isLoading || Object.keys(temperatureRecords).length === 0} className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" />
                Effacer Mois
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Chargement...</div>
        ) : configuredEquipments.length === 0 ? (
           <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                Aucun équipement de température n'a été configuré.
            </p>
            <p className="text-xs text-muted-foreground/70">
                Veuillez définir des équipements dans "Paramètres" &gt; "Paramètres PMS" (section Suivi des Températures).
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Label className="text-sm font-medium mb-2 block">Sélectionner un Équipement :</Label>
              <div className="flex flex-wrap gap-2">
                {configuredEquipments.map(eq => (
                  <Button
                    key={eq.id}
                    variant={selectedEquipmentId === eq.id ? "default" : "outline"}
                    onClick={() => setSelectedEquipmentId(eq.id)}
                    size="sm"
                  >
                    {eq.name}
                  </Button>
                ))}
              </div>
            </div>

            {!selectedEquipmentId ? (
              <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                  <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                      Veuillez sélectionner un équipement ci-dessus pour afficher le tableau de suivi.
                  </p>
              </div>
            ) : selectedEquipmentData && monthData.length > 0 ? (
              <div className="overflow-x-auto border rounded-md max-h-[70vh]">
                <Table className="min-w-full table-fixed">
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                    <TableRow>
                      <TableHead className="w-[70px] min-w-[70px] text-center px-1">Date</TableHead>
                      <TableHead className="w-[120px] min-w-[120px] px-1">Jour</TableHead>
                      <TableHead className="w-[150px] min-w-[150px] text-center px-1 border-l">Température (°C)</TableHead>
                      <TableHead className="w-[150px] min-w-[150px] text-center px-1 border-l">Heure (HH:mm)</TableHead>
                      <TableHead className="w-[150px] min-w-[150px] text-center px-1 border-l">Opérateur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthData.map((day) => {
                      const record = getRecord(day.date, selectedEquipmentData.id);
                      return (
                        <TableRow key={day.date} className={cn(day.isWeekend && "bg-muted/30")}>
                          <TableCell className="text-center font-medium px-1 align-top py-2">{day.dayOfMonth}</TableCell>
                          <TableCell className="px-1 align-top py-2">{day.dayName}</TableCell>
                          <TableCell className="p-1 align-top border-l">
                            <Input
                              type="text" // text for easier input like "3.5" or "-18"
                              placeholder="Ex: 4.0"
                              value={record.temperature || ''}
                              onChange={(e) => handleRecordChange(day.date, selectedEquipmentData.id, 'temperature', e.target.value)}
                              className="h-8 text-xs text-center"
                              disabled={day.isWeekend}
                            />
                          </TableCell>
                          <TableCell className="p-1 align-top border-l">
                             <Input
                              type="text" // text for HH:mm for now
                              placeholder="Ex: 08:30"
                              value={record.time || ''}
                              onChange={(e) => handleRecordChange(day.date, selectedEquipmentData.id, 'time', e.target.value)}
                              className="h-8 text-xs text-center"
                              disabled={day.isWeekend}
                              pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
                            />
                          </TableCell>
                          <TableCell className="p-1 align-top border-l">
                            <Input
                              type="text"
                              placeholder="Initiales"
                              value={record.operator || ''}
                              onChange={(e) => handleRecordChange(day.date, selectedEquipmentData.id, 'operator', e.target.value)}
                              className="h-8 text-xs text-center"
                              disabled={day.isWeekend}
                              maxLength={15}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Aucune donnée à afficher pour la période ou l'équipement sélectionné.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
