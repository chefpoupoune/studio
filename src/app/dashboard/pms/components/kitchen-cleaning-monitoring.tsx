
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { SimplifiedTaskRecord, SimplifiedMonthlyKitchenCleaningRecord, PmsZoneWithTasksDefinition } from '../types';
import { NO_STATUS_SELECT_VALUE } from '../types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';

const currentFullYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentFullYear - 5 + i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentFullYear, i), "MMMM", { locale: fr }),
}));

// PREDEFINED_KITCHEN_ZONES_WITH_TASKS will eventually come from settings
const PREDEFINED_KITCHEN_ZONES_WITH_TASKS: PmsZoneWithTasksDefinition[] = [
  {
    id: 'zone_plans_travail', name: 'Plans de Travail',
    tasks: [
      { id: 'pt_net_des', name: 'Nettoyage et désinfection' },
      { id: 'pt_rangement', name: 'Rangement' },
    ]
  },
  {
    id: 'zone_sols', name: 'Sols',
    tasks: [
      { id: 'sols_balayage', name: 'Balayage' },
      { id: 'sols_lavage', name: 'Lavage' },
    ]
  },
  {
    id: 'zone_equip_cuisson', name: 'Équipements de Cuisson',
    tasks: [
      { id: 'ec_deg_hottes', name: 'Dégraissage hottes' },
      { id: 'ec_net_fours', name: 'Nettoyage fours/plaques' },
    ]
  },
  {
    id: 'zone_equip_froids', name: 'Équipements Froids (Ext.)',
    tasks: [
      { id: 'ef_net_portes', name: 'Nettoyage portes/poignées' },
      { id: 'ef_verif_joints', name: 'Vérification joints' },
    ]
  },
  {
    id: 'zone_plonge', name: 'Plonge',
    tasks: [
      { id: 'pl_net_eviers', name: 'Nettoyage éviers/robinetterie' },
      { id: 'pl_det_machine', name: 'Détartrage machine' },
    ]
  },
  {
    id: 'zone_poubelles', name: 'Poubelles & Local',
    tasks: [
      { id: 'pb_vidage_net', name: 'Vidage et nettoyage' },
      { id: 'pb_net_local', name: 'Nettoyage local' },
    ]
  },
];

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function KitchenCleaningMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [cleaningRecords, setCleaningRecords] = useState<SimplifiedMonthlyKitchenCleaningRecord>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getLocalStorageKey = useCallback(() => `pms_kitchen_cleaning_v2_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    setIsLoading(true);
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthData(getMonthDays(yearNum, monthNum));

    try {
      const storedData = localStorage.getItem(getLocalStorageKey());
      if (storedData) {
        setCleaningRecords(JSON.parse(storedData));
      } else {
        setCleaningRecords({});
      }
    } catch (error) {
      console.error("Error loading cleaning records:", error);
      toast({ title: "Erreur de chargement", description: "Données de nettoyage corrompues.", variant: "destructive" });
      setCleaningRecords({});
    }
    setIsLoading(false);
  }, [selectedYear, selectedMonth, getLocalStorageKey, toast]);

  useEffect(() => {
    if (!isLoading) {
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(cleaningRecords));
    }
  }, [cleaningRecords, isLoading, getLocalStorageKey]);

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
    if (confirm(`Êtes-vous sûr de vouloir effacer toutes les données de nettoyage pour ${months[parseInt(selectedMonth)].label} ${selectedYear} ? Cette action est irréversible.`)) {
      setCleaningRecords({});
      localStorage.removeItem(getLocalStorageKey());
      toast({ title: "Données Effacées", description: `Les données de nettoyage pour ${months[parseInt(selectedMonth)].label} ${selectedYear} ont été effacées.` });
    }
  };

  const generatePdf = () => {
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('pms_kitchen_cleaning_monthly');
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) {
        doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10;
      }
      if (pdfSettings.logoUrl) {
        doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY); currentY += 5;
      }
      
      const title = `Suivi Nettoyage Cuisine - ${monthLabel} ${selectedYear}`;
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
        PREDEFINED_KITCHEN_ZONES_WITH_TASKS.forEach(zone => {
          zone.tasks.forEach(task => {
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
            0: { cellWidth: 15, halign: 'center' }, // Date
            1: { cellWidth: 20 }, // Jour
            2: { cellWidth: 35 }, // Zone
            3: { cellWidth: 50 }, // Tâche
            4: { cellWidth: 20, halign: 'center' }, // Statut
            5: { cellWidth: 25, halign: 'center' }, // Opérateur
            6: { cellWidth: 'auto' }, // Notes (take remaining space)
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
            doc.setFontSize(9); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        },
      });
      doc.save(`Suivi_Nettoyage_Cuisine_${monthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Généré", description: "Le PDF du suivi de nettoyage a été téléchargé." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Suivi Mensuel du Nettoyage Cuisine
        </CardTitle>
        <CardDescription>
          Sélectionnez un mois et une année pour enregistrer et visualiser le suivi du nettoyage par tâche et par zone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <Label htmlFor="year-select-cleaning">Année</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="year-select-cleaning"><SelectValue placeholder="Année" /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month-select-cleaning">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="month-select-cleaning"><SelectValue placeholder="Mois" /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
             <Button onClick={generatePdf} disabled={isLoading || monthData.length === 0} className="w-full sm:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF
            </Button>
            <Button variant="destructive" onClick={handleClearMonthData} disabled={isLoading || Object.keys(cleaningRecords).length === 0} className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" />
                Effacer Mois
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Chargement...</div>
        ) : monthData.length > 0 ? (
          <div className="overflow-x-auto border rounded-md max-h-[70vh]">
            <Table className="min-w-full table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  <TableHead className="w-[60px] min-w-[60px] text-center px-1">Date</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] px-1">Jour</TableHead>
                  {PREDEFINED_KITCHEN_ZONES_WITH_TASKS.map(zone => (
                    <TableHead key={zone.id} className="w-[300px] min-w-[300px] text-center px-1">{zone.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthData.map((day) => (
                  <TableRow key={day.date} className={cn(day.isWeekend && "bg-muted/30")}>
                    <TableCell className="text-center font-medium px-1">{day.dayOfMonth}</TableCell>
                    <TableCell className="px-1">{day.dayName}</TableCell>
                    {PREDEFINED_KITCHEN_ZONES_WITH_TASKS.map(zone => {
                      return (
                        <TableCell key={zone.id} className="p-1 space-y-1.5 align-top">
                          {zone.tasks.map(task => {
                            const record = getRecord(day.date, zone.id, task.id);
                            return (
                              <div key={task.id} className="p-1.5 border rounded bg-background/50 shadow-sm">
                                <p className="text-xs font-medium mb-1 truncate" title={task.name}>{task.name}</p>
                                <div className="space-y-1">
                                  <Select
                                    value={record.status === '' ? NO_STATUS_SELECT_VALUE : record.status}
                                    onValueChange={(valueFromSelect) => {
                                      const valueToStore = valueFromSelect === NO_STATUS_SELECT_VALUE ? '' : valueFromSelect as 'fait' | 'non_fait' | 'na';
                                      handleRecordChange(day.date, zone.id, task.id, 'status', valueToStore);
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
                                    onChange={(e) => handleRecordChange(day.date, zone.id, task.id, 'operator', e.target.value)}
                                    className="h-7 text-xs"
                                    disabled={day.isWeekend}
                                    maxLength={15}
                                  />
                                  <Textarea
                                    placeholder="Notes"
                                    value={record.notes}
                                    onChange={(e) => handleRecordChange(day.date, zone.id, task.id, 'notes', e.target.value)}
                                    className="h-12 text-xs resize-none py-1"
                                    disabled={day.isWeekend}
                                    maxLength={50}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Aucune donnée à afficher pour la période sélectionnée.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
