
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Loader2, Trash2, Users } from 'lucide-react'; // Added Users
import { format, getDaysInMonth, getDate, getDay, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { BenefitEmployee, BenefitDailyStatusCode, FullMonthlyBenefitData, DailyBenefitEntry } from '../types';
import { BENEFIT_STATUS_CODES, BENEFIT_STATUS_LEGEND, frenchShortDays } from '../types';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentYear, i), "MMMM", { locale: fr }),
}));

// DUMMY_EMPLOYEES constant removed.
// The component will need a way to get employee data in the future.
// For now, the table will render no employee rows.
const employeesToRender: BenefitEmployee[] = [];


const SELECT_EMPTY_VALUE_PLACEHOLDER = "_SELECT_EMPTY_"; // Unique value for SelectItem empty state

export default function BenefitTrackingTable() {
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [benefitData, setBenefitData] = useState<FullMonthlyBenefitData>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getLocalStorageKey = useCallback(
    () => `benefits_tracking_${selectedYear}_${selectedMonth}`,
    [selectedYear, selectedMonth]
  );

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedData = localStorage.getItem(getLocalStorageKey());
      if (storedData) {
        setBenefitData(JSON.parse(storedData));
      } else {
        setBenefitData({});
      }
    } catch (error) {
      console.error("Error loading benefit data:", error);
      setBenefitData({});
      toast({ title: "Erreur de chargement", description: "Données d'avantages corrompues.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [selectedYear, selectedMonth, getLocalStorageKey, toast]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(benefitData));
    }
  }, [benefitData, isLoading, getLocalStorageKey]);

  const daysInSelectedMonth = useMemo(() => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const numDays = getDaysInMonth(new Date(year, month));
    return Array.from({ length: numDays }, (_, i) => {
      const date = new Date(year, month, i + 1);
      return {
        dayNumber: i + 1,
        dayLetter: frenchShortDays[getDay(date)],
        isWeekend: getDay(date) === 0 || getDay(date) === 6, // 0 for Sunday, 6 for Saturday
      };
    });
  }, [selectedYear, selectedMonth]);

  const handleStatusChange = (
    employeeId: string,
    dayNumber: number,
    type: 'planning' | 'repasPris',
    valueFromSelect: string // This value can be SELECT_EMPTY_VALUE_PLACEHOLDER or a BenefitDailyStatusCode
  ) => {
    const actualValueToStore = valueFromSelect === SELECT_EMPTY_VALUE_PLACEHOLDER ? "" : valueFromSelect as BenefitDailyStatusCode;
    const dateKey = `${selectedYear}-${(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-${dayNumber.toString().padStart(2, '0')}`;
    setBenefitData(prev => {
      const employeeData = prev[employeeId] || {};
      const dayEntry = employeeData[dateKey] || { planning: "", repasPris: "" };
      return {
        ...prev,
        [employeeId]: {
          ...employeeData,
          [dateKey]: { ...dayEntry, [type]: actualValueToStore },
        },
      };
    });
  };

  const calculateTotal = (employeeId: string, type: 'planning' | 'repasPris'): number => {
    const employeeEntries = benefitData[employeeId];
    if (!employeeEntries) return 0;
    return Object.values(employeeEntries).reduce((sum, entry) => sum + (entry[type] === "X" ? 1 : 0), 0);
  };

  const handleClearMonthData = () => {
    if (confirm(`Êtes-vous sûr de vouloir effacer toutes les données pour ${months[parseInt(selectedMonth)].label} ${selectedYear} ? Cette action est irréversible.`)) {
      setBenefitData({});
      toast({ title: "Données Effacées", description: `Les données pour ${months[parseInt(selectedMonth)].label} ${selectedYear} ont été effacées.` });
    }
  };

  const generatePdf = () => {
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('benefits');
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) { doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10; }
      if (pdfSettings.logoUrl) { doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY); currentY += 5; }
      
      const title = `Suivi Avantages en Nature - ${monthLabel} ${selectedYear}`;
      doc.setFontSize(18); doc.text(title, 14, currentY); currentY += 8;
      doc.setFontSize(10); doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY); currentY += 7;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontStyle?: string } = { fontStyle: 'bold' };
      if (pdfSettings.primaryColor) {
        const primaryRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryRgb) {
          headStyles.fillColor = primaryRgb;
          const brightness = (primaryRgb[0] * 299 + primaryRgb[1] * 587 + primaryRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      const head: any = [
        [{ content: 'Employé', rowSpan: 2, styles: { ...headStyles, valign: 'middle'} }, { content: 'Type', rowSpan: 2, styles: { ...headStyles, valign: 'middle'} }],
        [] // Second header row for day letters
      ];
      
      daysInSelectedMonth.forEach(day => {
        (head[0] as any[]).push({ content: day.dayNumber.toString(), styles: { ...headStyles, halign: 'center' } });
        (head[1] as any[]).push({ content: day.dayLetter, styles: { ...headStyles, halign: 'center', fontSize: 8, fillColor: day.isWeekend ? [200, 220, 255] : undefined } });
      });
      (head[0] as any[]).push({ content: 'TOTAL', rowSpan: 2, styles: { ...headStyles, valign: 'middle'} });


      const body = employeesToRender.flatMap(employee => { // Use employeesToRender which is currently empty
        const planningRow: any[] = [{ content: employee.name, rowSpan: 2, styles: { valign: 'middle', fontStyle: 'bold'} }, 'Planning'];
        const repasPrisRow: any[] = ['Repas Pris'];

        daysInSelectedMonth.forEach(day => {
          const dateKey = `${selectedYear}-${(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-${day.dayNumber.toString().padStart(2, '0')}`;
          const entry = benefitData[employee.id]?.[dateKey] || { planning: "", repasPris: "" };
          
          const cellStyle = { halign: 'center', fontSize: 8, fillColor: day.isWeekend ? [229, 231, 235] : (entry.planning === "X" ? [209,250,229] : undefined) };
          const cellStyleRepas = { halign: 'center', fontSize: 8, fillColor: day.isWeekend ? [229, 231, 235] : (entry.repasPris === "X" ? [209,250,229] : undefined) };

          planningRow.push({ content: entry.planning, styles: cellStyle });
          repasPrisRow.push({ content: entry.repasPris, styles: cellStyleRepas });
        });
        planningRow.push({ content: calculateTotal(employee.id, 'planning'), styles: { halign: 'center', fontStyle: 'bold'} });
        repasPrisRow.push({ content: calculateTotal(employee.id, 'repasPris'), styles: { halign: 'center', fontStyle: 'bold'} });
        return [planningRow, repasPrisRow];
      });

      doc.autoTable({
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
            doc.setFontSize(9); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        },
      });

      doc.save(`Avantages_Nature_${monthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Généré", description: "Le fichier PDF a été téléchargé." });

    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
        <div>
          <Label htmlFor="year-select-benefits">Année</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger id="year-select-benefits"><SelectValue placeholder="Année" /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="month-select-benefits">Mois</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger id="month-select-benefits"><SelectValue placeholder="Mois" /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end pt-2">
            <Button onClick={generatePdf} disabled={isLoading || employeesToRender.length === 0} className="w-full sm:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF
            </Button>
             <Button variant="destructive" onClick={handleClearMonthData} disabled={isLoading || Object.keys(benefitData).length === 0} className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" />
                Effacer Données Mois
            </Button>
        </div>
      </div>

      <div className="my-4 p-3 border rounded-md bg-muted/50">
        <p className="font-semibold text-sm mb-2">Légende :</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {BENEFIT_STATUS_LEGEND.map(item => (
            <span key={item.code}><b>{item.code || "Vide"}</b>: {item.label}</span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Chargement des données...</span>
        </div>
      ) : employeesToRender.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                Aucun employé à afficher. Veuillez ajouter des employés pour commencer le suivi.
            </p>
            <p className="text-xs text-muted-foreground/70">
                (Fonctionnalité de gestion des employés à venir)
            </p>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-md shadow-sm">
          <Table className="min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px] min-w-[180px] sticky left-0 z-10 bg-card">Employé</TableHead>
                <TableHead className="w-[100px] min-w-[100px] sticky left-[180px] z-10 bg-card">Type</TableHead>
                {daysInSelectedMonth.map(day => (
                  <TableHead key={`header-num-${day.dayNumber}`} className={cn("w-[50px] min-w-[50px] text-center p-1 text-xs", day.isWeekend && "bg-blue-100 dark:bg-blue-800/30")}>
                    {day.dayNumber}
                  </TableHead>
                ))}
                <TableHead className="w-[70px] min-w-[70px] text-center sticky right-0 z-10 bg-card">TOTAL</TableHead>
              </TableRow>
              <TableRow className="sticky top-10 z-10 bg-card">
                <TableHead className="sticky left-0 z-10 bg-card"></TableHead>
                <TableHead className="sticky left-[180px] z-10 bg-card"></TableHead>
                {daysInSelectedMonth.map(day => (
                  <TableHead key={`header-letter-${day.dayNumber}`} className={cn("text-center p-1 text-xs font-semibold", day.isWeekend && "bg-blue-100 dark:bg-blue-800/30")}>
                    {day.dayLetter}
                  </TableHead>
                ))}
                <TableHead className="sticky right-0 z-10 bg-card"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesToRender.map(employee => (
                <React.Fragment key={employee.id}>
                  {(['planning', 'repasPris'] as const).map((type, typeIndex) => {
                    const dayRow = daysInSelectedMonth.map(day => {
                      const dateKey = `${selectedYear}-${(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-${day.dayNumber.toString().padStart(2, '0')}`;
                      const entry = benefitData[employee.id]?.[dateKey] || { planning: "", repasPris: "" };
                      const cellValue = entry[type];
                      return (
                        <TableCell key={`${employee.id}-${day.dayNumber}-${type}`} className={cn("p-0.5 text-center", day.isWeekend && "bg-blue-100 dark:bg-blue-800/20")}>
                          <Select
                            value={cellValue === "" ? SELECT_EMPTY_VALUE_PLACEHOLDER : cellValue}
                            onValueChange={(value) => handleStatusChange(employee.id, day.dayNumber, type, value)}
                          >
                            <SelectTrigger className={cn("h-7 text-xs min-w-[45px] p-1 justify-center", cellValue === "X" && "bg-green-100 dark:bg-green-800/30")}>
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              {BENEFIT_STATUS_CODES.map(code => (
                                <SelectItem 
                                  key={code === "" ? SELECT_EMPTY_VALUE_PLACEHOLDER : code} 
                                  value={code === "" ? SELECT_EMPTY_VALUE_PLACEHOLDER : code} 
                                  className="text-xs"
                                >
                                  {code === "" ? "-" : code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      );
                    });

                    return (
                      <TableRow key={`${employee.id}-${type}`} className={typeIndex === 0 ? "border-t-2 border-primary/50" : ""}>
                        {typeIndex === 0 && (
                          <TableCell rowSpan={2} className="font-medium align-middle sticky left-0 z-10 bg-card/90 backdrop-blur-sm">
                            {employee.name}
                          </TableCell>
                        )}
                        <TableCell className="text-xs sticky left-[180px] z-10 bg-card/90 backdrop-blur-sm">
                          {type === 'planning' ? 'Planning' : 'Repas Pris'}
                        </TableCell>
                        {dayRow}
                        <TableCell className="text-center font-bold sticky right-0 z-10 bg-card/90 backdrop-blur-sm">
                          {calculateTotal(employee.id, type)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
    