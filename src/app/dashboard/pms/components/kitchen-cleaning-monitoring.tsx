
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
import type { SimplifiedDailyZoneRecord, SimplifiedMonthlyKitchenCleaningRecord } from '../types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';

const currentFullYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentFullYear - 5 + i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentFullYear, i), "MMMM", { locale: fr }),
}));

// Pour cette étape, les zones sont prédéfinies.
// Elles seront dynamiques plus tard grâce aux paramètres.
const PREDEFINED_KITCHEN_ZONES = [
  { id: 'zone_plans_travail', name: 'Plans de Travail' },
  { id: 'zone_sols', name: 'Sols' },
  { id: 'zone_equip_cuisson', name: 'Équipements de Cuisson' },
  { id: 'zone_equip_froids', name: 'Équipements Froids (Ext.)' },
  { id: 'zone_plonge', name: 'Plonge' },
  { id: 'zone_poubelles', name: 'Poubelles & Local' },
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

  const getLocalStorageKey = useCallback(() => `pms_kitchen_cleaning_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

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
    if (!isLoading) { // Avoid saving while initially loading
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(cleaningRecords));
    }
  }, [cleaningRecords, isLoading, getLocalStorageKey]);

  const handleRecordChange = (date: string, zoneId: string, field: keyof SimplifiedDailyZoneRecord, value: string) => {
    const recordKey = `${date}_${zoneId}`;
    setCleaningRecords(prev => ({
      ...prev,
      [recordKey]: {
        ...(prev[recordKey] || { status: '', operator: '', notes: '' }),
        [field]: value,
      }
    }));
  };
  
  const getRecord = (date: string, zoneId: string): SimplifiedDailyZoneRecord => {
    const recordKey = `${date}_${zoneId}`;
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
      const pdfSettings = getPdfLayoutSettings('pms_kitchen_cleaning_monthly'); // New specific key
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

      const head: any[] = [['Date', 'Jour']];
      PREDEFINED_KITCHEN_ZONES.forEach(zone => {
        head[0].push({ content: zone.name, colSpan: 3, styles: { halign: 'center' } });
      });
      const subHead: any[] = [['', '']];
       PREDEFINED_KITCHEN_ZONES.forEach(() => {
        subHead[0].push({content: 'Statut', styles: {halign: 'center'}});
        subHead[0].push({content: 'Opérateur', styles: {halign: 'center'}});
        subHead[0].push({content: 'Notes', styles: {halign: 'center', cellWidth: 50}}); // Wider notes
      });
      
      const body = monthData.map(day => {
        const row: any[] = [day.dayOfMonth, day.dayName];
        PREDEFINED_KITCHEN_ZONES.forEach(zone => {
          const record = getRecord(day.date, zone.id);
          let statusDisplay = '';
          switch (record.status) {
            case 'fait': statusDisplay = 'Fait'; break;
            case 'non_fait': statusDisplay = 'Non Fait'; break;
            case 'na': statusDisplay = 'N/A'; break;
            default: statusDisplay = '-';
          }
          row.push({content: statusDisplay, styles: {halign: 'center'}});
          row.push({content: record.operator || '-', styles: {halign: 'center'}});
          row.push({content: record.notes || '-', styles: { fontSize: 7 }}); // Smaller font for notes
        });
        return row;
      });

      doc.autoTable({
        startY: currentY,
        head: head,
        body: [subHead[0], ...body], // Add subHead as the first row of the body for styling
        theme: 'grid',
        headStyles: { ...headStyles, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 1.5 },
        didDrawCell: (data) => {
            // Color weekend rows, skip for main header and subheader
            if (data.section === 'body' && data.row.index > 0) { // data.row.index 0 is the subHead now
                const dayIndex = data.row.index -1; // Adjust index because subHead is now row 0 of body
                if (dayIndex < monthData.length && monthData[dayIndex].isWeekend) {
                    doc.setFillColor(230, 230, 230); // Light gray for weekends
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                }
            }
            // If it's the subheader row
            if (data.section === 'body' && data.row.index === 0) {
                 doc.setFillColor(240, 240, 240); // Very light gray for subheader
                 doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            }
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
          Sélectionnez un mois et une année pour enregistrer et visualiser le suivi du nettoyage.
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
            <Table className="min-w-full">
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  <TableHead className="w-[50px] min-w-[50px] text-center">Date</TableHead>
                  <TableHead className="w-[100px] min-w-[100px]">Jour</TableHead>
                  {PREDEFINED_KITCHEN_ZONES.map(zone => (
                    <TableHead key={zone.id} className="min-w-[250px] text-center">{zone.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthData.map((day) => (
                  <TableRow key={day.date} className={cn(day.isWeekend && "bg-muted/30")}>
                    <TableCell className="text-center font-medium">{day.dayOfMonth}</TableCell>
                    <TableCell>{day.dayName}</TableCell>
                    {PREDEFINED_KITCHEN_ZONES.map(zone => {
                      const record = getRecord(day.date, zone.id);
                      return (
                        <TableCell key={zone.id} className="p-2 space-y-1 align-top">
                          <Select
                            value={record.status}
                            onValueChange={(value) => handleRecordChange(day.date, zone.id, 'status', value)}
                            disabled={day.isWeekend}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Statut" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">-</SelectItem>
                              <SelectItem value="fait">Fait</SelectItem>
                              <SelectItem value="non_fait">Non Fait</SelectItem>
                              <SelectItem value="na">N/A</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="text"
                            placeholder="Opérateur"
                            value={record.operator}
                            onChange={(e) => handleRecordChange(day.date, zone.id, 'operator', e.target.value)}
                            className="h-8 text-xs"
                            disabled={day.isWeekend}
                          />
                          <Textarea
                            placeholder="Notes"
                            value={record.notes}
                            onChange={(e) => handleRecordChange(day.date, zone.id, 'notes', e.target.value)}
                            className="h-16 text-xs resize-none"
                            disabled={day.isWeekend}
                          />
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
