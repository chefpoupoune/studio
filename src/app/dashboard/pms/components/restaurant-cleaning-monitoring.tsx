
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText, Trash2, AlertCircle, ListFilter, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { SimplifiedTaskRecord, SimplifiedMonthlyKitchenCleaningRecord as SimplifiedMonthlyRestaurantCleaningRecord, PmsZoneWithTasksDefinition, PmsZone } from '../types';
import { PMS_RESTAURANT_CLEANING_KEY, PMS_CONFIG_STORAGE_KEY } from '@/app/dashboard/settings/types';
import { NO_STATUS_SELECT_VALUE } from '../types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const currentFullYear = new Date().getFullYear();
const yearsArray = Array.from({ length: 10 }, (_, i) => currentFullYear - 5 + i);
const monthsArray = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentFullYear, i), "MMMM", { locale: fr }),
}));

export default function RestaurantCleaningMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  const [configuredZones, setConfiguredZones] = useState<PmsZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(undefined);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [cleaningRecords, setCleaningRecords] = useState<SimplifiedMonthlyRestaurantCleaningRecord>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const getLocalStorageKeyForRecords = useCallback(() => `pms_restaurant_cleaning_records_v1_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    setIsLoading(true);
    // Load configured zones
    try {
      const pmsSettingsRaw = localStorage.getItem(PMS_CONFIG_STORAGE_KEY);
      if (pmsSettingsRaw) {
        const pmsSettings = JSON.parse(pmsSettingsRaw);
        setConfiguredZones(pmsSettings[PMS_RESTAURANT_CLEANING_KEY] || []);
      } else {
        setConfiguredZones([]);
      }
    } catch (error) {
      console.error("Error loading PMS configurations for restaurant:", error);
      setConfiguredZones([]);
    }

    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthData(getMonthDays(yearNum, monthNum));

    try {
      const storedData = localStorage.getItem(getLocalStorageKeyForRecords());
      if (storedData) {
        setCleaningRecords(JSON.parse(storedData));
      } else {
        setCleaningRecords({});
      }
    } catch (error) {
      console.error("Error loading restaurant cleaning records:", error);
      toast({ title: "Erreur de chargement", description: "Données de nettoyage restaurant corrompues.", variant: "destructive" });
      setCleaningRecords({});
    }
    setIsLoading(false);
  }, [selectedYear, selectedMonth, getLocalStorageKeyForRecords, toast]);

  useEffect(() => {
    if (!isLoading) {
        localStorage.setItem(getLocalStorageKeyForRecords(), JSON.stringify(cleaningRecords));
    }
  }, [cleaningRecords, isLoading, getLocalStorageKeyForRecords]);

  const handleRecordChange = (date: string, zoneId: string, taskId: string, field: keyof SimplifiedTaskRecord, value: string) => {
    const recordKey = `${date}_${zoneId}_${taskId}`;
    setCleaningRecords(prev => ({
      ...prev,
      [recordKey]: {
        ...(prev[recordKey] || { status: '', operator: '', notes: '' }),
        [field]: value,
      }
    }));
  };
  
  const getRecord = (date: string, zoneId: string, taskId: string): SimplifiedTaskRecord => {
    const recordKey = `${date}_${zoneId}_${taskId}`;
    return cleaningRecords[recordKey] || { status: '', operator: '', notes: '' };
  };

  const handleClearMonthData = () => {
    if (confirm(`Êtes-vous sûr de vouloir effacer toutes les données de nettoyage restaurant pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ? Cette action est irréversible.`)) {
      setCleaningRecords({});
      localStorage.removeItem(getLocalStorageKeyForRecords());
      toast({ title: "Données Effacées", description: `Les données de nettoyage restaurant pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ont été effacées.` });
    }
  };

  const generatePdf = () => {
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('pms_restaurant_cleaning_monthly'); // Assuming a new key for specific settings
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
      
      const title = `Suivi Nettoyage Restaurant - ${monthLabel} ${selectedYear}`;
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

      const head: any[] = [['Date', 'Jour', 'Zone', 'Tâche', 'Statut', 'Opérateur', 'Notes']];
      
      const body: any[][] = [];
      monthData.forEach(day => {
        configuredZones.forEach(zone => {
          if (zone.criteria.length === 0 && !day.isWeekend) { // Show zone even if no tasks, unless weekend
            body.push([
              day.dayOfMonth.toString(), day.dayName, zone.name, 
              {content: "Aucune tâche définie", colSpan: 4, styles: {fontStyle: 'italic', textColor: [150,150,150]}}
            ]);
          }
          zone.criteria.forEach(task => {
            const record = getRecord(day.date, zone.id, task.id);
            let statusDisplay = '';
            switch (record.status) {
              case 'fait': statusDisplay = 'Fait'; break;
              case 'non_fait': statusDisplay = 'Non Fait'; break;
              case 'na': statusDisplay = 'N/A'; break;
              default: statusDisplay = '-';
            }
            const row = [
              day.isWeekend ? {content: day.dayOfMonth.toString(), styles: {fillColor: [230,230,230]}} : day.dayOfMonth.toString(),
              day.isWeekend ? {content: day.dayName, styles: {fillColor: [230,230,230]}} : day.dayName,
              day.isWeekend ? {content: zone.name, styles: {fillColor: [230,230,230]}} : zone.name,
              day.isWeekend ? {content: task.name, styles: {fillColor: [230,230,230]}} : task.name,
              day.isWeekend ? {content: statusDisplay, styles: {halign: 'center', fillColor: [230,230,230]}} : {content: statusDisplay, styles: {halign: 'center'}},
              day.isWeekend ? {content: record.operator || '-', styles: {halign: 'center', fillColor: [230,230,230]}} : {content: record.operator || '-', styles: {halign: 'center'}},
              day.isWeekend ? {content: record.notes || '-', styles: {fontSize: 7, fillColor: [230,230,230]}} : {content: record.notes || '-', styles: {fontSize: 7}},
            ];
            body.push(row);
          });
        });
      });

      doc.autoTable({
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { ...headStyles, halign: 'center', fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' }, 
            1: { cellWidth: 20 }, 
            2: { cellWidth: 35 }, 
            3: { cellWidth: 50 }, 
            4: { cellWidth: 20, halign: 'center' }, 
            5: { cellWidth: 25, halign: 'center' }, 
            6: { cellWidth: 'auto' }, 
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
            doc.setFontSize(9); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        },
      });
      doc.save(`Suivi_Nettoyage_Restaurant_${monthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Généré", description: "Le PDF du suivi de nettoyage restaurant a été téléchargé." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedZoneData = useMemo(() => {
    return configuredZones.find(zone => zone.id === selectedZoneId);
  }, [selectedZoneId, configuredZones]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary"/>
          Suivi Mensuel du Nettoyage Restaurant
        </CardTitle>
        <CardDescription>
          Sélectionnez une année, un mois, puis une zone pour enregistrer et visualiser le suivi du nettoyage du restaurant. Les zones et tâches sont configurables dans les Paramètres PMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label htmlFor="year-select-resto-cleaning">Année</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="year-select-resto-cleaning"><SelectValue placeholder="Année" /></SelectTrigger>
              <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month-select-resto-cleaning">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="month-select-resto-cleaning"><SelectValue placeholder="Mois" /></SelectTrigger>
              <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="zone-select-resto-cleaning">Zone de Nettoyage Restaurant</Label>
            <Select value={selectedZoneId} onValueChange={setSelectedZoneId} disabled={configuredZones.length === 0}>
              <SelectTrigger id="zone-select-resto-cleaning">
                <SelectValue placeholder={configuredZones.length === 0 ? "Aucune zone configurée" : "Sélectionner une zone"} />
              </SelectTrigger>
              <SelectContent>
                {configuredZones.map(zone => (
                  <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
             <Button onClick={generatePdf} disabled={isLoading || monthData.length === 0 || configuredZones.length === 0} className="w-full sm:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF Global
            </Button>
            <Button variant="destructive" onClick={handleClearMonthData} disabled={isLoading || Object.keys(cleaningRecords).length === 0} className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" />
                Effacer Mois
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Chargement...</div>
        ) : configuredZones.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                Aucune zone de nettoyage restaurant n'a été configurée.
            </p>
            <p className="text-xs text-muted-foreground/70">
                Veuillez définir des zones et leurs tâches dans "Paramètres" &gt; "Paramètres PMS" pour commencer.
            </p>
          </div>
        ) : !selectedZoneId ? (
           <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                Veuillez sélectionner une zone de nettoyage restaurant pour afficher le tableau de suivi.
            </p>
          </div>
        ) : selectedZoneData && monthData.length > 0 ? (
          <div className="overflow-x-auto border rounded-md max-h-[70vh]">
            <Table className="min-w-full table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  <TableHead className="w-[60px] min-w-[60px] text-center px-1">Date</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] px-1">Jour</TableHead>
                  {selectedZoneData.criteria.map(task => (
                    <TableHead key={task.id} className="w-[250px] min-w-[250px] text-center px-1 border-l">
                      {task.name}
                      <div className="grid grid-cols-3 gap-px mt-1 text-xs font-normal text-muted-foreground">
                        <span>Statut</span>
                        <span>Opérateur</span>
                        <span>Notes</span>
                      </div>
                    </TableHead>
                  ))}
                   {selectedZoneData.criteria.length === 0 && (
                     <TableHead className="w-full text-center px-1 border-l">Aucune tâche définie pour cette zone</TableHead>
                   )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthData.map((day) => (
                  <TableRow key={day.date} className={cn(day.isWeekend && "bg-muted/30")}>
                    <TableCell className="text-center font-medium px-1 align-top py-2">{day.dayOfMonth}</TableCell>
                    <TableCell className="px-1 align-top py-2">{day.dayName}</TableCell>
                    {selectedZoneData.criteria.length > 0 ? selectedZoneData.criteria.map(task => {
                      const record = getRecord(day.date, selectedZoneData.id, task.id);
                      return (
                        <TableCell key={task.id} className="p-1 align-top border-l">
                          <div className="grid grid-cols-3 gap-1">
                            <Select
                              value={record.status === '' ? NO_STATUS_SELECT_VALUE : record.status}
                              onValueChange={(valueFromSelect) => {
                                const valueToStore = valueFromSelect === NO_STATUS_SELECT_VALUE ? '' : valueFromSelect as 'fait' | 'non_fait' | 'na';
                                handleRecordChange(day.date, selectedZoneData.id, task.id, 'status', valueToStore);
                              }}
                              disabled={day.isWeekend}
                            >
                              <SelectTrigger className="h-7 text-xs text-foreground/80">
                                <SelectValue placeholder="Statut" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_STATUS_SELECT_VALUE}>-</SelectItem>
                                <SelectItem value="fait">Fait</SelectItem>
                                <SelectItem value="non_fait">Non Fait</SelectItem>
                                <SelectItem value="na">N/A</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="text"
                              placeholder="Op."
                              value={record.operator}
                              onChange={(e) => handleRecordChange(day.date, selectedZoneData.id, task.id, 'operator', e.target.value)}
                              className="h-7 text-xs"
                              disabled={day.isWeekend}
                              maxLength={15}
                            />
                            <Textarea
                              placeholder="Notes"
                              value={record.notes}
                              onChange={(e) => handleRecordChange(day.date, selectedZoneData.id, task.id, 'notes', e.target.value)}
                              className="h-16 text-xs resize-none py-1"
                              disabled={day.isWeekend}
                              maxLength={50}
                            />
                          </div>
                        </TableCell>
                      );
                    }) : (
                       <TableCell className="p-1 align-top border-l text-center text-xs text-muted-foreground italic" colSpan={1}>
                         Aucune tâche à afficher pour cette zone.
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
             {selectedZoneData && selectedZoneData.criteria.length === 0 && (
               <p className="text-xs text-muted-foreground/70 mt-1">
                 La zone "{selectedZoneData.name}" n'a pas de tâches définies. Ajoutez-en via les Paramètres PMS.
               </p>
             )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
