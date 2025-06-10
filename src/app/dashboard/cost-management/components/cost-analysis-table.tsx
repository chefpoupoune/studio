
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, FileText, Loader2, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getDaysInMonth as dfnsGetDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { CostEntry, DailyCoefficientEntry } from '../types';
import { months, years, currentYear } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getMonthDays, DayData } from '@/app/dashboard/pms/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const initialSupplierRow = (): Omit<CostEntry, 'id'> => ({
  fournisseur: '', ht: 0, tva: 0, avoir: 0,
});

const initialDailyCoefficientEntry = (day: number): DailyCoefficientEntry => ({
  day, imp: "", saj: "", ime: "", esat: "", repasPlus: "", nous: "", pn: "", pnEsat: ""
});


export default function CostAnalysisTable() {
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  
  const [costData, setCostData] = useState<CostEntry[]>([]); 
  const [dailyCoeffData, setDailyCoeffData] = useState<DailyCoefficientEntry[]>([]); 
  
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getLocalStorageKeySuppliers = useCallback(() => `cost_analysis_suppliers_v11_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);
  const getLocalStorageKeyDailyCoeffs = useCallback(() => `cost_analysis_daily_coeffs_v11_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedSuppliers = localStorage.getItem(getLocalStorageKeySuppliers());
      const parsedSuppliers = storedSuppliers ? JSON.parse(storedSuppliers) : [initialSupplierRow() as CostEntry];
      setCostData(parsedSuppliers.length > 0 ? parsedSuppliers.map((s: any, index: number) => ({...initialSupplierRow(), ...s, id: s.id || `supplier_${Date.now()}_${index}`})) : [{...initialSupplierRow(), id: `supplier_init_${Date.now()}`}]);

      const storedDailyCoeffs = localStorage.getItem(getLocalStorageKeyDailyCoeffs());
      const daysInMonth = dfnsGetDaysInMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth)));
      
      if (storedDailyCoeffs) {
        const parsedCoeffs: DailyCoefficientEntry[] = JSON.parse(storedDailyCoeffs);
        if (parsedCoeffs.length === daysInMonth && parsedCoeffs.every((entry, i) => entry.day === i + 1)) {
          setDailyCoeffData(parsedCoeffs);
        } else {
          setDailyCoeffData(Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1)));
        }
      } else {
        setDailyCoeffData(Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1)));
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      setCostData([{ ...initialSupplierRow(), id: `supplier_err_${Date.now()}` }]);
      const daysInMonth = dfnsGetDaysInMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth)));
      setDailyCoeffData(Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1)));
      toast({ title: "Erreur de chargement", description: "Données locales corrompues, réinitialisation.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [selectedMonth, selectedYear, getLocalStorageKeySuppliers, getLocalStorageKeyDailyCoeffs, toast]);

  useEffect(() => {
    if (!isLoading && costData.length > 0) {
      localStorage.setItem(getLocalStorageKeySuppliers(), JSON.stringify(costData));
    } else if (!isLoading && costData.length === 0) {
       localStorage.removeItem(getLocalStorageKeySuppliers()); 
    }
  }, [costData, getLocalStorageKeySuppliers, isLoading]);

  useEffect(() => {
    if (!isLoading && dailyCoeffData.length > 0) {
      localStorage.setItem(getLocalStorageKeyDailyCoeffs(), JSON.stringify(dailyCoeffData));
    }
  }, [dailyCoeffData, getLocalStorageKeyDailyCoeffs, isLoading]);

  const handleSupplierInputChange = (rowIndex: number, fieldName: keyof Omit<CostEntry, 'id'>, value: string | number) => {
    setCostData(prevData =>
      prevData.map((row, index) => {
        if (index === rowIndex) {
          let processedValue = typeof (initialSupplierRow() as any)[fieldName] === 'number'
            ? parseFloat(value as string) || 0
            : value;
          return { ...row, [fieldName]: processedValue };
        }
        return row;
      })
    );
  };
  
  const handleDailyCoeffInputChange = (dayIndex: number, fieldName: keyof Omit<DailyCoefficientEntry, 'day'>, value: string) => {
    const numericValue = value === "" ? "" : parseFloat(value); 
    if (value === "" || (!isNaN(numericValue as number) && (numericValue as number) >= 0)) {
        setDailyCoeffData(prevData =>
            prevData.map((entry, index) => {
                if (index === dayIndex) {
                    return { ...entry, [fieldName]: numericValue };
                }
                return entry;
            })
        );
    }
  };

  const handleAddSupplierRow = () => {
    setCostData(prevData => [...prevData, { ...initialSupplierRow(), id: `supplier_${Date.now()}` }]);
  };

  const handleDeleteSupplierRow = (rowId: string) => {
    if (costData.length <= 1) { 
        toast({ title: "Action impossible", description: "Au moins une ligne fournisseur doit être conservée.", variant: "default" });
        return;
    }
    setCostData(prevData => prevData.filter(row => row.id !== rowId));
    toast({ title: "Ligne Fournisseur Supprimée" });
  };

  const supplierTotals = useMemo(() => {
    let totalHt = 0, totalTva = 0, totalAvoir = 0;
    costData.forEach(row => {
      totalHt += Number(row.ht) || 0;
      totalTva += Number(row.tva) || 0;
      totalAvoir += Number(row.avoir) || 0;
    });
    return { totalHt, totalTva, totalAvoir };
  }, [costData]);

  const dailyCoeffTotals = useMemo(() => {
    const totals: { [K in keyof Omit<DailyCoefficientEntry, 'day'>]: number } & { totalCoeffJour: number[], totalPnJour: number[], totalGlobalJour: number[] } = {
      imp: 0, saj: 0, ime: 0, esat: 0, repasPlus: 0, nous: 0, pn: 0, pnEsat: 0,
      totalCoeffJour: Array(dailyCoeffData.length).fill(0),
      totalPnJour: Array(dailyCoeffData.length).fill(0),
      totalGlobalJour: Array(dailyCoeffData.length).fill(0),
    };

    dailyCoeffData.forEach((dayEntry, dayIndex) => {
      let currentDayTotalCoeff = 0;
      let currentDayTotalPn = 0;
      (Object.keys(dayEntry) as Array<keyof DailyCoefficientEntry>).forEach(key => {
        if (key !== 'day') {
          const val = Number(dayEntry[key]) || 0;
          (totals[key] as number) += val;
          if (['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'].includes(key)) {
            currentDayTotalCoeff += val;
          }
          if (['pn', 'pnEsat'].includes(key)) {
            currentDayTotalPn += val;
          }
        }
      });
      totals.totalCoeffJour[dayIndex] = currentDayTotalCoeff;
      totals.totalPnJour[dayIndex] = currentDayTotalPn;
      totals.totalGlobalJour[dayIndex] = currentDayTotalCoeff + currentDayTotalPn;
    });
    return totals;
  }, [dailyCoeffData]);
  
  const grandTotalGlobalJourValue = useMemo(() => {
    return dailyCoeffTotals.totalGlobalJour.reduce((sum, val) => sum + val, 0);
  }, [dailyCoeffTotals.totalGlobalJour]);

  const prixDeRevientMensuel = useMemo(() => {
    const coutMatierePremiere = supplierTotals.totalHt - supplierTotals.totalAvoir;
    if (grandTotalGlobalJourValue === 0) return 0;
    return coutMatierePremiere / grandTotalGlobalJourValue;
  }, [supplierTotals, grandTotalGlobalJourValue]);

  const generatePdf = () => {
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('monthly_cost');
      const doc = new jsPDF({
        orientation: pdfSettings.orientation || 'landscape',
        unit: 'pt',
        format: pdfSettings.pageSize || 'a3',
      }) as jsPDFWithAutoTable;
      
      doc.setFont(pdfSettings.fontFamily || 'helvetica');
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      const yearLabel = selectedYear;
      
      let currentY = pdfSettings.marginTop || 40;

      // PDF Header (Logo & Text)
      if (pdfSettings.headerText) {
        const headerRows = pdfSettings.headerText.split('\n').map(rowText => rowText.split('|').map(cellText => cellText.trim()));
        const headerTableBody = headerRows.map(row => row.map(cell => cell === '{logo}' ? '' : cell));
        doc.autoTable({
          body: headerTableBody, startY: currentY, theme: 'plain',
          styles: { fontSize: pdfSettings.headerFontSize || 10, cellPadding: 1, font: pdfSettings.fontFamily || 'helvetica' },
          columnStyles: { 0: { cellWidth: 'auto'} },
          margin: { top: pdfSettings.marginTop || 40, left: pdfSettings.marginLeft || 40, right: pdfSettings.marginRight || 40 },
          didDrawCell: (data) => {
            if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image') && headerRows[data.row.index][data.column.index] === '{logo}') {
              try {
                const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                const formatType = imgProps.fileType.toUpperCase();
                const cellPadding = 2;
                let imgWidth = data.cell.width - 2 * cellPadding;
                let imgHeight = data.cell.height - 2 * cellPadding;
                const cellAspectRatio = data.cell.width / data.cell.height;
                const imgAspectRatio = imgProps.width / imgProps.height;
                if (imgAspectRatio > cellAspectRatio) imgHeight = imgWidth / imgAspectRatio;
                else imgWidth = imgHeight * imgAspectRatio;
                const imgX = data.cell.x + (data.cell.width - imgWidth) / 2;
                const imgY = data.cell.y + (data.cell.height - imgHeight) / 2;
                doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, imgHeight);
              } catch (e: any) { console.error("Error drawing logo in PDF header table:", e); }
            }
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;
      } else if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
        try {
          const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
          const formatType = imgProps.fileType.toUpperCase();
          const desiredHeight = 30;
          const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
          doc.addImage(pdfSettings.logoUrl, formatType, pdfSettings.marginLeft || 40, currentY, imgWidth, desiredHeight);
          currentY += desiredHeight + 5;
        } catch(e: any) { console.error("Error drawing standalone logo in PDF:", e); }
      }
      
      const baseDocTitle = pdfSettings.documentBaseTitle || "Fiche de Coût de Revient Mensuel";
      const title = `${baseDocTitle} - ${monthLabel} ${yearLabel}`;
      doc.setFontSize(pdfSettings.documentTitleFontSize || 18);
      doc.text(title, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
      currentY += (pdfSettings.documentTitleFontSize || 18) * 0.7 + 5;
      doc.setFontSize(pdfSettings.defaultFontSize || 10);
      doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft || 40, currentY);
      currentY += (pdfSettings.defaultFontSize || 10) + 10;

      const tableHeadStyles: any = {
        fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize || 9,
        halign: 'center', valign: 'middle',
      };
      const tableBodyStyles: any = { fontSize: pdfSettings.tableBodyFontSize || 8, valign: 'middle' };
      const tableFooterStyles: any = { ...tableHeadStyles, fillColor: hexToRgb(pdfSettings.primaryColor || '#E0E0E0') || [220,220,220], textColor: [0,0,0] };
      
      if (pdfSettings.primaryColor) {
        const primaryRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryRgb) {
          tableHeadStyles.fillColor = primaryRgb;
          const brightness = (primaryRgb[0] * 299 + primaryRgb[1] * 587 + primaryRgb[2] * 114) / 1000;
          tableHeadStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      } else {
         tableHeadStyles.fillColor = [200,200,200]; 
         tableHeadStyles.textColor = [0,0,0];
      }

      // Table 1: Données Fournisseurs
      doc.setFontSize((pdfSettings.defaultFontSize || 10) + 2);
      doc.text("Tableau des Fournisseurs", pdfSettings.marginLeft || 40, currentY);
      currentY += ((pdfSettings.defaultFontSize || 10) + 2) * 0.7 + 3;

      const supplierTableHead = [['Fournisseur', 'HT (€)', 'TVA (€)', 'Avoir (€)']];
      const supplierTableBody = costData.map(row => [
        row.fournisseur,
        row.ht.toFixed(2),
        row.tva.toFixed(2),
        row.avoir.toFixed(2),
      ]);
      const supplierTableFoot = [[
        { content: 'Total Fournisseurs', styles: { fontStyle: 'bold', halign: 'right'} },
        { content: supplierTotals.totalHt.toFixed(2), styles: { fontStyle: 'bold', halign: 'right'} },
        { content: supplierTotals.totalTva.toFixed(2), styles: { fontStyle: 'bold', halign: 'right'} },
        { content: supplierTotals.totalAvoir.toFixed(2), styles: { fontStyle: 'bold', halign: 'right'} },
      ]];
      doc.autoTable({
        head: supplierTableHead, body: supplierTableBody, foot: supplierTableFoot,
        startY: currentY, theme: 'grid',
        headStyles: tableHeadStyles, styles: {...tableBodyStyles, halign: 'left'}, footStyles: tableFooterStyles,
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        margin: { left: pdfSettings.marginLeft || 40, right: pdfSettings.marginRight || 40 },
        tableWidth: 'auto'
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;

      // Table 2: Coefficients Journaliers
      doc.setFontSize((pdfSettings.defaultFontSize || 10) + 2);
      doc.text("Tableau des Coefficients et Quantités Journaliers", pdfSettings.marginLeft || 40, currentY);
      currentY += ((pdfSettings.defaultFontSize || 10) + 2) * 0.7 + 3;

      const dailyCoeffTableHead = [['Jour', 'IMP', 'SAJ', 'IME', 'ESAT', 'Repas ++', 'Nous', 'Total Coeff.', 'PN', 'PN ESAT', 'Total PN', 'TOTAL GLOBAL JOUR.']];
      const dailyCoeffTableBody = dailyCoeffData.map((entry, dayIndex) => {
        const dayInfo = daysInMonthArray[dayIndex];
        return [
          `${dayInfo.dayOfMonth} - ${dayInfo.dayName.substring(0,3)}`,
          entry.imp === "" ? "0.00" : Number(entry.imp).toFixed(2),
          entry.saj === "" ? "0.00" : Number(entry.saj).toFixed(2),
          entry.ime === "" ? "0.00" : Number(entry.ime).toFixed(2),
          entry.esat === "" ? "0.00" : Number(entry.esat).toFixed(2),
          entry.repasPlus === "" ? "0.00" : Number(entry.repasPlus).toFixed(2),
          entry.nous === "" ? "0.00" : Number(entry.nous).toFixed(2),
          { content: dailyCoeffTotals.totalCoeffJour[dayIndex].toFixed(2), styles: { fontStyle: 'bold' } },
          entry.pn === "" ? "0" : Number(entry.pn).toFixed(0),
          entry.pnEsat === "" ? "0" : Number(entry.pnEsat).toFixed(0),
          { content: dailyCoeffTotals.totalPnJour[dayIndex].toFixed(0), styles: { fontStyle: 'bold' } },
          { content: dailyCoeffTotals.totalGlobalJour[dayIndex].toFixed(2), styles: { fontStyle: 'bold' } },
        ]
      });
      const dailyCoeffTableFoot = [[
        { content: 'Total Mois', styles: { fontStyle: 'bold', halign: 'right'} },
        { content: dailyCoeffTotals.imp.toFixed(2), styles: { fontStyle: 'bold'} }, 
        { content: dailyCoeffTotals.saj.toFixed(2), styles: { fontStyle: 'bold'} }, 
        { content: dailyCoeffTotals.ime.toFixed(2), styles: { fontStyle: 'bold'} }, 
        { content: dailyCoeffTotals.esat.toFixed(2), styles: { fontStyle: 'bold'} }, 
        { content: dailyCoeffTotals.repasPlus.toFixed(2), styles: { fontStyle: 'bold'} }, 
        { content: dailyCoeffTotals.nous.toFixed(2), styles: { fontStyle: 'bold'} },
        { content: (dailyCoeffTotals.totalCoeffJour.reduce((s,v) => s+v,0)).toFixed(2), styles: { fontStyle: 'bold' } },
        { content: dailyCoeffTotals.pn.toFixed(0), styles: { fontStyle: 'bold'} }, 
        { content: dailyCoeffTotals.pnEsat.toFixed(0), styles: { fontStyle: 'bold'} },
        { content: (dailyCoeffTotals.totalPnJour.reduce((s,v) => s+v,0)).toFixed(0), styles: { fontStyle: 'bold' } },
        { content: grandTotalGlobalJourValue.toFixed(2), styles: { fontStyle: 'bold' } },
      ]];
      doc.autoTable({
        head: dailyCoeffTableHead, body: dailyCoeffTableBody, foot: dailyCoeffTableFoot,
        startY: currentY, theme: 'grid',
        headStyles: {...tableHeadStyles, fontSize: 7, cellPadding: 1}, 
        styles: {...tableBodyStyles, fontSize: 6.5, cellPadding: 0.5, halign: 'center'}, 
        footStyles: {...tableFooterStyles, fontSize: 7, cellPadding: 1, halign: 'center'},
        columnStyles: { 
            0: { halign: 'left', cellWidth: 35, fontStyle: 'bold' }, 
            7: { fontStyle: 'bold', fillColor: [203, 213, 225] }, // Total Coeff.
            10: { fontStyle: 'bold', fillColor: [191, 219, 254] }, // Total PN
            11: { fontStyle: 'bold', fillColor: [254, 202, 202] }  // TOTAL GLOBAL JOUR
        },
        margin: { left: pdfSettings.marginLeft || 40, right: pdfSettings.marginRight || 40 },
        didDrawPage: (data) => {
            const pageCount = doc.internal.getNumberOfPages();
            if (pdfSettings.footerText) {
                let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
                doc.setFontSize(pdfSettings.footerFontSize || 8); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - ((pdfSettings.marginBottom || 40) / 2));
            }
        },
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;

      // Récapitulatif Final
      doc.setFontSize((pdfSettings.defaultFontSize || 10) + 1);
      doc.text("Calcul du Prix de Revient Mensuel", pdfSettings.marginLeft || 40, currentY);
      currentY += ((pdfSettings.defaultFontSize || 10) + 1) * 0.7 + 3;
      doc.setFontSize(pdfSettings.defaultFontSize || 10);
      const coutMatierePrem = supplierTotals.totalHt - supplierTotals.totalAvoir;
      doc.text(`Coût Matière Première (Total HT Fournisseurs - Total Avoir Fournisseurs): ${coutMatierePrem.toFixed(2)} €`, pdfSettings.marginLeft || 40, currentY);
      currentY += (pdfSettings.defaultFontSize || 10) * 0.7 + 2;
      doc.text(`Total du Mois (Σ TOTAL GLOBAL JOUR.): ${grandTotalGlobalJourValue.toFixed(2)}`, pdfSettings.marginLeft || 40, currentY);
      currentY += (pdfSettings.defaultFontSize || 10) * 0.7 + 2;
      doc.setFontSize((pdfSettings.defaultFontSize || 10) + 1); doc.setFont(undefined, 'bold');
      doc.text(`Prix de Revient du Mois: ${prixDeRevientMensuel.toFixed(2)} €`, pdfSettings.marginLeft || 40, currentY);
      doc.setFont(undefined, 'normal');

      doc.save(`Cout_Revient_Mensuel_${monthLabel}_${yearLabel}.pdf`);
      toast({ title: "PDF Généré", description: "Le PDF du coût de revient mensuel a été téléchargé." });
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${error.message || 'Erreur inconnue'}.`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  const daysInMonthArray = useMemo(() => {
    const year = parseInt(selectedYear, 10);
    const monthIndex = parseInt(selectedMonth, 10);
    return getMonthDays(year, monthIndex);
  }, [selectedYear, selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
        <div>
          <Label htmlFor="month-select-cost">Mois</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger id="month-select-cost"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="year-select-cost">Année</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger id="year-select-cost"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
         <Button onClick={generatePdf} disabled={isLoading} className="sm:col-start-3 justify-self-end">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            PDF du Mois
        </Button>
      </div>

      {isLoading && costData.length === 0 && dailyCoeffData.length === 0 ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Chargement des données...</span>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Données Fournisseurs</CardTitle>
              <CardDescription>Entrez les informations financières pour chaque fournisseur.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="min-w-[150px]">Fournisseur</TableHead>
                    <TableHead className="min-w-[80px] text-right">HT (€)</TableHead>
                    <TableHead className="min-w-[80px] text-right">TVA (€)</TableHead>
                    <TableHead className="min-w-[80px] text-right">Avoir (€)</TableHead>
                    <TableHead className="min-w-[50px] text-center">Action</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {costData.map((row, rowIndex) => (
                      <TableRow key={row.id || `supplier_new_${rowIndex}`}>
                        <TableCell className="p-1"><Input type="text" value={row.fournisseur} onChange={e => handleSupplierInputChange(rowIndex, 'fournisseur', e.target.value)} className="text-xs p-1 h-8" /></TableCell>
                        <TableCell className="p-1"><Input type="number" value={row.ht} onChange={e => handleSupplierInputChange(rowIndex, 'ht', e.target.value)} className="text-xs p-1 h-8 text-right" /></TableCell>
                        <TableCell className="p-1"><Input type="number" value={row.tva} onChange={e => handleSupplierInputChange(rowIndex, 'tva', e.target.value)} className="text-xs p-1 h-8 text-right" /></TableCell>
                        <TableCell className="p-1"><Input type="number" value={row.avoir} onChange={e => handleSupplierInputChange(rowIndex, 'avoir', e.target.value)} className="text-xs p-1 h-8 text-right" /></TableCell>
                        <TableCell className="text-center p-1">
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteSupplierRow(row.id!)} className="h-8 w-8" disabled={costData.length <= 1}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter><TableRow className="font-bold bg-muted/80">
                    <TableCell>Total Fournisseurs</TableCell>
                    <TableCell className="text-right">{supplierTotals.totalHt.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{supplierTotals.totalTva.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{supplierTotals.totalAvoir.toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow></TableFooter>
                </Table>
              </div>
              <Button onClick={handleAddSupplierRow} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Ajouter Ligne Fournisseur</Button>
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Coefficients et Quantités Journaliers</CardTitle>
              <CardDescription>Saisissez les coefficients (IMP, SAJ, etc.) et les quantités (PN) pour chaque jour du mois.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-md">
                <Table className="min-w-[1200px]">
                  <TableHeader><TableRow>
                    <TableHead className="w-[100px] text-center">Jour</TableHead>
                    <TableHead className="min-w-[70px] text-center">IMP</TableHead>
                    <TableHead className="min-w-[70px] text-center">SAJ</TableHead>
                    <TableHead className="min-w-[70px] text-center">IME</TableHead>
                    <TableHead className="min-w-[70px] text-center">ESAT</TableHead>
                    <TableHead className="min-w-[70px] text-center">Repas ++</TableHead>
                    <TableHead className="min-w-[70px] text-center">Nous</TableHead>
                    <TableHead className="min-w-[80px] text-center font-semibold bg-blue-100 dark:bg-blue-800/30">Total (Coeff)</TableHead>
                    <TableHead className="min-w-[70px] text-center">PN</TableHead>
                    <TableHead className="min-w-[70px] text-center">PN ESAT</TableHead>
                    <TableHead className="min-w-[80px] text-center font-semibold bg-green-100 dark:bg-green-800/30">Total (PN)</TableHead>
                    <TableHead className="min-w-[90px] text-center font-semibold bg-purple-100 dark:bg-purple-800/30">TOTAL GLOBAL JOUR.</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {dailyCoeffData.map((entry, dayIndex) => (
                      <TableRow key={entry.day}>
                        <TableCell className="font-medium text-center">{daysInMonthArray[dayIndex]?.dayOfMonth} - {daysInMonthArray[dayIndex]?.dayName.substring(0,3)}</TableCell>
                        {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'] as const).map(field => (
                          <TableCell key={field} className="p-1">
                            <Input type="number" value={entry[field]} onChange={e => handleDailyCoeffInputChange(dayIndex, field, e.target.value)} className="text-xs p-1 h-8 text-center" placeholder="0" />
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-semibold bg-blue-100 dark:bg-blue-800/30">{dailyCoeffTotals.totalCoeffJour[dayIndex].toFixed(2)}</TableCell>
                         {(['pn', 'pnEsat'] as const).map(field => (
                            <TableCell key={field} className="p-1">
                                <Input type="number" value={entry[field]} onChange={e => handleDailyCoeffInputChange(dayIndex, field, e.target.value)} className="text-xs p-1 h-8 text-center" placeholder="0" />
                            </TableCell>
                        ))}
                        <TableCell className="text-center font-semibold bg-green-100 dark:bg-green-800/30">{dailyCoeffTotals.totalPnJour[dayIndex].toFixed(0)}</TableCell>
                        <TableCell className="text-center font-semibold bg-purple-100 dark:bg-purple-800/30">{dailyCoeffTotals.totalGlobalJour[dayIndex].toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter><TableRow className="font-bold bg-muted/80">
                    <TableCell>Total Mois</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.imp.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.saj.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.ime.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.esat.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.repasPlus.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.nous.toFixed(2)}</TableCell>
                    <TableCell className="text-center font-semibold bg-blue-100 dark:bg-blue-800/30">
                      {(dailyCoeffTotals.totalCoeffJour.reduce((s,v) => s+v,0)).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.pn.toFixed(0)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.pnEsat.toFixed(0)}</TableCell>
                     <TableCell className="text-center font-semibold bg-green-100 dark:bg-green-800/30">
                      {(dailyCoeffTotals.totalPnJour.reduce((s,v) => s+v,0)).toFixed(0)}
                    </TableCell>
                    <TableCell className="text-center font-semibold bg-purple-100 dark:bg-purple-800/30">
                      {grandTotalGlobalJourValue.toFixed(2)}
                    </TableCell>
                  </TableRow></TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader>
                <CardTitle>Calcul du Prix de Revient Mensuel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><span className="font-medium">Coût Matière Première (Total HT Fournisseurs - Total Avoir Fournisseurs):</span> <span className="font-semibold">{(supplierTotals.totalHt - supplierTotals.totalAvoir).toFixed(2)} €</span></div>
                    <div><span className="font-medium">Total du Mois (Σ TOTAL GLOBAL JOUR.):</span> <span className="font-semibold">{grandTotalGlobalJourValue.toFixed(2)}</span></div>
                </div>
                <div className="mt-4 pt-4 border-t">
                    <Label className="text-lg font-semibold">Prix de Revient du Mois :</Label>
                    <span className="text-2xl font-bold ml-2 text-primary">{prixDeRevientMensuel.toFixed(2)} €</span>
                    <p className="text-xs text-muted-foreground mt-1">
                        Calculé comme : (Coût Matière Première) / Total du Mois (Σ TOTAL GLOBAL JOUR.).
                    </p>
                </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

    
    
